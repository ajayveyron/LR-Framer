"use client";

import { useCallback, useState } from "react";

import { CreditCard, SpinnerGap } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Shared checkout redirect logic
// ---------------------------------------------------------------------------

export async function redirectToCheckout(): Promise<void> {
  const res = await fetch("/api/billing/checkout", { method: "POST" });
  const json = await res.json();
  if (json.url) {
    window.open(json.url, "_blank", "noopener,noreferrer");
  } else {
    throw new Error(json.error ?? "No checkout URL returned");
  }
}

// ---------------------------------------------------------------------------
// Reusable upgrade button
// ---------------------------------------------------------------------------

interface UpgradeButtonProps {
  /** Button label — defaults to "Upgrade to Pro" */
  label?: string;
  /** Extra classes merged onto the <Button> */
  className?: string;
  /** shadcn size variant */
  size?: "sm" | "default" | "lg" | "icon-sm" | "icon-lg";
}

export function UpgradeButton({
  label = "Upgrade to Pro",
  className = "",
  size = "sm",
}: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      await redirectToCheckout();
    } catch {
      /* user stays on page */
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Button
      size={size}
      className={`gap-2 bg-fresco-button-primary text-fresco-button-primary-text shadow-[0_10px_28px_rgba(0,0,0,0.2)] hover:bg-fresco-button-primary-hover ${className}`.trim()}
      disabled={loading}
      onClick={handleClick}
    >
      {loading ? (
        <SpinnerGap className="size-4 animate-spin" />
      ) : (
        <CreditCard className="size-4" />
      )}
      {label}
    </Button>
  );
}
