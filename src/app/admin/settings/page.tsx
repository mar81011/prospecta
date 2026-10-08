import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getPaymentSettings } from "@/lib/payments";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings · Admin" };

export default async function AdminSettingsPage() {
  const s = await getPaymentSettings();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" description="Shown to agents on the payment page. Changes take effect immediately." />
      <SettingsForm
        initial={{
          gcashNumber: s?.gcash_number ?? "",
          gcashAccountName: s?.gcash_account_name ?? "",
          paymentInstructions: s?.payment_instructions ?? "",
          supportEmail: s?.support_email ?? "",
          supportMessengerUrl: s?.support_messenger_url ?? "",
          ttlDays: s?.payment_request_ttl_days ?? 7,
        }}
      />
    </div>
  );
}
