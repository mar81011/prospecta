import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/require";
import { ProfileForm } from "./profile-form";
import { PhotoForm } from "./photo-form";
import { agentPhotoUrl } from "@/lib/listings";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Account" description={user.email} />
      <Card>
        <h2 className="mb-4 font-semibold">Profile photo</h2>
        <PhotoForm
          name={user.profile.name}
          photoUrl={user.profile.photo_path ? agentPhotoUrl(user.profile.photo_path) : null}
        />
      </Card>
      <Card>
        <h2 className="mb-4 font-semibold">Profile</h2>
        <ProfileForm name={user.profile.name} phone={user.profile.phone} />
      </Card>
      <Card className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Password</h2>
          <p className="text-sm text-zinc-600">Change the password you use to sign in.</p>
        </div>
        <Link href="/auth/set-password" className="text-sm font-medium text-brand-600 hover:underline">
          Change password
        </Link>
      </Card>
    </div>
  );
}
