import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "Craftbook", template: "%s | Craftbook" }, description: "Jedna kniha vládne všem.", robots: { index: false, follow: false } };
export const runtime = "nodejs";
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="cs"><body>{children}</body></html>;
}
