"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function ViewerIdentityGate({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = await fetch("/api/viewer/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watch_link_token: token, name, email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error === "invalid_email" ? "Enter a valid email address." : data.error === "invalid_name" ? "Enter your name." : "Unable to save viewer identity. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error while saving viewer identity.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 sm:p-8">
      <p className="text-xs uppercase tracking-[0.18em] text-violet-300/70">Before you watch</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Tell us who is watching</h1>
      <p className="mt-3 text-sm leading-6 text-white/50">Your name and email identify your private viewing sessions. They are stored securely and are never placed in the viewer URL.</p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-left text-xs font-medium text-white/70">
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} autoComplete="name" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/50" placeholder="Your name" />
        </label>
        <label className="block text-left text-xs font-medium text-white/70">
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" maxLength={320} autoComplete="email" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/50" placeholder="you@example.com" />
        </label>
        {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">{error}</p>}
        <button type="submit" disabled={saving} className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : "Continue watching"}</button>
      </form>
      <p className="mt-4 text-center text-[11px] leading-5 text-white/30">TrackUp uses this identity only to connect your private-link sessions and playback events.</p>
    </section>
  );
}
