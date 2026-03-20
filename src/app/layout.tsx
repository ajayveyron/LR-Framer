import type { Metadata } from "next";
import { Space_Grotesk, Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import "@/app/globals.css";
import { NotificationProvider } from "@/components/notification-provider";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const heading = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Framer Bot | Framer On Steroids",
  description:
    "Framer Bot is Framer on steroids: an AI-native workspace for teams managing Framer CMS, approvals, and backend sync flows together.",
  keywords: ["Framer", "CMS", "Dashboard", "Framer Bot", "AI", "Team"],
  authors: [{ name: "Framer Bot Team" }],
  openGraph: {
    title: "Framer Bot | Framer On Steroids",
    description:
      "Framer Bot is Framer on steroids: an AI-native workspace for teams managing Framer CMS, approvals, and backend sync flows together.",
    type: "website",
    siteName: "Framer Bot",
  },
  twitter: {
    card: "summary_large_image",
    title: "Framer Bot | Framer On Steroids",
    description:
      "Framer Bot is Framer on steroids: an AI-native workspace for teams managing Framer CMS, approvals, and backend sync flows together.",
  },
  icons: {
    icon: process.env.NODE_ENV === "development" ? "/favicon-dev.png" : "/icon.png",
  },
};

function isClerkConfigured() {
  return Boolean(
    process.env.CLERK_SECRET_KEY?.trim() &&
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim(),
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const app = <NotificationProvider>{children}</NotificationProvider>;

  const content = isClerkConfigured() ? (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
      {app}
    </ClerkProvider>
  ) : app;

  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)}>
      <body className={`${geist.variable}  overscroll-none ${heading.variable}`}>
        {content}
      </body>
    </html>
  );
}
