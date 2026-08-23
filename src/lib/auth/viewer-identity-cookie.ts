import { createHmac, timingSafeEqual } from "node:crypto";

export const VIEWER_IDENTITY_COOKIE = "trackup_viewer_identity";
export const VIEWER_IDENTITY_CONTEXT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type ViewerIdentityContext = {
  identityId: string;
  watchLinkId: string;
  watchLinkTokenHash: string;
  exp: number;
};

function getSecret(): string | null {
  const secret = process.env.TRACKUP_SESSION_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function sign(encoded: string, secret: string): string {
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

export function createViewerIdentityCookie(
  identityId: string,
  watchLinkId: string,
  watchLinkTokenHash: string,
): string {
  const secret = getSecret();
  if (!secret) throw new Error("TRACKUP_SESSION_SECRET must be set to at least 32 characters");
  const payload: ViewerIdentityContext = {
    identityId,
    watchLinkId,
    watchLinkTokenHash,
    exp: Math.floor(Date.now() / 1000) + VIEWER_IDENTITY_CONTEXT_MAX_AGE_SECONDS,
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyViewerIdentityCookie(raw: string | undefined): ViewerIdentityContext | null {
  const secret = getSecret();
  if (!raw || !secret) return null;
  const [encoded, receivedSignature] = raw.split(".");
  if (!encoded || !receivedSignature) return null;
  const expectedSignature = sign(encoded, secret);
  const received = Buffer.from(receivedSignature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  const decoded = decode(encoded);
  if (!decoded) return null;
  try {
    const parsed: unknown = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Record<string, unknown>;
    if (
      typeof value.identityId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(value.identityId) ||
      typeof value.watchLinkId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(value.watchLinkId) ||
      typeof value.watchLinkTokenHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(value.watchLinkTokenHash) ||
      typeof value.exp !== "number" ||
      value.exp < Math.floor(Date.now() / 1000)
    ) return null;
    return {
      identityId: value.identityId,
      watchLinkId: value.watchLinkId,
      watchLinkTokenHash: value.watchLinkTokenHash,
      exp: value.exp,
    };
  } catch {
    return null;
  }
}

export type { ViewerIdentityContext };
