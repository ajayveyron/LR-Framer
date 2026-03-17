"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useOrganizationList } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
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

const FRAMER_DOCS_URL = "https://www.framer.com/developers/server-api-quick-start";
const shellClassName = "framer-shell";
const cardClassName = "framer-frame mx-auto w-full max-w-7xl";
const sectionClassName =
  "mt-7 grid gap-6 border-t border-[var(--framer-fresco-panelDivider-color)] pt-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]";
const formClassName = "framer-subtle-panel grid gap-4 p-5";
const primaryButtonClassName = "framer-primary-action";
const kickerClassName = "framer-kicker";
const copyTextClassName =
  "text-base leading-7 text-[color:var(--framer-fresco-panelDescription-color)]";
const helperTextClassName =
  "text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]";
const errorBannerClassName = "framer-callout-danger";
const fieldClassName = "grid gap-2";
const formControlClassName =
  "framer-form-control h-auto min-h-[52px] rounded-2xl border px-4 py-3.5 text-[15px] leading-[1.45]";

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
  const [organizationName, setOrganizationName] = useState(
    initialSite?.name ?? suggestedSiteName,
  );
  const [projectInput, setProjectInput] = useState(
    initialOnboardingState?.projectUrl ??
      initialSite?.framerProjectUrl ??
      "",
  );
  const [apiKey, setApiKey] = useState("");
  const [collections, setCollections] = useState<FramerCollectionOption[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(
    initialOnboardingState?.collectionId ??
      initialSite?.framerCollectionId ??
      "",
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [isValidating, startValidation] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isCreatingOrganization, startOrganizationCreation] = useTransition();

  const organizationId = initialOrganizationId;
  const canValidate = projectInput.trim().length > 0 && apiKey.trim().length > 0;
  const canComplete =
    organizationId &&
    apiKey.trim().length > 0 &&
    projectInput.trim().length > 0 &&
    selectedCollectionId.length > 0 &&
    collections.length > 0;

  function handleCreateOrganization() {
    if (!organizationName.trim()) {
      setOrganizationError("Give your team a name before continuing.");
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
            : "FramerLink could not create the team yet.",
        );
      }
    });
  }

  function handleValidateConnection() {
    if (!canValidate) {
      return;
    }

    setValidationError(null);
    startValidation(async () => {
      try {
        const response = await fetch("/api/onboarding/validate-framer", {
          body: JSON.stringify({
            apiKey,
            projectInput,
          }),
          headers: {
            "Content-Type": "application/json",
          },
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
        if (!data.collections.some((entry) => entry.id === selectedCollectionId)) {
          setSelectedCollectionId(data.collections[0]?.id ?? "");
        }
      } catch (error) {
        setCollections([]);
        setSelectedCollectionId("");
        setValidationError(
          error instanceof Error ? error.message : "Framer validation failed.",
        );
      }
    });
  }

  function handleCompleteOnboarding() {
    if (!canComplete) {
      return;
    }

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
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const data = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "FramerLink could not finish onboarding.");
        }

        router.push("/dashboard");
        router.refresh();
      } catch (error) {
        setValidationError(
          error instanceof Error
            ? error.message
            : "FramerLink could not finish onboarding.",
        );
      }
    });
  }

  return (
    <section className={shellClassName}>
      <div className={cardClassName}>
        <div className="max-w-3xl">
          <span className={kickerClassName}>FramerLink Setup</span>
          <h1 className="mt-3 font-heading text-[clamp(40px,7vw,76px)] leading-[0.98] tracking-[-0.04em] text-[color:var(--framer-fresco-panelTitle-color)]">
            Connect Framer once, then let contributors manage content here.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--framer-fresco-panelDescription-color)]">
            FramerLink only needs your Framer Server API key, the project URL or
            ID, and the CMS collection you want this team to manage.
          </p>
        </div>

        {!organizationId ? (
          <section className={sectionClassName}>
            <div>
              <span className={kickerClassName}>Step 1</span>
              <h2 className="mt-3 font-heading text-3xl leading-tight text-[color:var(--framer-fresco-panelTitle-color)]">
                Create your team
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--framer-fresco-panelDescription-color)]">
                This is the shared FramerLink space where admins and contributors
                will manage one Framer CMS collection.
              </p>
            </div>

            <div className={formClassName}>
              <div className={fieldClassName}>
                <Label htmlFor="organization-name">Team name</Label>
                <Input
                  className={formControlClassName}
                  id="organization-name"
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="Acme Content Team"
                  value={organizationName}
                />
              </div>
              {organizationError ? (
                <div className={errorBannerClassName}>{organizationError}</div>
              ) : null}
              <Button
                className={primaryButtonClassName}
                disabled={isCreatingOrganization}
                onClick={handleCreateOrganization}
                type="button"
              >
                {isCreatingOrganization ? "Creating team..." : "Create team"}
              </Button>
            </div>
          </section>
        ) : null}

        {organizationId ? (
          <section className={sectionClassName}>
            <div>
              <span className={kickerClassName}>Step 2</span>
              <h2 className="mt-3 font-heading text-3xl leading-tight text-[color:var(--framer-fresco-panelTitle-color)]">
                Validate your Framer connection
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--framer-fresco-panelDescription-color)]">
                Grab the Server API key from Framer Site Settings and paste the
                project URL or project ID from the same project.
              </p>
              <p className="mt-3 text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]">
                Need help? Follow the Framer docs:{" "}
                <Link
                  className="text-[color:var(--framer-fresco-tint-color)] underline underline-offset-3"
                  href={FRAMER_DOCS_URL}
                  target="_blank"
                >
                  Open the Server API guide
                </Link>
              </p>
            </div>

            <form
              autoComplete="off"
              className={formClassName}
              onSubmit={(event) => event.preventDefault()}
            >
              <div
                aria-hidden="true"
                className="absolute -m-px h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]"
              >
                <input
                  autoComplete="username"
                  name="username"
                  tabIndex={-1}
                  type="text"
                />
                <input
                  autoComplete="current-password"
                  name="password"
                  tabIndex={-1}
                  type="password"
                />
              </div>
              <div className={fieldClassName}>
                <Label htmlFor="project-input">Framer project URL or ID</Label>
                <Input
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect="off"
                  className={formControlClassName}
                  data-1p-ignore="true"
                  data-form-type="other"
                  data-lpignore="true"
                  id="project-input"
                  inputMode="url"
                  name="framer-project-input"
                  onChange={(event) => setProjectInput(event.target.value)}
                  placeholder="https://framer.com/projects/... or project ID"
                  spellCheck={false}
                  value={projectInput}
                />
              </div>

              <div className={fieldClassName}>
                <Label htmlFor="api-key">Framer Server API key</Label>
                <Input
                  autoCapitalize="none"
                  autoComplete="new-password"
                  autoCorrect="off"
                  className={formControlClassName}
                  data-1p-ignore="true"
                  data-form-type="other"
                  data-lpignore="true"
                  id="api-key"
                  name="framer-server-api-key"
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="ap_..."
                  spellCheck={false}
                  type="password"
                  value={apiKey}
                />
              </div>

              <Button
                className={primaryButtonClassName}
                disabled={!canValidate || isValidating}
                onClick={handleValidateConnection}
                type="button"
              >
                {isValidating ? "Validating..." : "Validate connection"}
              </Button>

              {collections.length > 0 ? (
                <div className={fieldClassName}>
                  <Label htmlFor="collection-select">User-managed collection</Label>
                  <Select
                    onValueChange={setSelectedCollectionId}
                    value={selectedCollectionId}
                  >
                    <SelectTrigger
                      className={formControlClassName}
                      id="collection-select"
                    >
                      <SelectValue placeholder="Choose a collection" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map((collection) => (
                        <SelectItem key={collection.id} value={collection.id}>
                          {collection.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className={helperTextClassName}>
                    FramerLink only supports one user-managed collection per team
                    in this phase.
                  </p>
                </div>
              ) : null}

              {validationError ? (
                <div className={errorBannerClassName}>{validationError}</div>
              ) : null}

              <Button
                className={primaryButtonClassName}
                disabled={!canComplete || isSaving}
                onClick={handleCompleteOnboarding}
                type="button"
              >
                {isSaving ? "Finishing setup..." : "Open dashboard"}
              </Button>
            </form>
          </section>
        ) : null}
      </div>
    </section>
  );
}
