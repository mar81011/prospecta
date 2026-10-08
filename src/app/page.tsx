import { SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/require";

export default async function HomePage() {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Your AI sales assistant for real estate.</h1>
        <p className="mt-4 text-lg text-zinc-600">
          Manage listings, qualify leads and schedule site viewings in one place, built for Filipino agents.
        </p>
        <div className="mt-8 flex gap-3">
          {user ? (
            <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/register">Get started free</ButtonLink>
              <ButtonLink href="/pricing" variant="secondary">
                See plans
              </ButtonLink>
            </>
          )}
        </div>
      </main>
    </>
  );
}
