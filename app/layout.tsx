import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CyberX OSINT | Open-source intelligence workspace",
  description: "A privacy-conscious workspace for public domain and network research.",
  applicationName: "CyberX OSINT",
  manifest: "/manifest.webmanifest"
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#07152f"
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}