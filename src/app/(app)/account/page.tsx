import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { ShareButtons } from "@/components/share-buttons";
import { requireUser } from "@/lib/auth/require";
import { agentPhotoUrl, publicAgentUrl } from "@/lib/listings";
import { ProfileForm } from "./profile-form";
import { PhotoForm } from "./photo-form";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const p = user.profile;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const pageUrl = p.slug ? publicAgentUrl(p.slug) : null;

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Account" description={user.email} />

      {pageUrl && (
        <Card className="space-y-3 border-brand-100 bg-brand-50/40">
          <div>
            <h2 className="font-semibold">Your agent page</h2>
            <p className="text-sm text-zinc-600">
              All your active listings and contact buttons at one link. Put it in your Facebook bio, posts and business card.
            </p>
          </div>
          <Link href={`/a/${p.slug}`} target="_blank" className="block truncate text-sm font-medium text-brand-700 hover:underline">
            {pageUrl}
          </Link>
          <ShareButtons
            shareUrl={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`}
            publicUrl={pageUrl}
            caption={`Looking for a house, condo or lot? 🏡 Browse all my listings and message me directly here:\n${pageUrl}`}
          />
        </Card>
      )}

      <Card>
        <h2 className="mb-4 font-semibold">Profile photo</h2>
        <PhotoForm name={p.name} photoUrl={p.photo_path ? agentPhotoUrl(p.photo_path) : null} />
      </Card>
      <Card>
        <h2 className="mb-4 font-semibold">Profile</h2>
        <ProfileForm
          siteUrl={siteUrl}
          profile={{ name: p.name, phone: p.phone, slug: p.slug, bio: p.bio, messenger: p.messenger, viber: p.viber }}
        />
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
