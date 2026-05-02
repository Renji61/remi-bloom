"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "@/hooks/use-page-title";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sprout, Loader2, Eye, EyeOff, UserPlus, LogIn, ShieldX } from "lucide-react";
import { Button, Card, CardContent, Input } from "@/components/ui";
import { signIn } from "next-auth/react";
import { HeaderThemeToggle } from "@/components/layout/weather-badge";

export default function RegisterPage() {
  usePageTitle("Register");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    fetch("/api/registration-status")
      .then((r) => r.json())
      .then((data) => {
        setRegistrationOpen(data.open);
      })
      .catch(() => {
        setRegistrationOpen(false);
      })
      .finally(() => setStatusLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !displayName.trim() || !password) {
      setError("Username, display name, and password are required");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          displayName,
          email,
          password,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Registration failed" }));
        setError(payload.error ?? "Registration failed");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        username: username.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        router.replace("/login");
        return;
      }

      router.replace("/home");
    } catch {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  if (statusLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface p-4">
        <Loader2 size={24} className="animate-spin text-on-surface-variant" />
      </div>
    );
  }

  if (registrationOpen === false) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface p-4">
        <div className="fixed right-4 top-4">
          <HeaderThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-500/20">
              <ShieldX size={32} className="text-yellow-500" />
            </div>
            <h1 className="text-xl font-bold text-on-surface">Registration Closed</h1>
            <p className="mt-2 text-sm text-on-surface-variant/70">
              Public registration is currently disabled on this server.
            </p>
          </div>

          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-on-surface-variant/70">
                If you already have an account,&nbsp;
                <Link
                  href="/login"
                  className="font-semibold text-[var(--theme-primary)] hover:underline"
                >
                  sign in here
                </Link>
                .
              </p>
              <p className="mt-4 text-xs text-on-surface-variant/50">
                Contact the server administrator to create a new account.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <div className="fixed right-4 top-4">
        <HeaderThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--theme-primary)]/20">
            <Sprout size={32} className="text-[var(--theme-primary)]" />
          </div>
          <h1 className="text-xl font-bold text-on-surface">Create Account</h1>
          <p className="mt-1 text-sm text-on-surface-variant/70">
            Start managing your garden with REMI Bloom
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                autoComplete="username"
                autoFocus
              />

              <Input
                label="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                autoComplete="name"
              />

              <Input
                label="Email (optional)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[38px] text-on-surface-variant/50 hover:text-on-surface-variant"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <Input
                label="Confirm Password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                autoComplete="new-password"
              />

              {error && (
                <div className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UserPlus size={14} />
                )}
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--theme-primary)] hover:underline"
              >
                <LogIn size={12} />
                Already have an account? Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
