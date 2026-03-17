import { withConnection } from "framer-api";

import { AppError } from "@/lib/errors";
import type { FramerValidationResult } from "@/lib/product-types";

function normalizeProjectInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AppError("Project URL or ID is required.", 400);
  }

  return trimmed;
}

export function extractProjectId(projectInput: string) {
  const normalized = normalizeProjectInput(projectInput);
  if (/^[A-Za-z0-9]{16,}$/.test(normalized)) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    const queryCandidate =
      url.searchParams.get("projectId") ?? url.searchParams.get("id");
    if (queryCandidate && /^[A-Za-z0-9]{16,}$/.test(queryCandidate)) {
      return queryCandidate;
    }

    const pathSegments = url.pathname
      .split("/")
      .filter(Boolean)
      .flatMap((segment) => segment.split("-"));
    const candidate = [...pathSegments]
      .reverse()
      .find((segment) => /^[A-Za-z0-9]{16,}$/.test(segment));

    if (candidate) {
      return candidate;
    }
  } catch {
    // Fall through to the invalid input error below.
  }

  throw new AppError(
    "Paste a Framer project URL or project ID so FramerLink can validate the connection.",
    400,
  );
}

export async function validateFramerConnection(input: {
  apiKey: string;
  projectInput: string;
}): Promise<FramerValidationResult> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new AppError("Framer API key is required.", 400);
  }

  const projectId = extractProjectId(input.projectInput);
  const projectUrl = input.projectInput.trim();

  return withConnection(
    projectId,
    async (framer) => {
      const collections = (await framer.getCollections())
        .filter((collection) => collection.managedBy === "user")
        .map((collection) => ({
          id: collection.id,
          name: collection.name,
        }))
        .sort((left, right) => left.name.localeCompare(right.name));

      if (collections.length === 0) {
        throw new AppError(
          "This project does not have any user-managed CMS collections FramerLink can control.",
          400,
        );
      }

      return {
        collections,
        projectId,
        projectUrl,
      };
    },
    apiKey,
  );
}
