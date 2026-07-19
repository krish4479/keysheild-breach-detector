import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KeyShield — password strength, breach detection & auth policy",
  description:
    "A security instrument for passwords: local strength analysis, HIBP k-anonymity breach checks, and NIST 800-63B policy enforcement.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Touch headers() so every route renders dynamically — required for the
  // per-request CSP nonce (set by proxy.ts) to apply to framework scripts.
  await headers();

  return (
    <html lang="en" data-theme="dark" className={jetbrainsMono.variable}>
      <body>
        <div className="ks-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
