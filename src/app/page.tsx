import { SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui";
import { ProductDemo } from "@/components/home/product-demo";
import { UpgradeBenefits } from "@/components/home/upgrade-benefits";
import { getCurrentUser } from "@/lib/auth/require";
import { listPlans } from "@/lib/plans/catalog";

export default async function HomePage() {
  const [user, plans] = await Promise.all([getCurrentUser(), listPlans().catch(() => [])]);
  return (
    <>
      <SiteHeader user={user} />
      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pt-20 pb-14 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Your AI sales assistant for real estate.</h1>
          <p className="mt-4 text-lg text-zinc-600">
            Manage listings, qualify leads and schedule site viewings in one place, built for Filipino agents.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {user ? (
              <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
            ) : (
              <ButtonLink href="/register">Get started free</ButtonLink>
            )}
            <ButtonLink href="#demo" variant="secondary">
              See how it works
            </ButtonLink>
          </div>
        </section>

        <section id="demo" className="mx-auto w-full max-w-5xl scroll-mt-6 px-4 pb-20">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">From listing to closed deal</h2>
            <p className="mt-2 text-zinc-600">Click through a real workflow: one condo, one Facebook post, one buyer.</p>
          </div>
          <ProductDemo />
        </section>

        {plans.length > 0 && (
          <section id="upgrade" className="border-t border-zinc-200 bg-white py-20">
            <div className="mx-auto w-full max-w-5xl px-4">
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Why upgrade?</h2>
                <p className="mt-2 text-zinc-600">
                  Free is enough to try Prospecta. Upgrade when you have more listings, more leads and want AI working for
                  you around the clock.
                </p>
              </div>
              <UpgradeBenefits plans={plans} signedIn={Boolean(user)} />
            </div>
          </section>
        )}
      </main>
    </>
  );
}
