import { createHmac, timingSafeEqual } from "node:crypto";

export const INVITATION_CONTEXT_COOKIE = "trackup_invitation_context";
const CONTEXT_MAX_AGE_SECONDS = 60 * 10;

type InvitationContext = {
  invitationId: string;
  tokenHash: string;
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

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createInvitationContextCookie(invitationId: string, tokenHash: string): string {
  const secret = getSecret();
  if (!secret) throw new Error("TRACKUP_SESSION_SECRET must be set to at least 32 characters");
  const payload: InvitationContext = {
    invitationId,
    tokenHash,
    exp: Math.floor(Date.now() / 1000) + CONTEXT_MAX_AGE_SECONDS,
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyInvitationContextCookie(raw: string | undefined): InvitationContext | null {
  const secret = getSecret();
  if (!raw || !secret) return null;
  const [encoded, receivedSignature] = raw.split(".");
  if (!encoded || !receivedSignature) return null;
  const expectedSignature = signature(encoded, secret);
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
      typeof value.invitationId !== "string" ||
      typeof value.tokenHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(value.tokenHash) ||
      typeof value.exp !== "number" ||
      value.exp < Math.floor(Date.now() / 1000)
    ) return null;
    return {
      invitationId: value.invitationId,
      tokenHash: value.tokenHash,
      exp: value.exp,
    };
  } catch {
    return null;
  }
}

export { CONTEXT_MAX_AGE_SECONDS };
