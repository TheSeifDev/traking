"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, User, Loader2 } from "lucide-react";

interface LoginFormProps {
  returnPath?: string;
  initialError?: string | null;
}

export default function LoginForm({ returnPath = "/dashboard", initialError = null }: LoginFormProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (!initialError) return null;
    if (initialError === "unauthenticated") return "Please sign in to access that page.";
    if (initialError === "account_inactive") return "This account has been deactivated. Please contact your TrackUp Owner.";
    if (initialError === "session_expired") return "Your session has expired. Please sign in again.";
    if (initialError === "forbidden") return "You do not have permission to access that resource.";
    return "Authentication required. Please sign in.";
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identifier.trim() || !password) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          setErrorMessage("Invalid username or password. Please try again.");
        } else if (response.status === 403) {
          setErrorMessage("This account is inactive. Please contact your TrackUp Owner.");
        } else if (response.status === 423 || data.error === "account_locked") {
          setErrorMessage(data.message || "Account temporarily locked due to repeated failed attempts. Try again in 15 minutes.");
        } else if (response.status === 429 || data.error === "rate_limited") {
          setErrorMessage(data.message || "Too many attempts from this connection. Please try again later.");
        } else {
          setErrorMessage(data.message || "Unable to sign in. Please verify your credentials.");
        }
        setLoading(false);
        return;
      }

      // Successful login - hard navigation to allow cookie to register and server render fresh layout
      window.location.href = returnPath || "/dashboard";
    } catch {
      setErrorMessage("Network error while connecting to TrackUp. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-200 backdrop-blur-md animate-in fade-in slide-in-from-top-1"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
          <span className="leading-5">{errorMessage}</span>
        </div>
      )}

      {/* Identifier field (Username or Email) */}
      <div>
        <label
          htmlFor="trackup-login-identifier"
          className="block text-xs font-medium text-white/70 mb-1.5"
        >
          Username or Email
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-white/40">
            <User size={16} />
          </div>
          <input
            id="trackup-login-identifier"
            type="text"
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={loading}
            placeholder="username or user@company.com"
            className="w-full rounded-xl border border-white/10 bg-black/25 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder:text-white/25 outline-none transition focus:border-violet-400/60 focus:bg-black/35 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Password field */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="trackup-login-password"
            className="block text-xs font-medium text-white/70"
          >
            Password
          </label>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-white/40">
            <Lock size={16} />
          </div>
          <input
            id="trackup-login-password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="••••••••••••"
            className="w-full rounded-xl border border-white/10 bg-black/25 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-white/25 outline-none transition focus:border-violet-400/60 focus:bg-black/35 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-white/40 hover:text-white/70 focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Sign In Button */}
      <button
        type="submit"
        disabled={loading || !identifier.trim() || !password}
        className="group relative flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(124,58,237,0.30)] transition duration-200 hover:bg-violet-500 hover:shadow-[0_12px_36px_rgba(124,58,237,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin text-white" />
            <span>Signing in...</span>
          </>
        ) : (
          <>
            <span>Sign In</span>
            <ArrowRight
              size={15}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </>
        )}
      </button>

      <p className="pt-2 text-center text-[11px] text-white/40">
        Accounts are provisioned exclusively by authorized organization owners.
      </p>
    </form>
  );
}
