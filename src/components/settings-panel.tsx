"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { SiteSettingsForm } from "@/components/site-settings-form";
import {
  WorkspacePanelError,
  WorkspacePanelLoading,
} from "@/components/workspace-panel-state";

type SettingsPanelData = {
  canManage: boolean;
  initialCollectionId: string;
  initialCollectionName: string;
  initialProjectInput: string;
};

type SettingsPanelState =
  | { status: "loading" }
  | { message: string; status: "error" }
  | { data: SettingsPanelData; status: "ready" };

export function SettingsPanel() {
  const [state, setState] = useState<SettingsPanelState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/dashboard/settings", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as SettingsPanelData & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Settings could not be loaded.");
        }

        setState({
          data: {
            canManage: data.canManage,
            initialCollectionId: data.initialCollectionId,
            initialCollectionName: data.initialCollectionName,
            initialProjectInput: data.initialProjectInput,
          },
          status: "ready",
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          message:
            error instanceof Error
              ? error.message
              : "Settings could not be loaded.",
          status: "error",
        });
      }
    }

    void load();

    return () => controller.abort();
  }, [reloadKey]);

  if (state.status === "loading") {
    return <WorkspacePanelLoading message="Loading settings..." />;
  }

  if (state.status === "error") {
    return (
      <WorkspacePanelError
        action={
          <div>
            <Button
              onClick={() => {
                setState({ status: "loading" });
                setReloadKey((current) => current + 1);
              }}
              type="button"
            >
              Retry
            </Button>
          </div>
        }
        message={state.message}
      />
    );
  }

  return (
    <SiteSettingsForm
      canManage={state.data.canManage}
      initialCollectionId={state.data.initialCollectionId}
      initialCollectionName={state.data.initialCollectionName}
      initialProjectInput={state.data.initialProjectInput}
    />
  );
}
