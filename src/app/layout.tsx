import type { Metadata } from "next";
import { Space_Grotesk, Geist } from "next/font/google";

import "@/app/globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const heading = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "LinkRunner Framer CMS Bridge",
  description: "Backend service for managing an unmanaged Framer CMS collection and optional Notion sync.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)}>
      <body className={`${geist.variable} ${heading.variable}`}>
        {children}
      </body>
    </html>
  );
}
