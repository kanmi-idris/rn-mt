/**
 * Shared hashing helpers used across rn-mt packages.
 */
import { createHash } from "node:crypto";

/**
 * Hashes text content with SHA-256 for change detection and ownership metadata.
 */
export function hashText(contents: string) {
  return createHash("sha256").update(contents).digest("hex");
}
