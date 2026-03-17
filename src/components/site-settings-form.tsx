"use client";

import { useRouter } from "next/navigation";
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
import type { FramerCollectionOption } from "@/lib/product-types";

const fieldClassName = "grid gap-2";
const helperTextClassName =
  "text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]";
const formControlClassName =
  "h-auto min-h-[52px] rounded-2xl border px-4 py-3.5 text-[15px] leading-[1.45]";

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
  const router = useRouter();
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
      <section className="framer-subtle-panel grid gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="framer-kicker">Workspace</span>
            <h2 className="mt-3 font-heading text-3xl leading-tight text-[color:var(--framer-fresco-panelTitle-color)]">
              Framer connection
            </h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
            <ShieldCheckIcon className="size-3.5" />
            Read only
          </span>
        </div>
        <p className={helperTextClassName}>
          Contributors can see the active project and collection here, but only
          admins can rotate the API key or change the CMS collection.
        </p>
        <dl className="grid gap-3 text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
          <div className="grid gap-1">
            <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
              Project
            </dt>
            <dd className="break-all text-[color:var(--framer-fresco-panelTitle-color)]">
              {initialProjectInput}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
              Collection
            </dt>
            <dd className="text-[color:var(--framer-fresco-panelTitle-color)]">
              {initialCollectionName}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
              API key
            </dt>
            <dd className="text-[color:var(--framer-fresco-panelTitle-color)]">
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
        router.refresh();
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
    <section className="framer-subtle-panel grid gap-5 p-5">
      <div>
        <span className="framer-kicker">Workspace</span>
        <h2 className="mt-3 font-heading text-3xl leading-tight text-[color:var(--framer-fresco-panelTitle-color)]">
          Framer connection
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--framer-fresco-panelDescription-color)]">
          Rotate the server API key, repoint the project, or move this team to a
          different user-managed CMS collection without going through onboarding
          again.
        </p>
      </div>

      <form
        autoComplete="off"
        className="grid gap-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <div
          aria-hidden="true"
          className="absolute -m-px h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]"
        >
          <input autoComplete="username" name="username" tabIndex={-1} type="text" />
          <input
            autoComplete="current-password"
            name="password"
            tabIndex={-1}
            type="password"
          />
        </div>

        <div className={fieldClassName}>
          <Label htmlFor="settings-project-input">Framer project URL or ID</Label>
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
          <Label htmlFor="settings-api-key">Framer Server API key</Label>
          <Input
            autoCapitalize="none"
            autoComplete="new-password"
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
          <p className={helperTextClassName}>
            Enter a new API key only when you want to rotate credentials. Leave
            it empty to keep the existing key on the server.
          </p>
        </div>

        <div className={fieldClassName}>
          <Label htmlFor="settings-collection-select">CMS collection</Label>
          <Select onValueChange={setSelectedCollectionId} value={selectedCollectionId}>
            <SelectTrigger
              className={formControlClassName}
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
          <p className={helperTextClassName}>
            Validate the connection after changing the project or key to refresh
            the available user-managed collections from Framer.
          </p>
        </div>

        {error ? <div className="framer-callout-danger">{error}</div> : null}

        <div className="flex flex-wrap gap-3">
          <Button
            className="framer-primary-action h-11 px-4 text-sm font-semibold"
            disabled={isValidating}
            onClick={handleValidateConnection}
            type="button"
            variant="secondary"
          >
            {isValidating ? "Validating..." : "Validate connection"}
          </Button>
          <Button
            className="h-11 gap-2.5 px-4 text-sm font-semibold"
            disabled={isSaving}
            onClick={handleSaveChanges}
            type="button"
          >
            <SaveIcon className="size-4" />
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </section>
  );
}
