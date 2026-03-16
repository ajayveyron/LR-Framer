import process from "node:process";

const framer = await import("../src/lib/framer-core.ts");

function serializeError(error) {
  if (error && typeof error === "object") {
    return {
      name: "name" in error ? error.name : "Error",
      message: "message" in error ? error.message : "Unexpected server error.",
      status: "status" in error ? error.status : undefined,
      code: "code" in error ? error.code : undefined,
    };
  }

  return {
    name: "Error",
    message: typeof error === "string" ? error : "Unexpected server error.",
  };
}

async function readPayload() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

async function execute(action, payload) {
  switch (action) {
    case "getBlogMetadata":
      return framer.getBlogMetadata();
    case "getDashboardOverview":
      return framer.getDashboardOverview(payload.limit);
    case "listBlogPosts":
      return framer.listBlogPosts();
    case "getBlogPostById":
      return framer.getBlogPostById(payload.id);
    case "getEditorBootstrap":
      return framer.getEditorBootstrap(payload.id);
    case "createBlogPost":
      return framer.createBlogPost(payload.input, payload.actor);
    case "updateBlogPost":
      return framer.updateBlogPost(payload.id, payload.input, payload.actor);
    case "syncBridgePosts":
      return framer.syncBridgePosts(payload.inputs, payload.actor);
    case "removeBridgePosts":
      return framer.removeBridgePosts(payload.inputs, payload.actor);
    default:
      throw new Error(`Unsupported Framer RPC action: ${action}`);
  }
}

const RPC_BOUNDARY = "__FRAMER_RPC_RESPONSE__";

try {
  const request = await readPayload();
  const result = await execute(request.action, request.payload ?? {});
  process.stdout.write(`\n${RPC_BOUNDARY}${JSON.stringify({ ok: true, result })}${RPC_BOUNDARY}\n`);
} catch (error) {
  process.stderr.write(JSON.stringify({ ok: false, error: serializeError(error) }));
  process.exitCode = 1;
}
