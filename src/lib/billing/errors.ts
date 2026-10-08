// Maps the HINT codes raised by the billing SQL functions to user-facing text.

const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Please sign in again.",
  FORBIDDEN: "You don't have permission to do that.",
  INVALID_PLAN: "That plan isn't available.",
  INVALID_REFERENCE: "Enter the GCash reference number exactly as shown on your receipt (digits only).",
  INVALID_DATE: "Enter the date you sent the payment.",
  INVALID_NOTES: "Notes are too long.",
  DUPLICATE_REFERENCE: "This GCash reference number has already been used for an approved payment.",
  PENDING_EXISTS: "You already have a payment waiting for approval.",
  NOT_FOUND: "Not found.",
  NOT_PENDING: "This payment has already been reviewed.",
  REASON_REQUIRED: "A rejection reason is required.",
  EXPIRY_REQUIRED: "An active paid plan needs an expiry date.",
  SELF_ROLE_CHANGE: "You can't change your own role.",
  INVALID_PRICE: "Paid plans need a price above ₱0.",
  LIMIT_LISTINGS: "You've reached your plan's active listing limit.",
  LIMIT_LEADS: "You've reached your plan's monthly lead limit.",
  LIMIT_AI: "You've used all AI generations for this month.",
  LIMIT_PHOTOS: "A listing can have up to 10 photos.",
  INVALID_NAME: "Enter your name.",
  CONTACT_REQUIRED: "Enter a phone number or email so the agent can reach you.",
  INVALID_PHONE: "Enter a valid phone number.",
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_MESSAGE: "Your message is too long.",
  TOO_MANY: "You've already sent an inquiry for this listing. The agent will get back to you soon.",
};

type PgError = { message?: string; hint?: string | null; code?: string } | null | undefined;

export function errorCode(error: PgError): string | null {
  return error?.hint && MESSAGES[error.hint] ? error.hint : null;
}

export function friendlyError(error: PgError, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  const code = errorCode(error);
  if (code) {
    // Limit errors carry the specific number in the message.
    return code.startsWith("LIMIT_") && error.message ? error.message : MESSAGES[code];
  }
  // Unique-index race (duplicate reference or a second pending request).
  if (error.code === "23505") return "This payment conflicts with an existing one. Refresh and check your payment history.";
  return fallback;
}
