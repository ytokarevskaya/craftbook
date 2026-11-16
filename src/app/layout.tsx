import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = { title: { default: "Craftbook", template: "%s | Craftbook" }, description: "Jedna kniha vládne všem. Lokální prezentační náhled.", robots: { index: false, follow: false } };
export const runtime = "nodejs";
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="cs"><body><Shell>{children}</Shell></body></html>;
}
