"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { redirectToCheckout } from "@/components/upgrade-button";
import { useAuth } from "@clerk/nextjs";

/**
 * Reads `?intent=upgrade` from the URL and auto-triggers Dodo checkout
 * for org admins. Clears the localStorage flag and query param afterward.
 * Renders nothing visible.
 */
export function AutoCheckoutTrigger() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { orgRole } = useAuth();
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    if (searchParams.get("intent") !== "upgrade") return;
    if (orgRole !== "org:admin") return;

    triggered.current = true;

    // Clean up the localStorage flag
    try {
      localStorage.removeItem("upgrade_intent");
    } catch {}

    // Clean the URL so a refresh doesn't re-trigger
    router.replace("/dashboard/billing", { scroll: false });

    // Fire the checkout
    redirectToCheckout().catch(() => {
      /* user stays on billing page if checkout fails */
    });
  }, [searchParams, orgRole, router]);

  return null;
}
