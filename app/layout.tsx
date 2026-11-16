import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "CyberX OSINT | Open Source Intelligence Tools", description: "Ethical OSINT tools for public-information research and authorized security work." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }