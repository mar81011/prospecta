# Prospecta MVP — Manual GCash Payment & Admin Approval Specification

## Purpose

This document defines the current payment, account, subscription, and admin workflow for Prospecta.

**Current decision:** Prospecta will use **manual GCash payments + admin approval** for the MVP.

Do NOT integrate PayMongo yet.

The architecture should be designed so PayMongo can be added later without replacing the subscription/plan system.

---

# 1. Product Context

Prospecta is a SaaS platform for real-estate agents.

The product helps agents:

- Create and manage property listings
- Generate AI-assisted property content
- Manage leads
- Qualify and score leads
- Eventually connect Facebook Messenger
- Manage prospects and site-viewing schedules
- Use AI as a sales assistant

Current subscription plans:

| Plan | Price | Status |
|---|---:|---|
| Free | ₱0 | Available immediately |
| Starter | ₱199/month | Manual GCash |
| Pro | ₱399/month | Manual GCash |

These prices may change later.

## Recommended MVP Plan Limits

The following limits are the current recommended starting point for the MVP. They should be stored in centralized plan configuration rather than hard-coded throughout the UI.

| Feature | Free | Starter | Pro |
|---|---:|---:|---:|
| Price | ₱0 | ₱199/month | ₱399/month |
| Active property listings | 5 | 25 | High/unlimited under fair use |
| Leads per month | 50 | 250 | High/unlimited under fair use |
| AI generations per month | 10 | 100 | Higher allowance / fair use |
| Lead management | Basic | Full | Full + Advanced CRM |
| Lead scoring | Basic/limited | Yes | Advanced |
| Property AI tools | Basic | Yes | Advanced |
| Site-viewing management | Basic | Yes | Yes |
| Messenger integration | No | Basic | Advanced AI automation |
| Property matching | No | Basic | Advanced |

### Plan Strategy

Free should be useful enough for an agent to understand Prospecta's value without making the product feel artificially restricted. The main upgrade triggers should be **AI usage, lead volume, lead management, Messenger automation, and advanced CRM capabilities**, rather than simply blocking agents from creating listings.

Recommended positioning:

- **Free:** Try Prospecta and manage a small number of properties and leads.
- **Starter:** For individual agents who actively generate leads and need AI-assisted workflows.
- **Pro:** For agents who rely heavily on Prospecta for lead management, Messenger automation, AI sales assistance, and advanced CRM features.

These limits are configurable recommendations, not permanent business rules. They can be adjusted later based on actual usage and operating costs.

---

# 2. Current Payment Decision

For the MVP:

> **Do not integrate PayMongo or automatic GCash checkout yet.**

Use:

```text
Agent
  ↓
Selects plan
  ↓
Prospecta shows GCash payment instructions
  ↓
Agent sends GCash manually
  ↓
Agent submits payment reference
  ↓
Payment becomes PENDING
  ↓
Admin checks actual GCash transaction
  ↓
Admin approves/rejects
  ↓
Prospecta activates the selected plan
```

This is intended for early product validation.

The system must NOT pretend that manual GCash is a payment gateway.

It is a manual payment workflow.

---

# 3. Important Compliance Note

Manual GCash is an MVP operational choice, not a permanent way to avoid business/payment compliance.

Prospecta is still a paid software service.

When Prospecta gains traction, review the appropriate Philippine business, tax, and payment requirements and move to a proper payment provider such as PayMongo if appropriate.

Do not build features intended to conceal revenue, bypass verification, or circumvent payment-provider rules.

---

# 4. Agent Registration Flow

Agents should register themselves.

Do NOT require the admin to manually create every account.

Flow:

```text
Agent
  ↓
Register
  ↓
Verify email / complete account setup
  ↓
Default plan = FREE
  ↓
Use Prospecta
```

The admin can later manage the agent from the admin dashboard.

---

# 5. Paid Plan Upgrade Flow

When an agent wants to upgrade:

```text
Agent Dashboard
  ↓
Pricing / Upgrade
  ↓
Choose Starter or Pro
  ↓
Payment Instructions
  ↓
Agent sends GCash
  ↓
Agent clicks "I've Paid"
  ↓
Submit payment information
  ↓
Payment status = PENDING
```

The agent should NOT receive the paid features immediately.

Only an approved payment can activate the plan.

---

# 6. Payment Page

Create a dedicated Prospecta payment page.

Example:

```text
Upgrade to Pro

₱399 / month

Pay using GCash

GCash Number:
09XX XXX XXXX

Account Name:
PROSPECTA / OWNER NAME

Instructions:
1. Send ₱399 using GCash.
2. Enter the GCash reference number below.
3. Submit the payment.
4. Wait for admin approval.

[ I've Paid ]
```

Do not expose unnecessary personal information.

The actual GCash number/name should be configurable from the admin settings rather than hardcoded throughout the application.

---

# 7. Payment Submission Form

When the agent clicks `I've Paid`, show:

```text
Plan:
PRO

Amount:
₱399

GCash Reference Number:
[________________]

Payment Date:
[________________]

Optional:
[Upload payment screenshot]

[Submit Payment]
```

Recommended fields:

- plan
- amount
- GCash reference number
- payment date
- optional screenshot
- notes/message

The screenshot should be optional.

The GCash reference number is the primary reference.

---

# 8. Payment Statuses

Use a controlled status model.

```text
PENDING
APPROVED
REJECTED
EXPIRED
```

### PENDING

Agent submitted payment information.

Admin has not reviewed it yet.

### APPROVED

Admin verified the payment and activated the plan.

### REJECTED

Payment could not be verified or information was incorrect.

### EXPIRED

Payment request is too old and is no longer valid.

---

# 9. Database Design

Use Supabase/PostgreSQL.

## profiles

```text
profiles
---------
id
name
email
role
plan
plan_status
plan_expires_at
created_at
updated_at
```

Suggested values:

```text
role:
- agent
- admin

plan:
- free
- starter
- pro

plan_status:
- active
- pending
- expired
- cancelled
```

Do not duplicate authentication passwords in this table.

Use Supabase Auth for authentication.

---

## payments

```text
payments
---------
id
agent_id
plan
amount
currency
gcash_reference
payment_date
screenshot_url
notes
status
submitted_at
approved_at
approved_by
rejected_at
rejection_reason
created_at
updated_at
```

Suggested values:

```text
currency:
PHP

status:
PENDING
APPROVED
REJECTED
EXPIRED
```

`approved_by` should reference the admin user who approved the payment.

---

## plan configuration

Avoid hardcoding pricing everywhere.

A simple configuration table or server-side configuration can be used.

Example:

```text
plans
---------
id
name
price
billing_period
description
active
created_at
updated_at
```

Example records:

```text
free     | 0     | monthly
starter  | 199   | monthly
pro      | 399   | monthly
```

This makes future pricing changes easier.

---

# 10. Subscription Logic

When a payment is approved:

```text
payment.status = APPROVED

agent.plan = selected plan
agent.plan_status = ACTIVE
agent.plan_expires_at = current date + 30 days
```

For example:

```text
Pro ₱399

Approved:
October 8

Expires:
November 7
```

Do not assume calendar-month billing unless explicitly designed that way.

For MVP, a 30-day subscription period is simpler.

---

# 11. Renewals

When the plan is close to expiry:

```text
Agent Dashboard

Your Pro plan expires in 5 days.

[Renew Pro — ₱399]
```

The renewal process is the same:

```text
Renew
 ↓
GCash
 ↓
Submit reference
 ↓
PENDING
 ↓
Admin verifies
 ↓
APPROVED
 ↓
Add another 30 days
```

For a renewal, avoid accidentally resetting an already-active subscription incorrectly.

Recommended behavior:

If current plan is still active:

```text
new_expiry = current_expiry + 30 days
```

If already expired:

```text
new_expiry = current_date + 30 days
```

---

# 12. Admin Dashboard

Create a protected admin-only dashboard.

Suggested navigation:

```text
Admin
├── Overview
├── Payments
├── Agents
├── Plans
├── Settings
└── Activity / Audit Log
```

---

# 13. Admin Payments Page

Display pending payments prominently.

Example:

```text
Pending Payments (2)

---------------------------------------------------
Agent          Plan     Amount   Reference   Action
---------------------------------------------------
Juan Cruz      PRO      ₱399     123456789   Review
Maria Santos   STARTER  ₱199     987654321   Review
```

Clicking Review opens:

```text
Payment Details

Agent:
Juan Cruz

Email:
juan@example.com

Plan:
PRO

Amount:
₱399

GCash Reference:
123456789

Payment Date:
Oct 8, 2026

Screenshot:
[View Screenshot]

[ APPROVE PAYMENT ]
[ REJECT PAYMENT ]
```

---

# 14. Admin Approval Behavior

When admin clicks APPROVE:

1. Verify payment details.
2. Verify the GCash transaction independently.
3. Mark payment as APPROVED.
4. Activate the selected plan.
5. Set/extend plan expiration.
6. Record the approving admin.
7. Record an audit event.
8. Notify the agent.

Example notification:

```text
Your Pro plan has been activated.

You now have access to Pro features until November 7, 2026.
```

The approval operation should be atomic/transaction-safe so a partial update cannot leave the payment and agent plan inconsistent.

---

# 15. Admin Rejection Behavior

When admin clicks REJECT:

Require a reason.

Example:

```text
Reason:
- Reference not found
- Incorrect amount
- Duplicate payment
- Wrong account
- Payment screenshot does not match
- Other
```

Store:

```text
rejection_reason
rejected_at
approved_by / reviewed_by
```

The agent should see:

```text
Payment could not be verified.

Reason:
The GCash reference could not be found.

Please submit a new payment.
```

Do not delete the payment record.

Keep the record for auditing.

---

# 16. Admin Create Agent Feature

Admin should be able to create/invite an agent if necessary.

However, this should NOT be the normal registration flow.

Normal flow:

```text
Agent registers themselves
```

Admin-created flow:

```text
Admin
 ↓
Create / Invite Agent
 ↓
Enter name + email
 ↓
Send invitation
 ↓
Agent sets password
 ↓
Account activated
```

Never ask the admin to create or know the agent's password.

Use Supabase Auth invitations/password setup.

---

# 17. Roles and Security

At minimum:

```text
agent
admin
```

Agents must NEVER be able to:

- Approve payments
- Reject payments
- Change another agent's plan
- Change payment status
- Access another agent's payment information
- Access admin pages
- Change their own plan status directly

Only authorized admin users can perform payment approval actions.

Use Supabase Row Level Security (RLS).

Do not rely only on frontend route protection.

Backend/database authorization must enforce the rules.

---

# 18. Admin Settings

Create a settings area for:

```text
GCash Number
GCash Account Name
Payment Instructions
Support Email
Support Messenger URL
```

This allows the GCash account to be changed without modifying code.

Example:

```text
Settings

GCash Number
[09XX XXX XXXX]

GCash Account Name
[Prospecta]

Payment Instructions
[Send the exact plan amount...]

[Save Settings]
```

---

# 19. Notifications

MVP can initially use in-app notifications.

Recommended events:

### Agent submits payment

Admin sees:

```text
New payment submitted by Juan Cruz.
```

### Admin approves

Agent sees:

```text
Payment approved.
Your Pro plan is now active.
```

### Admin rejects

Agent sees:

```text
Payment rejected.
Please review the reason and submit again.
```

### Subscription nearing expiry

Agent sees:

```text
Your Pro plan expires in 5 days.
```

Email notifications can be added later.

---

# 20. Audit Log

Payment changes should be auditable.

Create:

```text
audit_logs
-----------
id
actor_id
action
entity_type
entity_id
metadata
created_at
```

Examples:

```text
ADMIN_APPROVED_PAYMENT
ADMIN_REJECTED_PAYMENT
ADMIN_CHANGED_PLAN
ADMIN_CREATED_AGENT
AGENT_SUBMITTED_PAYMENT
```

This protects against accidental or unauthorized changes.

---

# 21. Do Not Trust the Client

The frontend must never be able to send:

```text
plan = "pro"
plan_status = "active"
```

and expect the database to accept it.

The server/database must determine whether an agent is entitled to paid features.

Example:

```text
Agent submits payment
       ↓
Server validates:
- logged-in agent
- valid plan
- correct price
- payment status
       ↓
PENDING
```

Only an authorized admin can transition:

```text
PENDING → APPROVED
```

Then the server updates the subscription.

---

# 22. Price Validation

Do not trust the amount submitted by the browser.

If Pro is ₱399, the backend should look up the current plan price.

Bad:

```text
frontend sends:
amount = 1
plan = pro
```

Good:

```text
frontend sends:
plan = pro

backend:
lookup pro price
amount = 39900 centavos
```

For Philippine peso storage, choose one consistent representation.

Recommended:

```text
amount = 39900
currency = PHP
```

where the integer represents centavos.

Or store whole PHP consistently if the project convention requires it.

Do not mix formats.

---

# 23. Duplicate Payment Protection

Prevent the same GCash reference from being approved twice.

Before approval:

```text
Check whether gcash_reference already belongs to
another APPROVED payment.
```

If it does:

```text
Reject duplicate.
```

Consider a unique index/constraint where appropriate.

---

# 24. Payment Screenshot Storage

If screenshots are allowed:

- Store them in Supabase Storage.
- Use private storage.
- Do not expose unrestricted public URLs.
- Only the submitting agent and authorized admins should access the screenshot.
- Validate file type and size.
- Never trust a filename or MIME type supplied by the browser.

Suggested path:

```text
payment-screenshots/{agent_id}/{payment_id}.jpg
```

---

# 25. Agent Experience

The agent should NOT need to understand the internal payment system.

Their experience should be simple:

```text
Choose plan
 ↓
Pay via GCash
 ↓
Submit reference
 ↓
"Waiting for approval"
 ↓
Approved
 ↓
Features unlocked
```

Show status clearly.

Example:

```text
Payment Status

🟡 Waiting for approval

Submitted:
October 8, 2026

Plan:
Pro

Amount:
₱399

Reference:
123456789
```

---

# 26. Expiration Handling

Do not delete an agent's data when their subscription expires.

Instead:

```text
plan = pro
plan_status = expired
```

The agent can still log in and access whatever Free plan features are allowed.

Example:

```text
PRO expired
     ↓
Downgrade access
     ↓
FREE features remain
```

Do not delete listings, leads, or other important user data merely because the subscription expired.

---

# 27. Feature Entitlements

Avoid checking only:

```ts
if (user.plan === "pro")
```

Prefer a centralized entitlement system.

Example configuration:

```ts
const PLAN_LIMITS = {
  free: {
    maxActiveListings: 5,
    maxLeadsPerMonth: 50,
    maxAiGenerationsPerMonth: 10,
    messengerAutomation: false,
    advancedLeadScoring: false,
    advancedCrm: false,
  },

  starter: {
    maxActiveListings: 25,
    maxLeadsPerMonth: 250,
    maxAiGenerationsPerMonth: 100,
    messengerAutomation: false,
    advancedLeadScoring: false,
    advancedCrm: false,
  },

  pro: {
    maxActiveListings: null,
    maxLeadsPerMonth: null,
    maxAiGenerationsPerMonth: null,
    messengerAutomation: true,
    advancedLeadScoring: true,
    advancedCrm: true,
  },
};
```

For Pro, `null` means no fixed product limit, subject to fair-use and backend cost controls. AI usage should still be protected by server-side rate limits and spend controls.

The exact limits can change later. Keep them centralized so pricing experiments and usage-based adjustments do not require rewriting the application.

---

# 28. Future PayMongo Migration

The current system must be designed so manual GCash can later be replaced by PayMongo.

Current:

```text
Agent
 ↓
Manual GCash
 ↓
Payment submission
 ↓
Admin approval
 ↓
Subscription activation
```

Future:

```text
Agent
 ↓
PayMongo Checkout
 ↓
GCash
 ↓
PayMongo Webhook
 ↓
Payment verification
 ↓
Subscription activation
```

The important part:

**Do not couple subscription activation directly to the payment UI.**

Create a reusable server-side service such as:

```ts
activateSubscription({
  agentId,
  planId,
  paymentId,
})
```

Then both systems can use it.

Manual:

```text
Admin approves payment
 ↓
activateSubscription()
```

Future PayMongo:

```text
Webhook confirms payment
 ↓
activateSubscription()
```

This avoids rebuilding the subscription system later.

---

# 29. Recommended Architecture

Current stack:

```text
Next.js
TypeScript
Supabase
Supabase Auth
Supabase PostgreSQL
Supabase Storage
Vercel
```

Payment:

```text
Manual GCash
```

Future:

```text
PayMongo
```

AI:

```text
AI abstraction layer
```

Do not hardcode payment-provider logic into UI components.

---

# 30. Suggested API Routes

Example Next.js route structure:

```text
/api/payments/submit
/api/payments/[id]
/api/admin/payments
/api/admin/payments/[id]/approve
/api/admin/payments/[id]/reject
/api/admin/agents
/api/admin/agents/[id]
/api/admin/settings
```

Exact naming can be adapted to the existing project structure.

---

# 31. Suggested User Routes

```text
/pricing
/upgrade
/payment
/payment/success
/payment/pending
/payment/history
```

Admin:

```text
/admin
/admin/payments
/admin/agents
/admin/plans
/admin/settings
/admin/audit-logs
```

Protect all `/admin/*` routes.

---

# 32. Payment History

Agents should be able to see their own payment history.

Example:

```text
Payment History

Date        Plan      Amount    Status
Oct 8       PRO       ₱399      APPROVED
Sep 8       PRO       ₱399      APPROVED
Aug 8       STARTER   ₱199      APPROVED
```

Never expose another agent's payments.

---

# 33. Admin Overview

Admin dashboard should show:

```text
Total Agents
Active Paid Agents
Free Agents
Pending Payments
Monthly Manual Revenue
Expiring Soon
```

Example:

```text
Agents           23
Paid Agents      8
Pending          2
Monthly Revenue  ₱2,593
Expiring Soon    3
```

Revenue figures should be calculated from approved payments, not payment submissions.

---

# 34. MVP Priority

Implement in this order:

### Phase 1 — Authentication

- Agent registration
- Login
- Supabase Auth
- Admin role
- Protected routes

### Phase 2 — Plans

- Free / Starter / Pro
- Plan display
- Feature entitlement checks

### Phase 3 — Manual GCash

- Payment instructions
- Submit payment
- GCash reference
- Optional screenshot
- Payment status

### Phase 4 — Admin

- Admin payment list
- Payment detail
- Approve
- Reject
- Agent management

### Phase 5 — Subscription

- Activate plan
- 30-day expiration
- Renewal
- Expiration handling

### Phase 6 — Notifications

- Payment submitted
- Payment approved
- Payment rejected
- Expiration warning

### Phase 7 — Audit/Security

- Audit logs
- RLS
- Duplicate reference protection
- Secure screenshot storage

### Phase 8 — Future PayMongo

Only after Prospecta has traction:

- PayMongo account
- Business verification
- Checkout
- GCash payment
- Webhook
- Automatic activation

---

# 35. Cursor AI Instructions

When implementing this specification:

1. Inspect the existing Prospecta codebase first.
2. Do NOT rewrite the existing application unnecessarily.
3. Reuse the existing authentication and Supabase setup where possible.
4. Use TypeScript types.
5. Keep payment logic server-side.
6. Use Supabase RLS for authorization.
7. Do not store passwords manually.
8. Do not allow frontend users to modify their own plan or payment status.
9. Keep manual GCash isolated behind a payment service abstraction.
10. Make the architecture compatible with future PayMongo integration.
11. Do not integrate PayMongo yet.
12. Do not introduce unnecessary infrastructure.
13. Keep the MVP simple.
14. Preserve existing Prospecta features.
15. Before changing database schema, inspect the current schema and avoid duplicate tables/fields.

---

# 36. Definition of Done

The MVP payment system is complete when:

- [ ] Agent can register.
- [ ] Agent starts on Free.
- [ ] Agent can view Starter and Pro plans.
- [ ] Agent can select a paid plan.
- [ ] Agent sees GCash instructions.
- [ ] Agent can submit GCash reference.
- [ ] Payment becomes PENDING.
- [ ] Agent cannot activate their own payment.
- [ ] Admin sees pending payments.
- [ ] Admin can inspect payment details.
- [ ] Admin can approve payment.
- [ ] Admin can reject payment with a reason.
- [ ] Approval activates the correct plan.
- [ ] Free/Starter/Pro limits are enforced server-side.
- [ ] Active listing limits are enforced by plan.
- [ ] Monthly lead limits are enforced by plan.
- [ ] Monthly AI generation limits are enforced by plan.
- [ ] Feature entitlements are centralized rather than scattered across the UI.
- [ ] Expired paid plans fall back to Free entitlements without deleting user data.
- [ ] Subscription expires after 30 days.
- [ ] Renewal works.
- [ ] Agent can see payment history.
- [ ] Admin can see agent list.
- [ ] Admin can manage GCash payment settings.
- [ ] Duplicate GCash references are protected.
- [ ] Payment actions are logged.
- [ ] RLS prevents cross-agent data access.
- [ ] Payment screenshots are private.
- [ ] No PayMongo integration exists yet.
- [ ] Subscription activation is abstracted so PayMongo can be added later.

---

# 37. Core Principle

For the MVP:

> **Manual payment should be simple for the agent and simple for the admin.**

Agent:

```text
Pay → Submit reference → Wait
```

Admin:

```text
Check GCash → Approve
```

System:

```text
Approve → Activate plan → Track expiration
```

Later:

```text
PayMongo → Webhook → Automatically activate
```

Do not over-engineer the payment system before Prospecta has paying users.
