import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "@/app/globals.css";
import { NotificationProvider } from "@/components/notification-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://framerbot.com"),
  title: {
    default: "Framer Bot | Run Framer CMS with your team",
    template: "%s | Framer Bot",
  },
  description:
    "Empower your marketing team to manage Framer CMS content effortlessly. An AI-native, unified workspace for teams to write, review, and ship updates without needing the Framer editor.",
  keywords: ["Framer", "Framer CMS", "Content Management System", "Framer Editor", "AI Workspace", "Team Collaboration", "Vercel", "Web Design"],
  authors: [{ name: "Framer Bot Team", url: "https://framerbot.com" }],
  creator: "Framer Bot Team",
  publisher: "Framer Bot",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Framer Bot | Run Framer CMS outside the editor",
    description:
      "Give your team a shared workspace for Framer CMS content. Write, review, and utilize AI-assisted batch updates securely without full editor access.",
    url: "https://framerbot.com",
    siteName: "Framer Bot",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Framer Bot — Run Framer CMS with your team",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Framer Bot | Framer CMS Management",
    description: "Manage your Framer CMS rapidly with your team, strictly outside the editor using AI.",
    creator: "@framerbot",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
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
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" appearance={{ baseTheme: dark }}>
      {app}
    </ClerkProvider>
  ) : app;

  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="overscroll-none font-sans">
        {content}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
