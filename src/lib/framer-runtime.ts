import { AsyncLocalStorage } from "node:async_hooks";

import { appConfig } from "@/lib/app-config";
import { getLegacyFramerApiKey } from "@/lib/env";

export interface FramerRuntimeContext {
  apiKey: string;
  collectionId?: string | null;
  collectionName: string;
  projectId: string;
}

const framerRuntimeStorage = new AsyncLocalStorage<FramerRuntimeContext>();

export function runWithFramerRuntimeContext<T>(
  context: FramerRuntimeContext,
  callback: () => Promise<T>,
) {
  return framerRuntimeStorage.run(context, callback);
}

export function getFramerRuntimeContext(): FramerRuntimeContext {
  const runtimeContext = framerRuntimeStorage.getStore();
  if (runtimeContext) {
    return runtimeContext;
  }

  return {
    apiKey: getLegacyFramerApiKey(),
    collectionName: appConfig.framer.collectionName,
    projectId: appConfig.framer.projectId,
  };
}
