import type { Metadata } from "next";

import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "VFX Cook Academy",
  description: "AI video creation course platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="container site-main">{children}</main>
      </body>
    </html>
  );
}
