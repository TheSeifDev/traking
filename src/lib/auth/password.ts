/**
 * TrackUp Password Security & Hashing Engine
 *
 * Implements server-side password authentication using Argon2id (RFC 9106)
 * with OWASP-recommended parameters, plus a built-in node:crypto.scrypt
 * fallback adapter.
 *
 * Rules:
 * - Passwords are NEVER logged.
 * - Passwords are NEVER stored plaintext.
 * - Timing attacks are mitigated via constant-time verification against dummy hashes.
 */

import crypto from "node:crypto";

// Fallback scrypt parameters (RFC 7914)
const SCRYPT_SALT_LEN = 16;
const SCRYPT_KEY_LEN = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELISM = 1;

// Pre-computed dummy Argon2id hash for constant-time rejection on non-existent users
let dummyHashCache: string | null = null;

// Dynamically resolve @node-rs/argon2 with fallback
let argon2Module: typeof import("@node-rs/argon2") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  argon2Module = require("@node-rs/argon2");
} catch {
  argon2Module = null;
}

/**
 * Scrypt-based hashing fallback if native Argon2 is unavailable
 */
async function hashScrypt(password: string): Promise<string> {
  const salt = crypto.randomBytes(SCRYPT_SALT_LEN);
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEY_LEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELISM },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`$scrypt$N=${SCRYPT_COST},r=${SCRYPT_BLOCK_SIZE},p=${SCRYPT_PARALLELISM}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`);
      }
    );
  });
}

async function verifyScrypt(password: string, hash: string): Promise<boolean> {
  const parts = hash.split("$");
  if (parts.length !== 5 || parts[1] !== "scrypt") return false;

  const salt = Buffer.from(parts[3], "base64url");
  const originalKey = Buffer.from(parts[4], "base64url");

  return new Promise((resolve) => {
    crypto.scrypt(
      password,
      salt,
      originalKey.length,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELISM },
      (err, derivedKey) => {
        if (err) return resolve(false);
        try {
          resolve(crypto.timingSafeEqual(originalKey, derivedKey));
        } catch {
          resolve(false);
        }
      }
    );
  });
}

/**
 * Hashes a plaintext password using Argon2id (or Scrypt fallback).
 */
export async function hashPassword(password: string): Promise<string> {
  if (argon2Module?.hash) {
    try {
      return await argon2Module.hash(password, {
        memoryCost: 19456, // 19 MB (OWASP recommended minimum for Argon2id)
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      });
    } catch {
      // If native module fails at runtime, fallback to scrypt
      return hashScrypt(password);
    }
  }
  return hashScrypt(password);
}

/**
 * Verifies a plaintext password against a stored password hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash || typeof hash !== "string") return false;

  if (hash.startsWith("$argon2") && argon2Module?.verify) {
    try {
      return await argon2Module.verify(hash, password);
    } catch {
      return false;
    }
  }

  if (hash.startsWith("$scrypt")) {
    return verifyScrypt(password, hash);
  }

  return false;
}

/**
 * Executes a constant-time dummy verification when an account is not found,
 * eliminating timing attacks that reveal user existence.
 */
export async function verifyDummyPassword(password: string): Promise<void> {
  if (!dummyHashCache) {
    try {
      dummyHashCache = await hashPassword("TrackUp-Dummy-Security-String-Constant-Time-123!");
    } catch {
      dummyHashCache = "$scrypt$N=16384,r=8,p=1$dummy$dummy";
    }
  }
  try {
    await verifyPassword(password, dummyHashCache);
  } catch {
    // Ignore verification result intentionally
  }
}

export interface PasswordPolicyResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a password against TrackUp security policy.
 */
export function validatePasswordPolicy(
  password: unknown,
  username?: string | null,
  email?: string | null
): PasswordPolicyResult {
  if (typeof password !== "string") {
    return { valid: false, error: "Password must be a string." };
  }

  if (password.length < 10) {
    return { valid: false, error: "Password must be at least 10 characters long." };
  }

  if (password.length > 128) {
    return { valid: false, error: "Password must be 128 characters or fewer." };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!hasUpper || !hasLower || !hasNumber || !hasSymbol) {
    return {
      valid: false,
      error: "Password must include at least one uppercase letter, one lowercase letter, one number, and one symbol.",
    };
  }

  const lowerPassword = password.toLowerCase();

  if (username && username.trim().length >= 3) {
    const cleanUsername = username.trim().toLowerCase();
    if (lowerPassword.includes(cleanUsername)) {
      return { valid: false, error: "Password cannot contain your username." };
    }
  }

  if (email && email.includes("@")) {
    const localPart = email.split("@")[0].trim().toLowerCase();
    if (localPart.length >= 3 && lowerPassword.includes(localPart)) {
      return { valid: false, error: "Password cannot contain your email username." };
    }
  }

  return { valid: true };
}
