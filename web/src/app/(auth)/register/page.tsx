"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { useAuthActions } from "@/lib/hooks/useAuthActions";
import { ApiError } from "@/lib/api/client";

export default function RegisterPage() {
  const { register } = useAuthActions();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(username, email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
      <Card className="p-8">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Generate your keys and start talking.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Username" htmlFor="username" hint="Letters, numbers, _ and . — this is how people find you.">
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="alice" autoComplete="username" required minLength={3} />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alice@example.com" autoComplete="email" required />
          </Field>
          <Field label="Password" htmlFor="pw" hint="At least 8 characters.">
            <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" required minLength={8} />
          </Field>

          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" loading={loading}>Create account</Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">Log in</Link>
        </p>
      </Card>
    </motion.div>
  );
}
