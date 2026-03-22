import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StepList } from "@/components/step-list";

const FRAMER_DOCS_URL =
  "https://www.framer.com/developers/server-api-quick-start";

const contentClassName =
  "max-w-lg gap-5 rounded-[28px] border border-fresco-divider bg-[var(--color-fresco-app-bg)] p-6 shadow-2xl";
const textClassName = "text-sm leading-6 text-fresco-description";
const codeClassName =
  "rounded-md bg-fresco-surface-muted px-1.5 py-0.5 text-[13px] text-fresco-title";
const triggerClassName =
  "shrink-0 text-[11px] font-semibold tracking-[0.08em] underline decoration-dotted cursor-pointer";

function DialogFooter() {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-fresco-divider pt-4">
      <Link
        className="text-sm font-medium text-fresco-tint underline underline-offset-3"
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
  );
}

/** Help dialog explaining how to find the Framer project URL or ID. */
export function ProjectUrlHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className={triggerClassName}>How to find it</div>
      </DialogTrigger>
      <DialogContent className={contentClassName}>
        <DialogHeader className="pr-8">
          <DialogTitle className="font-heading text-2xl leading-tight text-fresco-title">
            Find your Framer project URL or ID
          </DialogTitle>
          <DialogDescription className={textClassName}>
            Framer Bot accepts either the full project URL or the raw project ID
            from the same Framer project.
          </DialogDescription>
        </DialogHeader>
        <StepList
          steps={[
            "Open the Framer project you want this team to manage.",
            <>
              Copy the project link from the browser address bar or use
              Framer&apos;s Copy Project Link action.
            </>,
            "Paste the full URL here. If you prefer the raw ID, use the final segment from that project URL.",
          ]}
        />
        <p className={textClassName}>
          Example:{" "}
          <code className={codeClassName}>
            https://framer.com/projects/My-Site--abc123
          </code>{" "}
          becomes <code className={codeClassName}>abc123</code>.
        </p>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}

/** Help dialog explaining how to get a Framer Server API key. */
export function ApiKeyHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className={triggerClassName}>How to get it</div>
      </DialogTrigger>
      <DialogContent className={contentClassName}>
        <DialogHeader className="pr-8">
          <DialogTitle className="font-heading text-2xl leading-tight text-fresco-title">
            Get your Framer Server API key
          </DialogTitle>
          <DialogDescription className={textClassName}>
            Server API keys are created per project, so use the same Framer
            project you entered above.
          </DialogDescription>
        </DialogHeader>
        <StepList
          steps={[
            "Open that Framer project.",
            "Go to Site Settings, then open the General section.",
            "Create a Server API key for the project and copy it to a safe place.",
            "Paste the key here to validate the connection.",
          ]}
        />
        <p className={textClassName}>
          Treat this key like a password. Anyone with it can access the project
          through Framer&apos;s Server API.
        </p>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
