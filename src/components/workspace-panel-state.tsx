"use client";

import { Spinner } from "@/components/ui/spinner";

export function WorkspacePanelLoading({
  message = "Loading content...",
}: {
  message?: string;
}) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111111] p-6 grid min-h-[280px] place-items-center">
      <div className="flex items-center gap-3 text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
        <Spinner className="size-4" />
        <span>{message}</span>
      </div>
    </div>
  );
}

export function WorkspacePanelError({
  action,
  message,
}: {
  action?: React.ReactNode;
  message: string;
}) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111111] p-6 grid gap-4">
      <div className="grid gap-2">
        <h2 className="font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[22px] font-bold tracking-[-0.8px] leading-[1.2] text-[color:var(--framer-fresco-panelTitle-color)]">Unable to load this section</h2>
        <p className="text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
          {message}
        </p>
      </div>
      {action}
    </div>
  );
}
