import { createVertex } from "@ai-sdk/google-vertex";
import { streamText } from "ai";

type ChunkSummary = {
  type: string;
  text?: string;
  id?: string;
  state?: string;
};

const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
const location = process.env.GOOGLE_CLOUD_LOCATION?.trim();
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim();
const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const privateKeyId = process.env.GOOGLE_PRIVATE_KEY_ID?.trim();
const modelId = process.env.AI_REASONING_TEST_MODEL?.trim() || "gemini-3.1-pro-preview";
const thinkingLevel =
  process.env.AI_REASONING_TEST_LEVEL?.trim() || "low";

if (!project || !location) {
  console.error(
    "Missing GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_LOCATION in the current shell.",
  );
  process.exit(1);
}

function createProvider() {
  const googleAuthOptions =
    clientEmail && privateKey
      ? {
          credentials: {
            type: "service_account" as const,
            project_id: project,
            client_email: clientEmail,
            private_key: privateKey,
            private_key_id: privateKeyId,
          },
        }
      : undefined;

  return createVertex({
    project,
    location,
    googleAuthOptions,
  });
}

async function collectFullStream() {
  const provider = createProvider();
  const result = streamText({
    model: provider(modelId),
    system:
      "You are a diagnostic assistant. Think through the task and then answer briefly.",
    prompt:
      "Compute 37 multiplied by 19, then give a one-sentence explanation of the arithmetic approach you used.",
    providerOptions: {
      vertex: {
        thinkingConfig: {
          thinkingLevel,
        },
      },
    },
  });

  const partCounts = new Map<string, number>();
  const reasoningParts: ChunkSummary[] = [];
  const textParts: ChunkSummary[] = [];

  for await (const part of result.fullStream) {
    partCounts.set(part.type, (partCounts.get(part.type) ?? 0) + 1);

    if (part.type === "reasoning-delta") {
      reasoningParts.push({
        type: part.type,
        text: part.text,
      });
    }

    if (part.type === "text-delta") {
      textParts.push({
        type: part.type,
        text: part.text,
      });
    }
  }

  const reasoningText = await result.reasoningText;
  const text = await result.text;

  return {
    partCounts,
    reasoningParts,
    textParts,
    reasoningText,
    text,
  };
}

async function collectUiStream() {
  const provider = createProvider();
  const result = streamText({
    model: provider(modelId),
    system:
      "You are a diagnostic assistant. Think through the task and then answer briefly.",
    prompt:
      "Compute 37 multiplied by 19, then give a one-sentence explanation of the arithmetic approach you used.",
    providerOptions: {
      vertex: {
        thinkingConfig: {
          thinkingLevel,
        },
      },
    },
  });

  const uiChunks: ChunkSummary[] = [];
  const chunkCounts = new Map<string, number>();

  for await (const chunk of result.toUIMessageStream({
    sendReasoning: true,
    sendSources: true,
  })) {
    chunkCounts.set(chunk.type, (chunkCounts.get(chunk.type) ?? 0) + 1);

    if (
      chunk.type === "reasoning-delta" ||
      chunk.type === "reasoning-start" ||
      chunk.type === "reasoning-end" ||
      chunk.type === "text-delta"
    ) {
      uiChunks.push({
        type: chunk.type,
        text: "delta" in chunk ? chunk.delta : undefined,
        id: "id" in chunk ? chunk.id : undefined,
      });
    }
  }

  return {
    chunkCounts,
    uiChunks,
  };
}

function printCounts(label: string, counts: Map<string, number>) {
  console.log(`\n${label}`);
  for (const [type, count] of [...counts.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    console.log(`- ${type}: ${count}`);
  }
}

function printSample(label: string, items: ChunkSummary[], limit = 8) {
  console.log(`\n${label}`);

  if (items.length === 0) {
    console.log("- none");
    return;
  }

  for (const item of items.slice(0, limit)) {
    const preview = item.text
      ? item.text.replace(/\s+/g, " ").trim().slice(0, 160)
      : "";
    console.log(
      `- ${item.type}${item.id ? ` (${item.id})` : ""}${preview ? ` :: ${preview}` : ""}`,
    );
  }
}

async function main() {
  console.log(
    `Checking reasoning stream with model=${modelId} thinkingLevel=${thinkingLevel}`,
  );

  const full = await collectFullStream();
  printCounts("Full stream part counts", full.partCounts);
  printSample("Full stream reasoning parts", full.reasoningParts);
  printSample("Full stream text parts", full.textParts);

  console.log("\nFull stream final outputs");
  console.log(
    `- reasoningText length: ${full.reasoningText?.length ?? 0}`,
  );
  console.log(`- final text: ${full.text.replace(/\s+/g, " ").trim()}`);

  const ui = await collectUiStream();
  printCounts("UI stream chunk counts", ui.chunkCounts);
  printSample(
    "UI stream reasoning chunks",
    ui.uiChunks.filter((chunk) => chunk.type.startsWith("reasoning")),
  );
  printSample(
    "UI stream text chunks",
    ui.uiChunks.filter((chunk) => chunk.type === "text-delta"),
  );

  const hasFullReasoning =
    full.reasoningParts.length > 0 || (full.reasoningText?.length ?? 0) > 0;
  const hasUiReasoning = ui.uiChunks.some((chunk) =>
    chunk.type.startsWith("reasoning"),
  );

  console.log("\nSummary");
  console.log(`- fullStream reasoning present: ${hasFullReasoning}`);
  console.log(`- toUIMessageStream reasoning chunks present: ${hasUiReasoning}`);

  if (!hasFullReasoning || !hasUiReasoning) {
    console.error(
      "\nReasoning stream was not emitted in one or both stream formats.",
    );
    process.exit(2);
  }
}

main().catch((error) => {
  console.error("\nReasoning stream check failed.");
  console.error(error);
  process.exit(1);
});
