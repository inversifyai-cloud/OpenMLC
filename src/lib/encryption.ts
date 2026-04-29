import crypto from "crypto";

const RAW_KEY = process.env.ENCRYPTION_KEY ?? "";

function getKey(): Buffer | null {
  if (!RAW_KEY || RAW_KEY.length !== 64) return null;
  try {
    return Buffer.from(RAW_KEY, "hex");
  } catch {
    return null;
  }
}

export function isByokAvailable(): boolean {
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[BYOK] ENCRYPTION_KEY is not set or invalid. " +
          "Set a 64-character hex string (32 bytes) to enable BYOK. " +
          "Example: openssl rand -hex 32"
      );
    }
    return false;
  }
  return true;
}

export function encrypt(text: string): string {
  const key = getKey();
  if (!key) throw new Error("ENCRYPTION_KEY is not configured");

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(text: string): string {
  const key = getKey();
  if (!key) throw new Error("ENCRYPTION_KEY is not configured");

  const parts = text.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted value format");

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
