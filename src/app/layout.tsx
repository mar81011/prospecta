import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const DESCRIPTION = "Listings, leads and AI sales assistance for real-estate agents in the Philippines.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Prospecta", template: "%s · Prospecta" },
  description: DESCRIPTION,
  // Default share preview. Pages with their own openGraph (listings, agent
  // pages) replace this whole object.
  openGraph: {
    type: "website",
    siteName: "Prospecta",
    title: "Prospecta: your AI sales assistant for real estate",
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Prospecta" }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <footer className="mt-auto border-t border-zinc-200 py-4 text-center text-xs text-zinc-500">
          © Prospecta ·{" "}
          <Link href="/privacy" className="hover:text-zinc-800 hover:underline">
            Privacy Policy
          </Link>
        </footer>
      </body>
    </html>
  );
}
