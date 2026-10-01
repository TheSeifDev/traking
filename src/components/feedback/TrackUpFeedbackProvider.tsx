"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert, X } from "lucide-react";

type FeedbackTone = "success" | "error" | "info" | "warning" | "neutral";
type ConfirmationTone = "danger" | "default";

type Notification = {
  id: number;
  tone: FeedbackTone;
  title: string;
  description?: string;
};

export type ConfirmActionOptions = {
  title: string;
  description?: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmationTone;
  onConfirm?: () => Promise<void> | void;
};

type PendingConfirmation = ConfirmActionOptions & {
  resolve: (confirmed: boolean) => void;
};

type FeedbackListener = (notification: Omit<Notification, "id">) => void;
type ConfirmationListener = (confirmation: PendingConfirmation) => void;

let notificationListener: FeedbackListener | null = null;
let confirmationListener: ConfirmationListener | null = null;
let notificationId = 0;

function publishNotification(tone: FeedbackTone, title: string, description?: string) {
  notificationListener?.({ tone, title, description });
}

export const notify = {
  success: (title: string, description?: string) => publishNotification("success", title, description),
  error: (title: string, description?: string) => publishNotification("error", title, description),
  info: (title: string, description?: string) => publishNotification("info", title, description),
  warning: (title: string, description?: string) => publishNotification("warning", title, description),
  neutral: (title: string, description?: string) => publishNotification("neutral", title, description),
};

export function confirmAction(options: ConfirmActionOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!confirmationListener) {
      resolve(false);
      return;
    }
    confirmationListener({ ...options, resolve });
  });
}

const notificationStyles: Record<FeedbackTone, { surface: string; icon: typeof Info }> = {
  error: { surface: "border-red-300/30 bg-[#2b101b]/95 shadow-[0_16px_42px_rgba(244,63,94,0.28),0_0_28px_rgba(244,63,94,0.18)]", icon: AlertCircle },
  success: { surface: "border-emerald-300/30 bg-[#0c291f]/95 shadow-[0_16px_42px_rgba(52,211,153,0.25),0_0_28px_rgba(52,211,153,0.16)]", icon: CheckCircle2 },
  info: { surface: "border-sky-300/30 bg-[#0d2038]/95 shadow-[0_16px_42px_rgba(56,189,248,0.25),0_0_28px_rgba(56,189,248,0.16)]", icon: Info },
  warning: { surface: "border-amber-300/30 bg-[#30220d]/95 shadow-[0_16px_42px_rgba(251,191,36,0.25),0_0_28px_rgba(251,191,36,0.16)]", icon: TriangleAlert },
  neutral: { surface: "border-violet-300/30 bg-[#1d153a]/95 shadow-[0_16px_42px_rgba(167,139,250,0.25),0_0_28px_rgba(167,139,250,0.16)]", icon: Info },
};

const iconStyles: Record<FeedbackTone, string> = {
  error: "text-rose-200",
  success: "text-emerald-200",
  info: "text-sky-200",
  warning: "text-amber-200",
  neutral: "text-violet-200",
};

export default function TrackUpFeedbackProvider() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);

  useEffect(() => {
    notificationListener = (notification) => {
      const id = ++notificationId;
      setNotifications((current) => [...current, { ...notification, id }].slice(-4));
      window.setTimeout(() => {
        setNotifications((current) => current.filter((item) => item.id !== id));
      }, 6000);
    };
    confirmationListener = (nextConfirmation) => {
      setConfirmationError(null);
      setConfirming(false);
      setConfirmation(nextConfirmation);
    };
    return () => {
      notificationListener = null;
      confirmationListener = null;
    };
  }, []);

  const dismiss = (id: number) => setNotifications((current) => current.filter((notification) => notification.id !== id));
  const cancelConfirmation = () => {
    confirmation?.resolve(false);
    setConfirmation(null);
    setConfirmationError(null);
  };
  const acceptConfirmation = async () => {
    if (!confirmation || confirming) return;
    if (!confirmation.onConfirm) {
      confirmation.resolve(true);
      setConfirmation(null);
      return;
    }
    setConfirming(true);
    setConfirmationError(null);
    try {
      await confirmation.onConfirm();
      confirmation.resolve(true);
      setConfirmation(null);
    } catch {
      setConfirmationError("The requested action could not be completed. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  const confirmationTone = confirmation?.tone === "danger" ? "error" : "neutral";
  const confirmationStyle = notificationStyles[confirmationTone];
  const ConfirmationIcon = confirmationStyle.icon;

  return (
    <>
      <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-center gap-3 sm:left-auto sm:right-5 sm:w-[min(25rem,calc(100vw-2.5rem))] sm:items-stretch">
        {notifications.map((notification) => {
          const style = notificationStyles[notification.tone];
          const Icon = style.icon;
          return <article key={notification.id} role={notification.tone === "error" ? "alert" : "status"} className={`pointer-events-auto w-full animate-[trackup-feedback-in_180ms_ease-out] rounded-[22px] border px-4 py-3.5 backdrop-blur-xl ${style.surface}`}>
            <div className="flex items-start gap-3">
              <Icon size={20} className={`mt-0.5 shrink-0 ${iconStyles[notification.tone]}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{notification.title}</p>
                {notification.description && <p className="mt-1 text-xs leading-5 text-white/65">{notification.description}</p>}
              </div>
              <button type="button" onClick={() => dismiss(notification.id)} className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white focus-visible:outline-none" aria-label="Dismiss notification"><X size={16} /></button>
            </div>
          </article>;
        })}
      </div>

      {confirmation && <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="presentation" onMouseDown={cancelConfirmation}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="trackup-confirmation-title" aria-describedby="trackup-confirmation-description" onMouseDown={(event) => event.stopPropagation()} className={`w-full max-w-md animate-[trackup-feedback-in_180ms_ease-out] rounded-[26px] border p-5 backdrop-blur-xl sm:p-6 ${confirmationStyle.surface}`}>
          <div className="flex items-start gap-3">
            <ConfirmationIcon size={22} className={`mt-0.5 shrink-0 ${iconStyles[confirmationTone]}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 id="trackup-confirmation-title" className="text-base font-semibold text-white">{confirmation.title}</h2>
              <p id="trackup-confirmation-description" className="mt-2 text-sm leading-6 text-white/65">{confirmation.description ?? confirmation.body}</p>
            </div>
            <button type="button" onClick={cancelConfirmation} disabled={confirming} className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-40" aria-label="Close confirmation"><X size={16} /></button>
          </div>
          {confirmationError && <p role="alert" className="mt-4 rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs leading-5 text-red-100">{confirmationError}</p>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={cancelConfirmation} disabled={confirming} className="min-h-10 rounded-xl border border-white/12 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-40">{confirmation.cancelLabel ?? "Cancel"}</button>
            <button type="button" onClick={() => void acceptConfirmation()} disabled={confirming} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${confirmation.tone === "danger" ? "border-red-300/25 bg-red-500/75 hover:bg-red-400" : "border-violet-300/25 bg-violet-500/80 hover:bg-violet-400"}`}>{confirming && <Loader2 size={15} className="animate-spin" />}{confirmation.confirmLabel ?? "Confirm"}</button>
          </div>
        </section>
      </div>}
    </>
  );
}
