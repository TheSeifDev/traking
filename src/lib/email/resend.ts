export type EmailDispatchResult =
  | { success: true; provider: "resend"; messageId: string }
  | { success: false; error: "delivery_not_configured" | "delivery_failed" };

function getResendConfig(): { apiKey: string; from: string; replyTo?: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const replyTo = process.env.RESEND_REPLY_TO?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from, ...(replyTo ? { replyTo } : {}) };
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<EmailDispatchResult> {
  const config = getResendConfig();
  if (!config) return { success: false, error: "delivery_not_configured" };

  try {
    const payload: Record<string, unknown> = {
      from: config.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    };
    if (config.replyTo) payload.reply_to = config.replyTo;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Transactional email provider rejected the invitation", {
        provider: "resend",
        status: response.status,
      });
      return { success: false, error: "delivery_failed" };
    }

    const data: unknown = await response.json().catch(() => null);
    const candidate = data && typeof data === "object" ? (data as Record<string, unknown>).id : null;
    if (typeof candidate !== "string" || !candidate) return { success: false, error: "delivery_failed" };

    return { success: true, provider: "resend", messageId: candidate };
  } catch {
    console.error("Transactional email provider request failed", { provider: "resend" });
    return { success: false, error: "delivery_failed" };
  }
}

export function isTransactionalEmailConfigured(): boolean {
  return Boolean(getResendConfig());
}
