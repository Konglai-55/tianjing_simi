"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "@/components/icons";

export function SitePasswordGate({ siteName }: { siteName: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/site/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "密码不正确");
      setPassword("");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "密码不正确");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="site-lock-page">
      <form className="site-lock-card" onSubmit={unlock}>
        <span className="eyebrow">PRIVATE ACCESS</span>
        <h1>{siteName}</h1>
        <p>请输入访问密码进入网站。</p>
        <label>
          <span>访问密码</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "正在验证" : "进入网站"}
          <ArrowRightIcon />
        </button>
      </form>
    </main>
  );
}


