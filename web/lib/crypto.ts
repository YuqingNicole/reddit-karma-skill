/**
 * Encrypt Reddit OAuth tokens at rest (AES-256-GCM).
 *
 * Set TOKEN_ENC_KEY to 32 bytes hex (64 hex chars: `openssl rand -hex 32`).
 * Stored values are tagged `enc:v1:`; anything without that tag is treated as
 * plaintext, so a key can be introduced without a migration (old rows keep
 * working, new writes are encrypted). Without a key set, tokens are stored
 * plaintext — fine for local dev, NOT for production.
 */
import crypto from "crypto";

const PREFIX = "enc:v1:";

function key(): Buffer | null {
  const k = process.env.TOKEN_ENC_KEY;
  if (!k) return null;
  const buf = Buffer.from(k, "hex");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENC_KEY must be 32 bytes hex (64 hex chars).");
  }
  return buf;
}

export function encryptToken(plain: string | null): string | null {
  if (plain == null) return null;
  const k = key();
  if (!k) return plain; // dev fallback
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptToken(stored: string | null): string | null {
  if (stored == null) return null;
  if (!stored.startsWith(PREFIX)) return stored; // plaintext (dev / pre-key rows)
  const k = key();
  if (!k) throw new Error("TOKEN_ENC_KEY is required to decrypt stored tokens.");
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const d = crypto.createDecipheriv("aes-256-gcm", k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}
