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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Link from "next/link";
import type { FramerCollectionOption } from "@/lib/product-types";

const fieldClassName = "grid gap-2";
const helperTextClassName =
  "text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]";
const formControlClassName =
  `!border-transparent !bg-[#2B2B2B] !text-[color:var(--framer-fresco-settingsText-color)] !shadow-none !rounded-lg placeholder:!text-[rgba(255,255,255,0.3)] focus-visible:!border-[var(--framer-fresco-tint-color)] focus-visible:!shadow-none focus-visible:!outline-none h-10 rounded-lg px-3 text-sm leading-[1.4]`;
const labelRowClassName = "flex items-center justify-between gap-3";
const helpTriggerClassName =
  "shrink-0 text-[11px] font-semibold tracking-[0.08em] underline decoration-dotted text-[color:var(--framer-fresco-panelSubtitle-color)] hover:text-[color:var(--framer-fresco-panelTitle-color)] transition-colors cursor-pointer";
const helpDialogContentClassName =
  "max-w-lg gap-5 rounded-[28px] border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-background-color)] p-6 shadow-2xl";
const helpDialogTextClassName =
  "text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]";
const helpDialogListClassName =
  "grid gap-3 pl-5 text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]";
const helpCodeClassName =
  "rounded-md bg-[var(--framer-app-surface-muted-color)] px-1.5 py-0.5 text-[13px] text-[color:var(--framer-fresco-panelTitle-color)]";

const FRAMER_DOCS_URL =
  "https://www.framer.com/developers/server-api-quick-start";

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
            <h2 className="font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[22px] font-bold tracking-[-0.8px] leading-[1.2] text-[color:var(--framer-fresco-panelTitle-color)]">
              Framer connection
            </h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#2B2B2B] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--framer-fresco-panelSubtitle-color)]">
            <ShieldCheckIcon className="size-3.5" />
            Read only
          </span>
        </div>
        <dl className="grid gap-3 mt-2 text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
          <div className="grid gap-1">
            <dt className="font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]">
              Project
            </dt>
            <dd className="break-all text-[color:var(--framer-fresco-panelTitle-color)]">
              {initialProjectInput}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]">
              Default collection
            </dt>
            <dd className="text-[color:var(--framer-fresco-panelTitle-color)]">
              {initialCollectionName}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]">
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
        <h2 className="font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[22px] font-bold tracking-[-0.8px] leading-[1.2] text-[color:var(--framer-fresco-panelTitle-color)]">
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
            <Label className="font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]" htmlFor="settings-project-input">Framer project URL or ID</Label>
            <Dialog>
              <DialogTrigger asChild>
                <div className={helpTriggerClassName}>How to find it</div>
              </DialogTrigger>
              <DialogContent className={helpDialogContentClassName}>
                <DialogHeader className="pr-8">
                  <DialogTitle className="font-heading text-2xl leading-tight text-[color:var(--framer-fresco-panelTitle-color)]">
                    Find your Framer project URL or ID
                  </DialogTitle>
                  <DialogDescription className={helpDialogTextClassName}>
                    Framer Bot accepts either the full project URL or the raw
                    project ID from the same Framer project.
                  </DialogDescription>
                </DialogHeader>
                <ol className={helpDialogListClassName}>
                  <li>
                    Open the Framer project you want this team to manage.
                  </li>
                  <li>
                    Copy the project link from the browser address bar or use
                    Framer&apos;s Copy Project Link action.
                  </li>
                  <li>
                    Paste the full URL here. If you prefer the raw ID, use the
                    final segment from that project URL.
                  </li>
                </ol>
                <p className={helpDialogTextClassName}>
                  Example:{" "}
                  <code className={helpCodeClassName}>
                    https://framer.com/projects/My-Site--abc123
                  </code>{" "}
                  becomes{" "}
                  <code className={helpCodeClassName}>abc123</code>.
                </p>
                <div className="flex items-center justify-between gap-3 border-t border-[var(--framer-fresco-panelDivider-color)] pt-4">
                  <Link
                    className="text-sm font-medium text-[color:var(--framer-fresco-tint-color)] underline underline-offset-3"
                    href={FRAMER_DOCS_URL}
                    target="_blank"
                  >
                    Open Framer docs
                  </Link>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Close
                    </Button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
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
            <Label className="font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]" htmlFor="settings-api-key">Framer Server API key</Label>
            <Dialog>
              <DialogTrigger asChild>
                <div className={helpTriggerClassName}>How to get it</div>
              </DialogTrigger>
              <DialogContent className={helpDialogContentClassName}>
                <DialogHeader className="pr-8">
                  <DialogTitle className="font-heading text-2xl leading-tight text-[color:var(--framer-fresco-panelTitle-color)]">
                    Get your Framer Server API key
                  </DialogTitle>
                  <DialogDescription className={helpDialogTextClassName}>
                    Server API keys are created per project, so use the same
                    Framer project you entered above.
                  </DialogDescription>
                </DialogHeader>
                <ol className={helpDialogListClassName}>
                  <li>Open that Framer project.</li>
                  <li>Go to Site Settings, then open the General section.</li>
                  <li>
                    Create a Server API key for the project and copy it to a
                    safe place.
                  </li>
                  <li>Paste the key here to validate the connection.</li>
                </ol>
                <p className={helpDialogTextClassName}>
                  Treat this key like a password. Anyone with it can access the
                  project through Framer&apos;s Server API.
                </p>
                <div className="flex items-center justify-between gap-3 border-t border-[var(--framer-fresco-panelDivider-color)] pt-4">
                  <Link
                    className="text-sm font-medium text-[color:var(--framer-fresco-tint-color)] underline underline-offset-3"
                    href={FRAMER_DOCS_URL}
                    target="_blank"
                  >
                    Open Framer docs
                  </Link>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Close
                    </Button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
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
          <Label className="font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]" htmlFor="settings-collection-select">Default collection</Label>
          <Select onValueChange={setSelectedCollectionId} value={selectedCollectionId}>
            <SelectTrigger
              className="!border-transparent !bg-[#2B2B2B] !text-[color:var(--framer-fresco-settingsText-color)] !shadow-none !rounded-lg placeholder:!text-[rgba(255,255,255,0.3)] focus-visible:!border-[var(--framer-fresco-tint-color)] focus-visible:!shadow-none focus-visible:!outline-none h-10 rounded-lg px-3 text-sm leading-[1.4]"
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
            This only sets the default dashboard collection. Contributors can
            switch between all validated user-managed collections from the top
            bar.
          </p>
        </div>

        {error ? <div className="rounded-none border border-[var(--framer-app-danger-callout-border-color)] bg-[var(--framer-app-danger-callout-background-color)] px-4 py-3 text-sm text-[color:var(--framer-app-danger-callout-text-color)]">{error}</div> : null}

        <div className="flex flex-wrap gap-3">
          <Button
            className="bg-[var(--framer-app-primary-surface-color)] text-[color:var(--framer-app-primary-surface-text-color)] shadow-[0_10px_28px_rgba(0,0,0,0.2)] hover:bg-[var(--framer-app-primary-surface-hover-color)] h-10 px-4 text-sm font-semibold"
            disabled={isValidating}
            onClick={handleValidateConnection}
            type="button"
            variant="secondary"
          >
            {isValidating ? "Validating..." : "Validate connection"}
          </Button>
          <Button
            className="h-10 gap-2 px-4 text-sm font-semibold"
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
