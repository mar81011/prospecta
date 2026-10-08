import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center">
          <Logo />
        </Link>
        {children}
      </div>
    </main>
  );
}
