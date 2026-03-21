"use client";

import { useState } from "react";

import {
  Lightning,
  Warning,
  XCircle,
  Spinner,
  ArrowSquareOut,
} from "@phosphor-icons/react";

import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { UpgradeButton } from "@/components/upgrade-button";
import {
  useBillingUsage,
  deriveMeterState,
  METER_COLORS,
  METER_BG_COLORS,
} from "@/lib/use-billing-usage";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded bg-[#2B2B2B]" />
        <div className="h-4 w-48 rounded bg-[#2B2B2B]" />
      </div>
      <div className="h-3 w-full rounded-full bg-[#2B2B2B]" />
      <div className="h-3 w-32 rounded bg-[#2B2B2B]" />
    </div>
  );
}

function ErrorFallback() {
  return (
    <div className="flex items-center gap-3 text-sm text-fresco-description">
      <XCircle className="h-5 w-5 shrink-0 text-fresco-error" />
      <span>Unable to load usage data right now.</span>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UsageMeter() {
  const { orgRole } = useAuth();
  const isAdmin = orgRole === "org:admin";
  const { data, loading, error } = useBillingUsage();
  const [actionLoading, setActionLoading] = useState(false);

  if (loading) return <LoadingSkeleton />;
  if (error || !data) return <ErrorFallback />;

  const state = deriveMeterState(data.percentUsed);
  const barColor = METER_COLORS[state];
  const barBg = METER_BG_COLORS[state];
  const hasSubscription = data.planName !== "Free";

  const cycleEnd = new Date(data.cycleEnd);
  const formattedRenewal = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(cycleEnd);

  // ---- action handlers ----

  async function handleManage() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = await res.json();
      if (json.url) window.open(json.url, "_blank", "noopener,noreferrer");
    } catch { /* swallow */ }
    finally { setActionLoading(false); }
  }

  return (
    <div className="grid gap-5">
      {/* ---- Meter section ---- */}
      <div className="grid gap-3">
        {/* Heading row */}
        <div className="flex items-center gap-2.5">
          {state === "exhausted" ? (
            <XCircle weight="fill" className="h-5 w-5 shrink-0" style={{ color: barColor }} />
          ) : state === "warning" ? (
            <Warning weight="fill" className="h-5 w-5 shrink-0" style={{ color: barColor }} />
          ) : (
            <Lightning weight="fill" className="h-5 w-5 shrink-0" style={{ color: barColor }} />
          )}
          <span
            className="text-sm font-medium"
            style={{ color: "var(--color-fresco-title)" }}
          >
            {state === "exhausted"
              ? "Your team has used all of this month\u2019s AI allowance"
              : `Your team has used ${data.percentUsed}% of this month\u2019s AI allowance`}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="h-2.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: barBg }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.min(data.percentUsed, 100)}%`,
              backgroundColor: barColor,
            }}
          />
        </div>

        {/* Meta line */}
        <div className="flex items-center justify-between text-xs text-fresco-description">
          <span>
            {data.planName} plan · Renews {formattedRenewal}
          </span>
          <span className="tabular-nums font-medium" style={{ color: barColor }}>
            {data.percentUsed}%
          </span>
        </div>
      </div>

      {/* ---- Admin-only subscription actions ---- */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-3 border-t border-[rgba(255,255,255,0.06)] pt-4">
          {hasSubscription ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={actionLoading}
              onClick={handleManage}
            >
              {actionLoading ? (
                <Spinner className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowSquareOut className="h-4 w-4" />
              )}
              Manage Subscription
            </Button>
          ) : (
            <UpgradeButton label="Subscribe to Standard" />
          )}
        </div>
      )}
    </div>
  );
}
