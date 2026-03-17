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
  title: "FramerLink | Framer CMS Operations",
  description:
    "Hosted Framer CMS operations for one user-managed collection, with contributor access and preserved backend sync flows.",
  keywords: ["Framer", "CMS", "Dashboard", "FramerLink"],
  authors: [{ name: "FramerLink Team" }],
  openGraph: {
    title: "FramerLink | Framer CMS Operations",
    description: "Hosted Framer CMS operations for one user-managed collection, with contributor access and preserved backend sync flows.",
    type: "website",
    siteName: "FramerLink",
  },
  twitter: {
    card: "summary_large_image",
    title: "FramerLink | Framer CMS Operations",
    description: "Hosted Framer CMS operations for one user-managed collection, with contributor access and preserved backend sync flows.",
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
      <body className={`${geist.variable} ${heading.variable}`}>
        {content}
      </body>
    </html>
  );
}
