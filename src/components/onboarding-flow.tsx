"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useOrganizationList } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import {
  ProjectUrlHelpDialog,
  ApiKeyHelpDialog,
} from "@/components/framer-help-dialogs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  FramerCollectionOption,
  ProductOnboardingState,
  ProductSite,
} from "@/lib/product-types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Shared styles                                                      */
/* ------------------------------------------------------------------ */

const shellClassName =
  "min-h-screen min-h-dvh overflow-y-auto overscroll-none bg-[var(--background)] grid place-items-center p-4 sm:p-7";
const cardClassName =
  "w-full max-w-md rounded-xl border border-fresco-divider bg-fresco-panel p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)]";
const inputClassName =
  "border-fresco-input-border bg-fresco-input-bg text-fresco-text placeholder:text-fresco-description/40 focus-visible:border-fresco-input-active focus-visible:ring-2 focus-visible:ring-fresco-tint-dimmed h-11 rounded-lg border px-3.5 text-sm";
const errorClassName =
  "rounded-lg border border-fresco-danger-callout-border bg-fresco-danger-callout-bg px-4 py-2.5 text-sm text-fresco-danger-callout-text";
const primaryBtnClassName =
  "w-full bg-fresco-primary-surface text-fresco-primary-surface-text hover:bg-fresco-primary-surface-hover h-11 rounded-lg text-sm font-medium";

/* ------------------------------------------------------------------ */
/*  Step indicator                                                     */
/* ------------------------------------------------------------------ */

function StepDots({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i === current
              ? "w-5 bg-fresco-tint"
              : "w-1.5 bg-fresco-divider",
          )}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function OnboardingFlow({
  initialOnboardingState,
  initialOrganizationId,
  initialSite,
  suggestedSiteName,
}: {
  initialOnboardingState: ProductOnboardingState | null;
  initialOrganizationId: string | null;
  initialSite: ProductSite | null;
  suggestedSiteName: string;
}) {
  const router = useRouter();
  const { createOrganization, isLoaded, setActive } = useOrganizationList();

  /* ---- state ---- */
  const [organizationName, setOrganizationName] = useState(
    initialSite?.name ?? suggestedSiteName,
  );
  const [projectInput, setProjectInput] = useState(
    initialOnboardingState?.projectUrl ?? initialSite?.framerProjectUrl ?? "",
  );
  const [apiKey, setApiKey] = useState("");
  const [collections, setCollections] = useState<FramerCollectionOption[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(
    initialOnboardingState?.collectionId ??
      initialSite?.framerCollectionId ??
      "",
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [organizationError, setOrganizationError] = useState<string | null>(
    null,
  );
  const [isValidating, startValidation] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isCreatingOrganization, startOrganizationCreation] = useTransition();

  const organizationId = initialOrganizationId;
  const canValidate =
    projectInput.trim().length > 0 && apiKey.trim().length > 0;
  const canComplete =
    organizationId &&
    apiKey.trim().length > 0 &&
    projectInput.trim().length > 0 &&
    selectedCollectionId.length > 0 &&
    collections.length > 0;

  // Step: 0 = create team, 1 = connect framer
  const step = organizationId ? 1 : 0;
  const totalSteps = 2;

  /* ---- handlers ---- */

  function handleCreateOrganization() {
    if (!organizationName.trim()) {
      setOrganizationError("Give your team a name.");
      return;
    }
    if (!isLoaded || !createOrganization || !setActive) {
      setOrganizationError("Clerk is still loading. Try again in a second.");
      return;
    }
    setOrganizationError(null);
    startOrganizationCreation(async () => {
      try {
        const organization = await createOrganization({
          name: organizationName.trim(),
        });
        await setActive({ organization: organization.id });
        router.refresh();
      } catch (error) {
        setOrganizationError(
          error instanceof Error
            ? error.message
            : "Could not create the team.",
        );
      }
    });
  }

  function handleValidateConnection() {
    if (!canValidate) return;
    setValidationError(null);
    startValidation(async () => {
      try {
        const response = await fetch("/api/onboarding/validate-framer", {
          body: JSON.stringify({ apiKey, projectInput }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = (await response.json()) as {
          collections?: FramerCollectionOption[];
          error?: string;
        };
        if (!response.ok || !data.collections) {
          throw new Error(data.error ?? "Framer validation failed.");
        }
        setCollections(data.collections);
        if (
          !data.collections.some((c) => c.id === selectedCollectionId)
        ) {
          setSelectedCollectionId(data.collections[0]?.id ?? "");
        }
      } catch (error) {
        setCollections([]);
        setSelectedCollectionId("");
        setValidationError(
          error instanceof Error ? error.message : "Validation failed.",
        );
      }
    });
  }

  function handleCompleteOnboarding() {
    if (!canComplete) return;
    setValidationError(null);
    startSaving(async () => {
      try {
        const response = await fetch("/api/onboarding/complete", {
          body: JSON.stringify({
            apiKey,
            collectionId: selectedCollectionId,
            projectInput,
            siteName: organizationName.trim() || suggestedSiteName,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(
            data.error ?? "Could not finish onboarding.",
          );
        }
        let destination = "/dashboard";
        try {
          if (localStorage.getItem("upgrade_intent") === "standard") {
            destination = "/dashboard/billing?intent=upgrade";
          }
        } catch {}
        router.push(destination);
        router.refresh();
      } catch (error) {
        setValidationError(
          error instanceof Error
            ? error.message
            : "Could not finish onboarding.",
        );
      }
    });
  }

  /* ---- render ---- */

  return (
    <section className={shellClassName}>
      <div className="flex flex-col items-center gap-8 w-full max-w-md">
        <BrandLogo height={32} />

        <div className={cardClassName}>
          {/* Step 0: Create team */}
          {step === 0 && (
            <div className="grid gap-5">
              <div className="text-center">
                <h1 className="text-lg font-semibold text-fresco-text">
                  Create a workspace
                </h1>
                <p className="mt-1 text-sm text-fresco-description">
                  Your team will collaborate here.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="organization-name">Workspace name</Label>
                <Input
                  className={inputClassName}
                  id="organization-name"
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Acme Team"
                  value={organizationName}
                />
              </div>

              {organizationError && (
                <div className={errorClassName}>{organizationError}</div>
              )}

              <Button
                className={primaryBtnClassName}
                disabled={isCreatingOrganization}
                onClick={handleCreateOrganization}
                type="button"
              >
                {isCreatingOrganization ? "Creating…" : "Continue"}
              </Button>
            </div>
          )}

          {/* Step 1: Connect Framer */}
          {step === 1 && (
            <form
              autoComplete="off"
              className="grid gap-5"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="text-center">
                <h1 className="text-lg font-semibold text-fresco-text">
                  Connect your Framer project
                </h1>
                <p className="mt-1 text-sm text-fresco-description">
                  Paste your API key and project URL.
                </p>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="project-input">Project URL or ID</Label>
                  <ProjectUrlHelpDialog />
                </div>
                <Input
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect="off"
                  className={inputClassName}
                  data-1p-ignore="true"
                  data-form-type="other"
                  data-lpignore="true"
                  id="project-input"
                  inputMode="url"
                  name="framer-project-input"
                  onChange={(e) => setProjectInput(e.target.value)}
                  placeholder="https://framer.com/projects/…"
                  spellCheck={false}
                  value={projectInput}
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="api-key">Server API key</Label>
                  <ApiKeyHelpDialog />
                </div>
                <Input
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect="off"
                  className={inputClassName}
                  data-1p-ignore="true"
                  data-form-type="other"
                  data-lpignore="true"
                  id="api-key"
                  name="framer-server-api-key"
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="ap_…"
                  spellCheck={false}
                  type="password"
                  value={apiKey}
                />
              </div>

              <Button
                className={cn(
                  primaryBtnClassName,
                  collections.length > 0 &&
                    "bg-fresco-surface-muted text-fresco-text hover:bg-fresco-surface-subtle",
                )}
                disabled={!canValidate || isValidating}
                onClick={handleValidateConnection}
                type="button"
              >
                {isValidating
                  ? "Validating…"
                  : collections.length > 0
                    ? "Re-validate"
                    : "Validate connection"}
              </Button>

              {collections.length > 0 && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="collection-select">
                      Default collection
                    </Label>
                    <Select
                      onValueChange={setSelectedCollectionId}
                      value={selectedCollectionId}
                    >
                      <SelectTrigger
                        className={inputClassName}
                        id="collection-select"
                      >
                        <SelectValue placeholder="Choose a collection" />
                      </SelectTrigger>
                      <SelectContent>
                        {collections.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className={primaryBtnClassName}
                    disabled={!canComplete || isSaving}
                    onClick={handleCompleteOnboarding}
                    type="button"
                  >
                    {isSaving ? "Finishing…" : "Open dashboard"}
                  </Button>
                </>
              )}

              {validationError && (
                <div className={errorClassName}>{validationError}</div>
              )}
            </form>
          )}
        </div>

        <StepDots current={step} total={totalSteps} />
      </div>
    </section>
  );
}
