"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { useAuthActions } from "@/lib/hooks/useAuthActions";
import { ApiError } from "@/lib/api/client";

export default function LoginPage() {
  const { login } = useAuthActions();
  const [emailOrUsername, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(emailOrUsername, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
      <Card className="p-8">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log in to continue to Nexa.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email or username" htmlFor="id">
            <Input id="id" value={emailOrUsername} onChange={(e) => setId(e.target.value)} placeholder="alice@nexa.local" autoComplete="username" required />
          </Field>
          <Field label="Password" htmlFor="pw">
            <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
          </Field>

          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" loading={loading}>Log in</Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">Create an account</Link>
        </p>
      </Card>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Demo: <span className="font-mono">alice@nexa.local</span> / <span className="font-mono">Password123!</span>
      </p>
    </motion.div>
  );
}
