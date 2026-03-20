import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { logError } from "@/lib/logger";

type SnapshotRecord<T> = {
  cachedAt: number;
  value: T;
};

type SnapshotFileShape<T> = {
  version: 1;
  entries: Record<string, SnapshotRecord<T>>;
};

const SNAPSHOT_FILE_PATH = join(
  process.cwd(),
  ".cache",
  "framer-dashboard-overviews.json",
);

async function ensureSnapshotDirectory() {
  await mkdir(dirname(SNAPSHOT_FILE_PATH), { recursive: true });
}

async function readSnapshotFile<T>(): Promise<SnapshotFileShape<T>> {
  try {
    const raw = await readFile(SNAPSHOT_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<SnapshotFileShape<T>>;
    if (parsed.version !== 1 || !parsed.entries || typeof parsed.entries !== "object") {
      return { version: 1, entries: {} };
    }

    return {
      version: 1,
      entries: parsed.entries,
    };
  } catch {
    return { version: 1, entries: {} };
  }
}

export async function readDashboardOverviewSnapshot<T>(key: string) {
  const file = await readSnapshotFile<T>();
  return file.entries[key] ?? null;
}

export async function writeDashboardOverviewSnapshot<T>(
  key: string,
  record: SnapshotRecord<T>,
) {
  try {
    await ensureSnapshotDirectory();
    const file = await readSnapshotFile<T>();
    file.entries[key] = record;

    const tempPath = `${SNAPSHOT_FILE_PATH}.tmp`;
    await writeFile(tempPath, JSON.stringify(file), "utf-8");
    await rename(tempPath, SNAPSHOT_FILE_PATH);
  } catch (error) {
    logError("framer.snapshot.write_failed", error, { key });
  }
}
