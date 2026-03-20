"use client";

import { Spinner } from "@/components/ui/spinner";

export function WorkspacePanelLoading({
  message = "Loading content...",
}: {
  message?: string;
}) {
  return (
    <div className="settings-section grid min-h-[280px] place-items-center">
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
    <div className="settings-section grid gap-4">
      <div className="grid gap-2">
        <h2 className="settings-heading">Unable to load this section</h2>
        <p className="text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
          {message}
        </p>
      </div>
      {action}
    </div>
  );
}
