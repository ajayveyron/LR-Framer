/**
 * Numbered step list with circle indicators.
 * Reused across onboarding and settings help dialogs.
 */
export function StepList({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="grid gap-3 text-sm leading-6 text-fresco-description">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-fresco-divider bg-fresco-surface-muted text-[11px] font-semibold text-fresco-title">
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}
