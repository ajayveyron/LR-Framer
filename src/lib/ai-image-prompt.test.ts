import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

import { buildImagePrompt, buildAltText } from "./ai-image-prompt.js";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 100 });

const contextArb = fc.record(
  {
    title: fc.string({ maxLength: 80 }),
    slug: fc.string({ maxLength: 80 }),
    bodyText: fc.string({ maxLength: 800 }),
  },
  { requiredKeys: [] },
);

// ---------------------------------------------------------------------------
// Property 11: Image dialog pre-populates prompt from CMS item
// When context is provided, the output always contains the user prompt
// and any non-empty context fields.
// ---------------------------------------------------------------------------

describe("Property 11 — buildImagePrompt pre-populates from CMS context", () => {
  it("always contains the user prompt verbatim", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, contextArb, (userPrompt, ctx) => {
        const result = buildImagePrompt(userPrompt, ctx);
        assert.ok(
          result.includes(userPrompt),
          "Output must contain the user prompt",
        );
      }),
    );
  });

  it("includes title when provided", () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        nonEmptyStringArb,
        (userPrompt, title) => {
          const result = buildImagePrompt(userPrompt, { title });
          assert.ok(result.includes(title));
        },
      ),
    );
  });

  it("includes slug when provided", () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        nonEmptyStringArb,
        (userPrompt, slug) => {
          const result = buildImagePrompt(userPrompt, { slug });
          assert.ok(result.includes(slug));
        },
      ),
    );
  });

  it("without context, returns the user prompt unchanged", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (userPrompt) => {
        assert.equal(buildImagePrompt(userPrompt), userPrompt);
        assert.equal(buildImagePrompt(userPrompt, undefined), userPrompt);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: Rich text image dialog shows CMS context
// When bodyText is provided, it appears in the output (possibly truncated).
// ---------------------------------------------------------------------------

describe("Property 12 — buildImagePrompt includes body context", () => {
  it("includes bodyText content (or truncated prefix) when provided", () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        fc.string({ minLength: 1, maxLength: 800 }),
        (userPrompt, bodyText) => {
          const result = buildImagePrompt(userPrompt, { bodyText });
          // If body is <= 500 chars, it appears verbatim; otherwise first 497 chars appear
          if (bodyText.length <= 500) {
            assert.ok(result.includes(bodyText));
          } else {
            assert.ok(result.includes(bodyText.slice(0, 497)));
          }
        },
      ),
    );
  });

  it("truncates bodyText longer than 500 chars", () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        fc.string({ minLength: 501, maxLength: 800 }),
        (userPrompt, bodyText) => {
          const result = buildImagePrompt(userPrompt, { bodyText });
          // Should NOT contain the full body
          assert.ok(!result.includes(bodyText));
          // Should contain the truncation marker
          assert.ok(result.includes("…"));
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Property 13: Inserted image alt text derived from prompt
// Alt text is always <= 125 chars and derived from the prompt.
// ---------------------------------------------------------------------------

describe("Property 13 — buildAltText from prompt", () => {
  it("alt text is never longer than 125 characters", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (prompt) => {
        const alt = buildAltText(prompt);
        assert.ok(alt.length <= 125, `Alt text too long: ${alt.length}`);
      }),
    );
  });

  it("short prompts are preserved (after newline cleanup)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 125 }).filter((s) => !s.includes("\n") && s.trim().length > 0),
        (prompt) => {
          const alt = buildAltText(prompt);
          assert.equal(alt, prompt.trim());
        },
      ),
    );
  });

  it("newlines are replaced with spaces", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 100 }), (prompt) => {
        const alt = buildAltText(prompt);
        assert.ok(!alt.includes("\n"));
      }),
    );
  });

  it("long prompts are truncated with ellipsis", () => {
    // Use alphanumeric strings to avoid whitespace collapsing edge cases
    fc.assert(
      fc.property(
        fc.string({ minLength: 130, maxLength: 500 }).map((s) => s.replace(/[\s\n]/g, "x")).filter((s) => s.length > 125),
        (prompt) => {
          const alt = buildAltText(prompt);
          assert.ok(alt.endsWith("…"), `Expected ellipsis, got: "${alt}"`);
          assert.equal(alt.length, 125);
        },
      ),
    );
  });
});
