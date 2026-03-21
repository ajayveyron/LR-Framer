import "server-only";

import { anyApi } from "convex/server";

import { fetchProductQuery } from "@/lib/convex";
import { logError } from "@/lib/logger";

interface AgentMemory {
  id: string;
  category: "preference" | "correction" | "workflow";
  content: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Load all agent memories for a user. Returns empty array on failure (fail-open).
 */
export async function loadAgentMemories(
  organizationId: string,
  userId: string,
): Promise<AgentMemory[]> {
  try {
    const memories = (await fetchProductQuery(
      anyApi.agentMemory.listMemories,
      {
        clerkOrganizationId: organizationId,
        clerkUserId: userId,
      },
    )) as AgentMemory[];
    return memories;
  } catch (error) {
    logError("ai.memory.load.failed", error, { organizationId, userId });
    return [];
  }
}

/**
 * Format memories into a system prompt block.
 * Returns empty string if no memories exist.
 */
export function formatMemoriesForPrompt(memories: AgentMemory[]): string {
  if (memories.length === 0) return "";

  const grouped: Record<string, string[]> = {
    preference: [],
    correction: [],
    workflow: [],
  };

  for (const m of memories) {
    grouped[m.category]?.push(m.content);
  }

  const sections: string[] = [];

  if (grouped.preference.length > 0) {
    sections.push(
      `Preferences:\n${grouped.preference.map((c) => `- ${c}`).join("\n")}`,
    );
  }
  if (grouped.correction.length > 0) {
    sections.push(
      `Corrections (things the user has corrected you on before):\n${grouped.correction.map((c) => `- ${c}`).join("\n")}`,
    );
  }
  if (grouped.workflow.length > 0) {
    sections.push(
      `Workflows & habits:\n${grouped.workflow.map((c) => `- ${c}`).join("\n")}`,
    );
  }

  return `USER MEMORY — things you've learned about this user from past conversations. Apply these automatically without mentioning them unless asked:\n${sections.join("\n\n")}`;
}
