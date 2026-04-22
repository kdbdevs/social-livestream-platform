import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ContentCard,
  PageContainer,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from "../../components/layout.js";
import { ApiError } from "../../lib/api.js";
import { useSession } from "../../state/session.js";

type Mode = "login" | "register";

export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register, user, isLoading } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setMode(params.get("mode") === "register" ? "register" : "login");
  }, [location.search]);

  const pageMeta = useMemo(
    () =>
      mode === "login"
        ? {
            title: "Welcome Back",
            description: "The page keeps the exact same global navbar and sidebar. Only the main content panel changes.",
          }
        : {
            title: "Create Your Account",
            description: "Register lives in the same master shell, typography, spacing, and color system as Home.",
          },
    [mode],
  );

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!loginForm.email || !loginForm.password) {
      setError("Email dan password wajib diisi.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login(loginForm);
      setSuccess("Login berhasil. Session kamu sudah aktif.");
    } catch (submitError) {
      setError(resolveErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!registerForm.username || !registerForm.email || !registerForm.password) {
      setError("Semua field wajib diisi.");
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setError("Konfirmasi password belum sama.");
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        username: registerForm.username,
        email: registerForm.email,
        password: registerForm.password,
      });
      setSuccess("Akun berhasil dibuat dan session kamu sudah aktif.");
    } catch (submitError) {
      setError(resolveErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isLoading && user) {
    return (
      <PageContainer>
        <PageHeader
          eyebrow="Account Access"
          title="You Are Signed In"
          description="Session tetap aktif tanpa redirect otomatis. Kamu bisa lanjut menjelajah Home atau buka dashboard kapan pun."
        />

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <ContentCard className="auth-hero-panel overflow-hidden p-8 md:p-10">
            <div className="max-w-xl">
              <p className="mb-4 inline-flex rounded-full border border-[rgb(64_72_93_/_0.28)] bg-surface-container-high px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-tertiary">
                Session Active
              </p>
              <h2 className="font-display text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
                Welcome back, <span className="brand-logo-gradient">{user.name}</span>
              </h2>
              <p className="mt-4 text-base leading-7 text-on-surface-variant">
                Akun unified kamu sudah aktif sebagai viewer dan siap dipakai untuk masuk ke fitur creator kapan saja.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <AuthInfoCard title="Current Role" description={user.role} />
                <AuthInfoCard title="Account Status" description={user.status} />
              </div>
            </div>
          </ContentCard>

          <ContentCard className="p-6 sm:p-8">
            <SectionHeader
              title="Session Ready"
              description="Kami tidak mengarahkan kamu otomatis ke dashboard lagi. Pilih tujuan berikut sesuai kebutuhan."
            />

            {success ? (
              <div className="mt-6 rounded-xl border border-[rgb(105_246_184_/_0.24)] bg-[rgb(105_246_184_/_0.12)] px-4 py-3 text-sm text-tertiary">
                {success}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-[rgb(105_246_184_/_0.24)] bg-[rgb(105_246_184_/_0.12)] px-4 py-3 text-sm text-tertiary">
                Session kamu masih aktif di browser ini.
              </div>
            )}

            <div className="mt-6 grid gap-3">
              <PrimaryButton type="button" className="w-full justify-center" onClick={() => navigate("/")}>
                Kembali ke Home
              </PrimaryButton>
              <SecondaryButton type="button" className="w-full justify-center" onClick={() => navigate("/dashboard")}>
                Buka Dashboard
              </SecondaryButton>
            </div>

            <div className="mt-6 rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-4">
              <p className="text-sm font-semibold text-on-surface">Current Session</p>
              <div className="mt-3 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-on-surface-variant">Email</span>
                  <span className="font-medium text-on-surface">{user.email}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-on-surface-variant">Handle</span>
                  <span className="font-medium text-on-surface">{user.handle}</span>
                </div>
              </div>
            </div>
          </ContentCard>
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader eyebrow="Account Access" title={pageMeta.title} description={pageMeta.description} />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <ContentCard className="auth-hero-panel overflow-hidden p-8 md:p-10">
          <div className="max-w-xl">
            <p className="mb-4 inline-flex rounded-full border border-[rgb(64_72_93_/_0.28)] bg-surface-container-high px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-tertiary">
              Consistent Home Layout
            </p>
            <h2 className="font-display text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
              Keep the shell. <span className="brand-logo-gradient">Swap the content.</span>
            </h2>
            <p className="mt-4 text-base leading-7 text-on-surface-variant">
              Navbar, logo, search, sidebar order, and design tokens stay permanent. This page only changes what
              happens inside the main content canvas.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <AuthInfoCard
                title="Global Navbar"
                description="Brand, search, auth/profile area, and action icons stay fixed across all pages."
              />
              <AuthInfoCard
                title="Persistent Sidebar"
                description="Home, Following, Browse, Esports, Clips, Settings, and Help remain in the same order."
              />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <SecondaryButton type="button" onClick={() => setMode("login")}>Login View</SecondaryButton>
              <PrimaryButton type="button" onClick={() => setMode("register")}>Register View</PrimaryButton>
            </div>
          </div>
        </ContentCard>

        <ContentCard className="p-6 sm:p-8">
          <div className="mb-6 inline-flex rounded-full border border-[rgb(64_72_93_/_0.28)] bg-surface-container-low p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                mode === "login" ? "bg-primary text-on-primary-fixed" : "text-on-surface-variant"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                mode === "register" ? "bg-primary text-on-primary-fixed" : "text-on-surface-variant"
              }`}
            >
              Daftar
            </button>
          </div>

          <SectionHeader
            title={mode === "login" ? "Sign in to NEONPULSE" : "Create your NEONPULSE account"}
            description="Only the form panel changes. Everything around it still follows the Home shell."
          />

          <div className="mt-6 space-y-3">
            <SecondaryButton type="button" className="w-full justify-center" disabled>
              Continue with Google
            </SecondaryButton>
            <SecondaryButton type="button" className="w-full justify-center" disabled>
              Continue with Apple
            </SecondaryButton>
          </div>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-[rgb(64_72_93_/_0.28)]" />
            <span className="text-xs font-medium uppercase tracking-[0.24em] text-on-surface-variant">Or continue with</span>
            <div className="h-px flex-1 bg-[rgb(64_72_93_/_0.28)]" />
          </div>

          {error ? (
            <div className="mb-5 rounded-xl border border-[rgb(255_110_132_/_0.28)] bg-[rgb(167_1_56_/_0.22)] px-4 py-3 text-sm text-on-error-container">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mb-5 rounded-xl border border-[rgb(105_246_184_/_0.24)] bg-[rgb(105_246_184_/_0.12)] px-4 py-3 text-sm text-tertiary">
              {success}
            </div>
          ) : null}

          {mode === "login" ? (
            <form className="space-y-4" onSubmit={handleLoginSubmit}>
              <InputField
                label="Email"
                value={loginForm.email}
                placeholder="name@example.com"
                type="email"
                onChange={(value) => setLoginForm((current) => ({ ...current, email: value }))}
              />
              <InputField
                label="Password"
                value={loginForm.password}
                placeholder="Enter your password"
                type="password"
                hint={
                  <button type="button" className="text-xs text-primary" disabled>
                    Forgot password?
                  </button>
                }
                onChange={(value) => setLoginForm((current) => ({ ...current, password: value }))}
              />
              <PrimaryButton type="submit" className="w-full justify-center" disabled={isSubmitting || isLoading}>
                {isSubmitting ? "Signing in..." : "Login"}
              </PrimaryButton>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleRegisterSubmit}>
              <InputField
                label="Username"
                value={registerForm.username}
                placeholder="creator_handle"
                type="text"
                onChange={(value) => setRegisterForm((current) => ({ ...current, username: value }))}
              />
              <InputField
                label="Email"
                value={registerForm.email}
                placeholder="name@example.com"
                type="email"
                onChange={(value) => setRegisterForm((current) => ({ ...current, email: value }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label="Password"
                  value={registerForm.password}
                  placeholder="Choose password"
                  type="password"
                  onChange={(value) => setRegisterForm((current) => ({ ...current, password: value }))}
                />
                <InputField
                  label="Confirm Password"
                  value={registerForm.confirmPassword}
                  placeholder="Repeat password"
                  type="password"
                  onChange={(value) => setRegisterForm((current) => ({ ...current, confirmPassword: value }))}
                />
              </div>
              <PrimaryButton type="submit" className="w-full justify-center" disabled={isSubmitting || isLoading}>
                {isSubmitting ? "Creating account..." : "Daftar"}
              </PrimaryButton>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-on-surface-variant">
            {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
            <button
              type="button"
              onClick={() => setMode((current) => (current === "login" ? "register" : "login"))}
              className="font-semibold text-primary"
            >
              {mode === "login" ? "Daftar" : "Login"}
            </button>
          </p>

          <p className="mt-4 text-center text-xs text-on-surface-variant">
            <Link to="/" className="transition hover:text-on-surface">
              Return to Home
            </Link>
          </p>
        </ContentCard>
      </section>
    </PageContainer>
  );
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan tak terduga. Coba lagi.";
}

function AuthInfoCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container p-4">
      <h3 className="text-sm font-bold text-on-surface">{title}</h3>
      <p className="mt-2 text-sm text-on-surface-variant">{description}</p>
    </div>
  );
}

function InputField({
  label,
  value,
  placeholder,
  type,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  type: string;
  hint?: ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-on-surface">{label}</span>
        {hint}
      </div>
      <input
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-lg border border-[rgb(64_72_93_/_0.28)] bg-surface-container-low px-4 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant focus:border-[rgb(186_158_255_/_0.45)] focus:ring-2 focus:ring-[rgb(186_158_255_/_0.22)]"
      />
    </label>
  );
}
