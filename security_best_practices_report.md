# Security Best Practices Report

## Executive Summary

This repo has several real, exploitable security issues in its current server-side request handling. The most serious problem is that the AI/CMS execution path is not authenticated at the route level and is outside the middleware-protected set, which means anonymous callers can reach write-capable endpoints. Because Framer operations fall back to the legacy runtime context when no per-site context is set, that gap can expose the legacy Framer project to unauthorized reads, writes, asset uploads, and publishing if legacy env vars are configured.

The next-most important issues are a settings-path bypass of Framer project claim enforcement, a stored XSS sink in the rich text editor, and missing ownership checks in chat history persistence. There are also billing webhook replay weaknesses and a lack of visible app-level security headers/CSP in repo code.

## Critical

### SEC-001: Unauthenticated AI CMS action execution can mutate the legacy Framer project

- Rule ID: NEXT-AUTHZ-001 / NEXT-SECRETS-001
- Severity: Critical
- Location: `src/middleware.ts:5-29`, `src/app/api/ai/cms-action/execute/route.ts:80-143`, `src/lib/framer-runtime.ts:22-32`
- Evidence:

```ts
// src/middleware.ts
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/api/onboarding(.*)",
  "/api/posts(.*)",
  "/api/meta/fields(.*)",
  "/api/uploads(.*)",
]);
```

```ts
// src/app/api/ai/cms-action/execute/route.ts
export async function POST(request: Request) {
  const body = await request.json();
  ...
  switch (payload.action) {
    case "add_items":
      result = await addCollectionItems(payload.collectionId, payload.items);
      break;
    ...
    case "publish":
      result = await publishSite();
      break;
  }
}
```

```ts
// src/lib/framer-runtime.ts
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
```

- Impact: Any unauthenticated caller who can reach `/api/ai/cms-action/execute` can attempt CMS writes, deletes, enum mutations, or site publishing against the legacy Framer project whenever `FRAMER_API_KEY` and `appConfig.framer.projectId` are configured.
- Fix: Add route-local authn/authz to `/api/ai/cms-action/execute`, require a fully resolved current-site context via `runWithCurrentSiteFramerContext`, and remove the legacy fallback for request-facing product routes.
- Mitigation: Expand middleware protection to include `/api/ai(.*)` immediately, but do not rely on middleware alone for write authorization.
- False positive notes: This is only non-exploitable if the route is not deployed or the legacy Framer env/config is never present. The code as written does not enforce that invariant.

## High

### SEC-002: AI endpoints are publicly callable and can leak Framer metadata or burn paid AI quota

- Rule ID: NEXT-AUTHN-001 / NEXT-AUTHZ-001
- Severity: High
- Location: `src/middleware.ts:5-29`, `src/app/api/ai/chat/route.ts:141-223`, `src/app/api/ai/image/route.ts:30-216`, `src/app/api/ai/rewrite/route.ts:49-132`, `src/lib/ai-context-snapshot.ts:97-178`, `src/lib/ai-image-tool.ts:38-145`, `src/lib/framer-runtime.ts:22-32`
- Evidence:

```ts
// src/app/api/ai/chat/route.ts
const { orgId, userId } = await auth();
...
if (orgId) {
  const quota = await checkQuota(orgId);
}
...
const snapshot = await getAIContextSnapshot();
...
tools: {
  ...framerTools,
  generate_and_upload_image: generateAndUploadImage,
  web_search: webSearchTool,
}
```

```ts
// src/app/api/ai/image/route.ts
const { orgId, userId } = await auth();
...
if (orgId) {
  const quota = await checkQuota(orgId);
}
```

```ts
// src/app/api/ai/rewrite/route.ts
const { orgId, userId } = await auth();
...
if (orgId) {
  const quota = await checkQuota(orgId);
}
```

```ts
// src/lib/ai-context-snapshot.ts
const [project, rawCollections] = await Promise.all([
  getProjectInfo().catch(...),
  getAllCollections().catch(...),
]);
```

```ts
// src/lib/ai-image-tool.ts
const asset = await uploadBlogAsset("image", file);
```

- Impact: Anonymous callers can use expensive AI functionality without quota enforcement, and `/api/ai/chat` can preload Framer project/collection metadata and potentially upload Framer assets through the image tool when the legacy runtime fallback is active.
- Fix: Require authenticated users for all `/api/ai/*` routes, require org membership before running quota-sensitive operations, and ensure all Framer calls in AI paths run only under `runWithCurrentSiteFramerContext`.
- Mitigation: Apply per-route rate limiting and request size limits, but treat that as defense-in-depth rather than the primary fix.
- False positive notes: Framer leakage/upload depends on legacy Framer fallback being configured. The anonymous AI-cost exposure exists whenever AI env vars are configured.

### SEC-003: Framer project uniqueness enforcement is bypassed in the settings save flow

- Rule ID: NEXT-AUTHZ-002
- Severity: High
- Location: `src/app/api/onboarding/complete/route.ts:74-124`, `src/app/api/dashboard/settings/framer/save/route.ts:20-71`
- Evidence:

```ts
// onboarding path enforces claims
await fetchProductMutation(anyApi.billing.releaseFramerProject, {
  clerkOrganizationId: orgId,
});
const claimResult = await fetchProductMutation(
  anyApi.billing.claimFramerProject,
  {
    framerProjectId: validation.projectId,
    clerkOrganizationId: orgId,
  },
);
if (!claimResult.claimed) {
  throw new AppError(
    "This Framer project is already connected to another organization.",
    409,
  );
}
```

```ts
// settings save path skips claim enforcement entirely
await fetchProductMutation(anyApi.product.saveSiteSetup, {
  clerkOrganizationId: orgId,
  clerkUserId: userId,
  ...
  framerProjectId: validation.projectId,
  framerProjectUrl: validation.projectUrl,
});
```

- Impact: An admin can re-point an existing org to a Framer project that is already claimed by another org, breaking the intended tenancy boundary and letting two orgs target the same Framer backend.
- Fix: Reuse the same release-and-claim sequence in the settings save route before persisting the new site setup.
- Mitigation: Add an invariant check in `saveSiteSetup` or a server-side claim validation helper so uniqueness is enforced centrally.
- False positive notes: None. The two flows are materially inconsistent in code today.

### SEC-004: Rich text editor accepts and reinjects unsanitized HTML, enabling stored XSS in the dashboard

- Rule ID: REACT-XSS-001 / REACT-XSS-002
- Severity: High
- Location: `src/components/post-editor.tsx:129-149`, `src/components/post-editor.tsx:416-420`, `src/components/post-editor.tsx:582-595`
- Evidence:

```ts
function toEditorHtml(value: string) {
  if (!value) {
    return "";
  }

  if (looksLikeHtml(value)) {
    return value;
  }
  ...
}
```

```ts
function htmlToPlainText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? "").replace(/\s+/g, " ").trim();
}
```

```ts
const nextHtml = toEditorHtml(value);
if (editor.innerHTML !== nextHtml) {
  editor.innerHTML = nextHtml;
}
...
onChange(editorRef.current?.innerHTML ?? "");
```

- Impact: Stored HTML from Framer, Notion, or AI rewrites can inject active markup into the editor surface. Event handlers, dangerous URLs, or unexpected elements can execute in the dashboard origin when another user opens the post editor.
- Fix: Sanitize HTML before insertion with a reviewed sanitizer such as DOMPurify, restrict the allowlist to the editor’s supported tags/attributes, and sanitize again before persistence if rich HTML remains allowed.
- Mitigation: Add a CSP as defense-in-depth, but do not treat CSP as a substitute for sanitization.
- False positive notes: If the upstream Framer content is guaranteed sanitized elsewhere this reduces risk, but no such guarantee is enforced in this repo.

## Medium

### SEC-005: Chat history save/delete paths do not verify conversation ownership before mutation

- Rule ID: NEXT-AUTHZ-002
- Severity: Medium
- Location: `convex/chat.ts:33-88`, `src/app/api/ai/chat/history/route.ts:34-57`, `src/app/api/ai/chat/history/[id]/route.ts:13-27`
- Evidence:

```ts
// convex/chat.ts
const existing = await ctx.db
  .query("chatConversations")
  .withIndex("by_conversation", (q: any) =>
    q.eq("conversationId", args.conversationId),
  )
  .unique();

if (existing) {
  await ctx.db.patch(existing._id, {
    messages: args.messages,
    title: args.title,
    updatedAt: now,
  });
}
```

```ts
// convex/chat.ts
const existing = await ctx.db
  .query("chatConversations")
  .withIndex("by_conversation", (q: any) =>
    q.eq("conversationId", args.conversationId),
  )
  .unique();

if (existing) {
  await ctx.db.delete(existing._id);
}
```

```ts
// delete route passes only the conversation id
await fetchProductMutation(anyApi.chat.deleteConversation, {
  conversationId,
});
```

- Impact: If a user learns another conversation ID, they can overwrite or delete another user’s saved chat history because ownership is not re-checked at mutation time.
- Fix: Include `clerkOrganizationId` and `clerkUserId` in the mutation arguments and verify the stored record matches before patch/delete.
- Mitigation: Keep conversation IDs unguessable and avoid exposing them outside the owner’s UI, but do not rely on secrecy alone.
- False positive notes: Conversation IDs are currently random UUIDs, which lowers exploitability but does not remove the authorization flaw.

### SEC-006: Billing webhook verification lacks replay protection

- Rule ID: NEXT-WEBHOOK-001
- Severity: Medium
- Location: `src/lib/billing.ts:248-285`, `src/app/api/billing/webhook/route.ts:109-131`
- Evidence:

```ts
export function verifyDodoWebhookSignature(
  payload: string,
  signatureHeader: string,
  webhookId: string,
  webhookTimestamp: string,
  secret: string,
): boolean {
  ...
  const signedContent = `${webhookId}.${webhookTimestamp}.${payload}`;
  ...
  if (timingSafeEqual(candidateBuf, expectedBuf)) return true;
}
```

```ts
// route verifies signature only; no age check or dedupe store
const webhookId = request.headers.get("webhook-id") ?? "";
const webhookTimestamp = request.headers.get("webhook-timestamp") ?? "";
const webhookSignature = request.headers.get("webhook-signature") ?? "";

if (!verifyDodoWebhookSignature(...)) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}
```

- Impact: A captured valid webhook can be replayed indefinitely because the code does not reject stale timestamps or record processed webhook IDs. That can reapply old subscription state transitions.
- Fix: Enforce a narrow timestamp skew window and persist processed `webhook-id` values for idempotency/replay rejection.
- Mitigation: If Dodo offers webhook replay controls upstream, enable them, but still enforce replay defense in the app.
- False positive notes: Exact business impact depends on how often attackers can observe signed webhook traffic and whether repeated state transitions are operationally harmful.

## Low

### SEC-007: No app-level security headers or CSP are visible in repo code

- Rule ID: NEXT-HEADERS-001 / REACT-CSP-001
- Severity: Low
- Location: `next.config.ts:1-18`, `src/app/layout.tsx:1-60`
- Evidence:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["framer-api"],
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    root,
  },
  experimental: {
    proxyClientMaxBodySize: "25mb",
  },
};
```

No application-level `headers()` configuration is present here, and no CSP or related security header handling is visible in app code.

- Impact: The app appears to rely on default browser behavior unless headers are injected at the hosting edge. That weakens defense-in-depth against XSS, clickjacking, MIME sniffing, and referrer leakage.
- Fix: Add a production header baseline, especially CSP, `X-Content-Type-Options: nosniff`, and a clickjacking policy.
- Mitigation: If these are already set in Vercel or another reverse proxy, document and verify them at runtime.
- False positive notes: This finding is intentionally conditional. The repo alone does not prove headers are absent in production.

## Recommended Remediation Order

1. Lock down `/api/ai/cms-action/execute` and all `/api/ai/*` routes with route-local authz and product-scoped Framer context.
2. Fix the settings save flow so Framer project claims are enforced everywhere.
3. Sanitize editor HTML before DOM insertion and before persistence.
4. Add ownership checks to chat history save/delete mutations.
5. Add webhook replay protection.
6. Add or verify a production header baseline and CSP.
