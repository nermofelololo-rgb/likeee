import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Field, Shell, controlClass } from "@/components/shell";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { updateProfile } from "@/lib/marketplace/api";
import { identifierToLogin } from "@/lib/marketplace/shared";

export const Route = createFileRoute("/login")({ component: LoginPage });

const BEARER_KEY = "grok-auth.bearer-token";

function stash(token?: string | null) {
  if (!token || typeof window === "undefined") return;
  sessionStorage.setItem(BEARER_KEY, token);
}

function authArabic(message: string | undefined) {
  const m = (message ?? "").toLowerCase();
  if (m.includes("already") || m.includes("exist")) return "الحساب ده موجود. ادخل بكلمة السر.";
  if (m.includes("invalid") || m.includes("password") || m.includes("credential")) return "الإيميل أو الرقم أو كلمة السر غلط.";
  if (m.includes("short")) return "كلمة السر لازم ٨ حروف على الأقل.";
  if (m.includes("origin")) return "المتصفح رفض الطلب. افتح التطبيق من الصفحة الأساسية.";
  return "متعذر إكمال الدخول. تأكد من البيانات وحاول تاني.";
}

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [extraPhone, setExtraPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const login = identifierToLogin(identifier);
      if (password.length < 8) throw new Error("كلمة السر لازم ٨ حروف على الأقل.");
      if (mode === "up") {
        const display = name.trim();
        if (display.length < 2) throw new Error("اكتب اسمك ظاهر للناس.");
        const signed = await authClient.signUp.email({
          email: login.email,
          password,
          name: display,
        });
        if (signed.error) throw new Error(authArabic(signed.error.message));
        stash(signed.data?.token);
        if (!signed.data?.token) {
          const again = await authClient.signIn.email({ email: login.email, password });
          if (again.error) throw new Error(authArabic(again.error.message));
          stash(again.data?.token);
        }
      } else {
        const signed = await authClient.signIn.email({ email: login.email, password });
        if (signed.error) throw new Error(authArabic(signed.error.message));
        stash(signed.data?.token);
      }
      await authClient.getSession();
      if (mode === "up") {
        const phone = login.phone ?? extraPhone.trim();
        try {
          await updateProfile({ data: { displayName: name.trim(), phone, city: "" } });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "الحساب اتعمل، بس البيانات ناقصة. كمّلها من حسابي.");
        }
      }
      void navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حصل خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl font-bold">دخول Like New</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          بإيميل أو رقم موبايل. كلمة السر متشفرة، والأدمن بيتحدد من السيرفر مش من الصفحة.
        </p>
        <div className="mt-5 grid grid-cols-2 rounded-2xl border border-line bg-card p-1">
          <button
            type="button"
            onClick={() => setMode("up")}
            className={`h-11 rounded-xl text-sm font-bold ${mode === "up" ? "bg-green text-on-green" : ""}`}
          >
            حساب جديد
          </button>
          <button
            type="button"
            onClick={() => setMode("in")}
            className={`h-11 rounded-xl text-sm font-bold ${mode === "in" ? "bg-green text-on-green" : ""}`}
          >
            عندي حساب
          </button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-4">
          {mode === "up" ? (
            <Field label="الاسم الظاهر">
              <input className={controlClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
          ) : null}
          <Field label="الإيميل أو رقم الموبايل">
            <input
              className={controlClass}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="name@email.com أو 01xxxxxxxxx"
              autoComplete="username"
              required
            />
          </Field>
          {mode === "up" && identifier.includes("@") ? (
            <Field label="موبايل اختياري">
              <input
                className={controlClass}
                value={extraPhone}
                onChange={(e) => setExtraPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                inputMode="tel"
              />
            </Field>
          ) : null}
          <Field label="كلمة السر">
            <input
              className={controlClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              minLength={8}
              required
            />
          </Field>
          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl bg-green text-sm font-bold text-on-green disabled:opacity-60"
          >
            {busy ? "لحظة…" : mode === "up" ? "إنشاء الحساب" : "دخول"}
          </button>
        </form>
        <div className="my-6 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          أو
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className="space-y-2">
          {GROK_PROVIDERS.map((p) => (
            <button
              key={p.providerId}
              type="button"
              onClick={() => void signIn(p.providerId, { callbackURL: "/" })}
              className="h-12 w-full rounded-xl border border-line bg-card text-sm font-semibold"
            >
              المتابعة عبر {p.label === "Google" ? "جوجل" : p.label === "X" ? "إكس" : p.label}
            </button>
          ))}
        </div>
      </div>
    </Shell>
  );
}
