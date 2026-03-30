import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { AppError } from "@/lib/errors";
import { getProductEnv } from "@/lib/product-env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * Key versioning: new encryptions use the current key. Decryption tries
 * the current key first, then falls back to the previous key (if set).
 *
 * To rotate:
 * 1. Copy PRODUCT_ENCRYPTION_KEY to PRODUCT_ENCRYPTION_KEY_PREVIOUS
 * 2. Set PRODUCT_ENCRYPTION_KEY to a new random value
 * 3. Deploy — all new writes use the new key; reads try both
 * 4. Run a migration to re-encrypt all stored secrets (optional, for cleanup)
 * 5. Remove PRODUCT_ENCRYPTION_KEY_PREVIOUS once migration is confirmed
 */
function deriveKey(raw: string): Buffer {
  return createHash("sha256").update(raw).digest();
}

function getCurrentKey(): Buffer {
  return deriveKey(getProductEnv().PRODUCT_ENCRYPTION_KEY);
}

function getPreviousKey(): Buffer | null {
  const prev = process.env.PRODUCT_ENCRYPTION_KEY_PREVIOUS;
  if (!prev) return null;
  return deriveKey(prev);
}

export function encryptSecret(value: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getCurrentKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function tryDecryptWithKey(payload: string, key: Buffer): string | null {
  const [ivRaw, authTagRaw, encryptedRaw] = payload.split(".");
  if (!ivRaw || !authTagRaw || !encryptedRaw) return null;

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivRaw, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(authTagRaw, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function decryptSecret(payload: string): string {
  const [ivRaw, authTagRaw, encryptedRaw] = payload.split(".");
  if (!ivRaw || !authTagRaw || !encryptedRaw) {
    throw new AppError("Stored Framer credentials are invalid.", 500);
  }

  // Try current key first
  const result = tryDecryptWithKey(payload, getCurrentKey());
  if (result !== null) return result;

  // Fall back to previous key during rotation
  const prevKey = getPreviousKey();
  if (prevKey) {
    const prevResult = tryDecryptWithKey(payload, prevKey);
    if (prevResult !== null) return prevResult;
  }

  throw new AppError("Stored Framer credentials could not be decrypted.", 500);
}
