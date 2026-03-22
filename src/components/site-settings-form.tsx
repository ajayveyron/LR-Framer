"use client";

import { useState, useTransition } from "react";

import { FloppyDisk as SaveIcon, ShieldCheck as ShieldCheckIcon } from "@phosphor-icons/react";

import { useNotify } from "@/components/notification-provider";
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
import { ProjectUrlHelpDialog, ApiKeyHelpDialog } from "@/components/framer-help-dialogs";
import type { FramerCollectionOption } from "@/lib/product-types";

const fieldClassName = "grid gap-2";
const helperTextClassName =
  "text-sm leading-6 text-fresco-description";
const formControlClassName =
  `!border-transparent !bg-[#2B2B2B] !text-fresco-text !shadow-none !rounded-lg placeholder:!text-[rgba(255,255,255,0.3)] focus-visible:!border-fresco-tint focus-visible:!shadow-none focus-visible:!outline-none h-10 rounded-lg px-3 text-sm leading-[1.4]`;
const labelRowClassName = "flex items-center justify-between gap-3";

function getCollectionLabel(
  collections: FramerCollectionOption[],
  collectionId: string,
  fallbackName: string,
) {
  return (
    collections.find((collection) => collection.id === collectionId)?.name ??
    fallbackName
  );
}

export function SiteSettingsForm({
  canManage,
  initialCollectionId,
  initialCollectionName,
  initialProjectInput,
}: {
  canManage: boolean;
  initialCollectionId: string;
  initialCollectionName: string;
  initialProjectInput: string;
}) {
  const notify = useNotify();
  const [projectInput, setProjectInput] = useState(initialProjectInput);
  const [apiKey, setApiKey] = useState("");
  const [collections, setCollections] = useState<FramerCollectionOption[]>(
    initialCollectionId && initialCollectionName
      ? [{ id: initialCollectionId, name: initialCollectionName }]
      : [],
  );
  const [selectedCollectionId, setSelectedCollectionId] =
    useState(initialCollectionId);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, startValidation] = useTransition();
  const [isSaving, startSaving] = useTransition();

  if (!canManage) {
    return (
      <section className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111111] p-6 grid gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-sans text-[22px] font-bold tracking-[-0.8px] leading-[1.2] text-fresco-title">
              Framer connection
            </h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#2B2B2B] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-fresco-subtitle">
            <ShieldCheckIcon className="size-3.5" />
            Read only
          </span>
        </div>
        <dl className="grid gap-3 mt-2 text-sm text-fresco-description">
          <div className="grid gap-1">
            <dt className="font-sans text-[12px] font-medium leading-[1.6] text-fresco-title">
              Project
            </dt>
            <dd className="break-all text-fresco-title">
              {initialProjectInput}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="font-sans text-[12px] font-medium leading-[1.6] text-fresco-title">
              Default collection
            </dt>
            <dd className="text-fresco-title">
              {initialCollectionName}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="font-sans text-[12px] font-medium leading-[1.6] text-fresco-title">
              API key
            </dt>
            <dd className="text-fresco-title">
              Stored securely on the server
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  function handleValidateConnection() {
    if (!projectInput.trim()) {
      setError("Framer project URL or ID is required.");
      return;
    }

    setError(null);
    startValidation(async () => {
      try {
        const response = await fetch("/api/dashboard/settings/framer/validate", {
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
          projectUrl?: string;
        };

        if (!response.ok || !data.collections) {
          throw new Error(data.error ?? "Framer validation failed.");
        }

        setCollections(data.collections);
        if (!data.collections.some((entry) => entry.id === selectedCollectionId)) {
          setSelectedCollectionId(data.collections[0]?.id ?? "");
        }
        if (data.projectUrl) {
          setProjectInput(data.projectUrl);
        }
        notify.success("Framer connection validated.");
      } catch (nextError) {
        setCollections(
          initialCollectionId && initialCollectionName
            ? [{ id: initialCollectionId, name: initialCollectionName }]
            : [],
        );
        setSelectedCollectionId(initialCollectionId);
        const message =
          nextError instanceof Error
            ? nextError.message
            : "Framer validation failed.";
        setError(message);
        notify.error(message);
      }
    });
  }

  function handleSaveChanges() {
    if (!projectInput.trim()) {
      setError("Framer project URL or ID is required.");
      return;
    }

    if (!selectedCollectionId) {
      setError("Choose a CMS collection before saving.");
      return;
    }

    setError(null);
    startSaving(async () => {
      try {
        const response = await fetch("/api/dashboard/settings/framer/save", {
          body: JSON.stringify({
            apiKey,
            collectionId: selectedCollectionId,
            projectInput,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const data = (await response.json()) as {
          collectionId?: string;
          collectionName?: string;
          error?: string;
          projectUrl?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Framer settings could not be saved.");
        }

        setApiKey("");
        if (data.projectUrl) {
          setProjectInput(data.projectUrl);
        }
        if (data.collectionId && data.collectionName) {
          setCollections([{ id: data.collectionId, name: data.collectionName }]);
          setSelectedCollectionId(data.collectionId);
        }
        notify.success("Workspace settings updated.");
      } catch (nextError) {
        const message =
          nextError instanceof Error
            ? nextError.message
            : "Framer settings could not be saved.";
        setError(message);
        notify.error(message);
      }
    });
  }

  return (
    <section className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111111] p-6 grid gap-5">
      <div>
        <h2 className="font-sans text-[22px] font-bold tracking-[-0.8px] leading-[1.2] text-fresco-title">
          Framer connection
        </h2>
      </div>

      <form
        autoComplete="off"
        className="grid gap-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className={fieldClassName}>
          <div className={labelRowClassName}>
            <Label className="font-sans text-[12px] font-medium leading-[1.6] text-fresco-title" htmlFor="settings-project-input">Framer project URL or ID</Label>
            <ProjectUrlHelpDialog />
          </div>
          <Input
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className={formControlClassName}
            data-1p-ignore="true"
            data-form-type="other"
            data-lpignore="true"
            id="settings-project-input"
            inputMode="url"
            name="framer-project-input"
            onChange={(event) => setProjectInput(event.target.value)}
            placeholder="https://framer.com/projects/... or project ID"
            spellCheck={false}
            value={projectInput}
          />
        </div>

        <div className={fieldClassName}>
          <div className={labelRowClassName}>
            <Label className="font-sans text-[12px] font-medium leading-[1.6] text-fresco-title" htmlFor="settings-api-key">Framer Server API key</Label>
            <ApiKeyHelpDialog />
          </div>
          <Input
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className={formControlClassName}
            data-1p-ignore="true"
            data-form-type="other"
            data-lpignore="true"
            id="settings-api-key"
            name="framer-server-api-key"
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Leave blank to keep the current stored key"
            spellCheck={false}
            type="password"
            value={apiKey}
          />
        </div>

        <div className={fieldClassName}>
          <Label className="font-sans text-[12px] font-medium leading-[1.6] text-fresco-title" htmlFor="settings-collection-select">Default collection</Label>
          <Select onValueChange={setSelectedCollectionId} value={selectedCollectionId}>
            <SelectTrigger
              className="!border-transparent !bg-[#2B2B2B] !text-fresco-text !shadow-none !rounded-lg placeholder:!text-[rgba(255,255,255,0.3)] focus-visible:!border-fresco-tint focus-visible:!shadow-none focus-visible:!outline-none h-10 rounded-lg px-3 text-sm leading-[1.4]"
              id="settings-collection-select"
            >
              <SelectValue
                placeholder={getCollectionLabel(
                  collections,
                  selectedCollectionId,
                  initialCollectionName,
                )}
              />
            </SelectTrigger>
            <SelectContent>
              {collections.map((collection) => (
                <SelectItem key={collection.id} value={collection.id}>
                  {collection.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* <p className={helperTextClassName}>
            This only sets the default dashboard collection. Contributors can
            switch between all validated user-managed collections from the top
            bar.
          </p> */}
        </div>

        {error ? <div className="rounded-none border border-fresco-danger-callout-border bg-fresco-danger-callout-bg px-4 py-3 text-sm text-fresco-danger-callout-text">{error}</div> : null}

        <div className="flex flex-wrap gap-3 mt-4">
          <Button
            disabled={isValidating}
            onClick={handleValidateConnection}
            type="button"
            variant="outline"
          >
            {isValidating ? "Validating..." : "Validate connection"}
          </Button>
          <Button
            disabled={isSaving}
            onClick={handleSaveChanges}
            type="button"
            variant="default"
          >
            <SaveIcon className="size-4" />
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </section>
  );
}
