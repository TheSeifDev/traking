import { isValidRole, type AuthenticatedUser } from "@/src/types/auth";

type CookiePayload = AuthenticatedUser & {
  exp: number;
};

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret(): string | null {
  const secret = process.env.TRACKUP_SESSION_SECRET;
  return secret && secret.trim().length >= 32 ? secret.trim() : null;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function parsePayload(payload: unknown): CookiePayload | null {
  if (
    payload !== null &&
    typeof payload === "object" &&
    "id" in payload &&
    "email" in payload &&
    "role" in payload &&
    "is_active" in payload &&
    "exp" in payload &&
    typeof (payload as Record<string, unknown>).id === "string" &&
    typeof (payload as Record<string, unknown>).email === "string" &&
    typeof (payload as Record<string, unknown>).is_active === "boolean" &&
    typeof (payload as Record<string, unknown>).exp === "number" &&
    isValidRole((payload as Record<string, unknown>).role)
  ) {
    return payload as CookiePayload;
  }
  return null;
}

export async function createSignedSessionCookie(user: AuthenticatedUser): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("TRACKUP_SESSION_SECRET must be set to at least 32 characters");
  }

  const payload: CookiePayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const encodedPayload = base64UrlEncode(payloadBytes);
  const key = await getSigningKey(secret);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload))
  );

  return `${encodedPayload}.${base64UrlEncode(signature)}`;
}

export async function verifySignedSessionCookie(raw: string | undefined): Promise<AuthenticatedUser | null> {
  const secret = getSessionSecret();
  if (!raw || !secret) return null;

  const [encodedPayload, encodedSignature] = raw.split(".");
  if (!encodedPayload || !encodedSignature) return null;

  const signature = base64UrlDecode(encodedSignature);
  const payloadBytes = base64UrlDecode(encodedPayload);
  if (!signature || !payloadBytes) return null;

  const key = await getSigningKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    toArrayBuffer(signature),
    new TextEncoder().encode(encodedPayload)
  );
  if (!valid) return null;

  try {
    const payload = parsePayload(JSON.parse(new TextDecoder().decode(payloadBytes)));
    if (!payload || payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      is_active: payload.is_active,
      name: payload.name,
      clickup_user_id: payload.clickup_user_id,
    };
  } catch {
    return null;
  }
}

export { SESSION_MAX_AGE_SECONDS };
