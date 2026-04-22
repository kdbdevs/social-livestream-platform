import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ContentCard,
  MaterialIcon,
  PageContainer,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from "../../components/layout.js";
import { apiRequest, ApiError } from "../../lib/api.js";
import { useSession } from "../../state/session.js";

type SettingsProfile = {
  id: string;
  email: string;
  username: string | null;
  role: "VIEWER" | "HOST" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  avatarUrl: string | null;
  bio: string | null;
  countryCode: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

type NotificationPreferences = {
  hostLive: boolean;
  paymentSuccess: boolean;
  withdrawalStatus: boolean;
  moderationAlerts: boolean;
  preferredChannel: "PUSH" | "EMAIL" | "IN_APP";
};

type AccountSettingsResponse = {
  profile: SettingsProfile;
  notifications: NotificationPreferences;
};

export function SettingsPage() {
  const { accessToken, user, refreshSession, applySession } = useSession();
  const [settings, setSettings] = useState<AccountSettingsResponse | null>(null);
  const [profileForm, setProfileForm] = useState({
    username: "",
    avatarUrl: "",
    bio: "",
    countryCode: "",
  });
  const [notificationForm, setNotificationForm] = useState<NotificationPreferences>({
    hostLive: true,
    paymentSuccess: true,
    withdrawalStatus: true,
    moderationAlerts: true,
    preferredChannel: "PUSH",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [notificationError, setNotificationError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSettings() {
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError("");

      try {
        const response = await apiRequest<AccountSettingsResponse>("/account/settings", {
          token: accessToken,
          signal: controller.signal,
        });

        setSettings(response);
        setProfileForm({
          username: response.profile.username ?? "",
          avatarUrl: response.profile.avatarUrl ?? "",
          bio: response.profile.bio ?? "",
          countryCode: response.profile.countryCode ?? "",
        });
        setNotificationForm(response.notifications);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setLoadError(resolveErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    }

    void loadSettings();

    return () => {
      controller.abort();
    };
  }, [accessToken]);

  const profileCompletion = useMemo(() => {
    const checkpoints = [
      Boolean(profileForm.username.trim()),
      Boolean(profileForm.avatarUrl.trim()),
      Boolean(profileForm.bio.trim()),
      Boolean(profileForm.countryCode.trim()),
    ];

    return Math.round((checkpoints.filter(Boolean).length / checkpoints.length) * 100);
  }, [profileForm]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setProfileError("");
    setProfileMessage("");

    if (!profileForm.username.trim()) {
      setProfileError("Username wajib diisi.");
      return;
    }

    if (profileForm.countryCode.trim() && profileForm.countryCode.trim().length !== 2) {
      setProfileError("Country code harus 2 huruf, misalnya ID atau US.");
      return;
    }

    setIsSavingProfile(true);

    try {
      const response = await apiRequest<{ profile: SettingsProfile }>("/account/profile", {
        method: "PATCH",
        token: accessToken,
        body: {
          username: profileForm.username.trim(),
          avatarUrl: profileForm.avatarUrl.trim() || null,
          bio: profileForm.bio.trim() || null,
          countryCode: profileForm.countryCode.trim().toUpperCase() || null,
        },
      });

      setSettings((current) => (current ? { ...current, profile: response.profile } : current));
      setProfileForm({
        username: response.profile.username ?? "",
        avatarUrl: response.profile.avatarUrl ?? "",
        bio: response.profile.bio ?? "",
        countryCode: response.profile.countryCode ?? "",
      });
      setProfileMessage("Profil berhasil diperbarui.");
      await refreshSession();
    } catch (error) {
      setProfileError(resolveErrorMessage(error));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleNotificationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setNotificationError("");
    setNotificationMessage("");
    setIsSavingNotifications(true);

    try {
      const response = await apiRequest<{ notifications: NotificationPreferences }>("/account/notifications", {
        method: "PATCH",
        token: accessToken,
        body: notificationForm,
      });

      setSettings((current) => (current ? { ...current, notifications: response.notifications } : current));
      setNotificationForm(response.notifications);
      setNotificationMessage("Preferensi notifikasi berhasil disimpan.");
    } catch (error) {
      setNotificationError(resolveErrorMessage(error));
    } finally {
      setIsSavingNotifications(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setPasswordError("");
    setPasswordMessage("");

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError("Semua field password wajib diisi.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Konfirmasi password baru belum sama.");
      return;
    }

    setIsSavingPassword(true);

    try {
      const response = await apiRequest<{
        user: {
          id: string;
          email: string;
          username: string | null;
          role: string;
          status: string;
          avatarUrl: string | null;
          createdAt: string;
        };
        accessToken: string;
      }>("/account/password", {
        method: "POST",
        token: accessToken,
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
      });

      applySession(response);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordMessage("Password berhasil diubah. Session aktif juga sudah diperbarui.");
    } catch (error) {
      setPasswordError(resolveErrorMessage(error));
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Settings"
        title="Manage Your Profile"
        description="Semua kontrol di halaman ini tersambung ke backend yang tersedia, jadi user bisa benar-benar mengelola identitas akun, preferensi notifikasi, dan keamanan akses mereka."
        actions={
          <div className="flex flex-wrap gap-3">
            <SecondaryButton type="button" onClick={() => window.location.reload()}>
              Reload Settings
            </SecondaryButton>
          </div>
        }
      />

      {loadError ? (
        <div className="rounded-xl border border-[rgb(255_110_132_/_0.28)] bg-[rgb(167_1_56_/_0.22)] px-4 py-3 text-sm text-on-error-container">
          {loadError}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <ContentCard className="overflow-hidden">
          <div className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-[linear-gradient(135deg,rgba(19,34,62,0.96),rgba(9,17,34,0.92))] p-5">
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <ProfileAvatar name={profileForm.username || user?.name || "User"} avatarUrl={profileForm.avatarUrl || null} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-display text-3xl font-extrabold tracking-tight text-on-surface">
                    {profileForm.username || user?.name || "Your profile"}
                  </h2>
                  <span className="rounded-full border border-[rgb(105_246_184_/_0.24)] bg-[rgb(105_246_184_/_0.12)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary">
                    {settings?.profile.status ?? "ACTIVE"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-on-surface-variant">{user?.email || settings?.profile.email || "Account email"}</p>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-on-surface-variant">
                  {profileForm.bio.trim() || "Tambahkan bio singkat agar profil publik kamu lebih mudah dikenali oleh viewer lain."}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InsightCard
              icon="person"
              title="Profile Completion"
              value={`${profileCompletion}%`}
              meta="Mengukur kelengkapan field profil yang bisa dikelola user."
            />
            <InsightCard
              icon="verified_user"
              title="Account Role"
              value={settings?.profile.role ?? user?.role ?? "VIEWER"}
              meta="Role akun aktif yang dipakai backend untuk otorisasi."
            />
            <InsightCard
              icon="calendar_month"
              title="Joined"
              value={settings ? formatDate(settings.profile.createdAt) : "..."}
              meta="Tanggal akun dibuat di sistem."
            />
            <InsightCard
              icon="login"
              title="Last Login"
              value={settings?.profile.lastLoginAt ? formatDateTime(settings.profile.lastLoginAt) : "No recent record"}
              meta="Waktu login terakhir yang tersimpan di backend."
            />
          </div>
        </ContentCard>

        <ContentCard>
          <SectionHeader
            title="Profile Preview"
            description="Preview ini mengambil nilai yang sedang kamu edit sebelum disimpan."
          />
          <div className="mt-5 rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-5">
            <div className="flex items-center gap-4">
              <ProfileAvatar name={profileForm.username || user?.name || "User"} avatarUrl={profileForm.avatarUrl || null} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-on-surface">{profileForm.username || user?.name || "Username"}</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  @{(profileForm.username || user?.name || "neonpulse").replace(/[^a-zA-Z0-9_]+/g, "").toLowerCase()}
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <ReadOnlyRow label="Email" value={settings?.profile.email ?? user?.email ?? "-"} />
              <ReadOnlyRow label="Country" value={profileForm.countryCode.trim().toUpperCase() || "Not set"} />
              <ReadOnlyRow label="Preferred Alerts" value={notificationLabel(notificationForm.preferredChannel)} />
            </div>
          </div>
        </ContentCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <ContentCard>
          <SectionHeader
            title="Public Profile"
            description="Field di bawah ini tersimpan di backend dan bisa dipakai UI lain seperti room watch, following list, dan profile chip."
          />

          {profileError ? <InlineAlert tone="error" message={profileError} /> : null}
          {profileMessage ? <InlineAlert tone="success" message={profileMessage} /> : null}

          <form className="mt-5 space-y-4" onSubmit={handleProfileSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                label="Username"
                value={profileForm.username}
                placeholder="creator_handle"
                onChange={(value) => setProfileForm((current) => ({ ...current, username: value }))}
              />
              <InputField
                label="Country Code"
                value={profileForm.countryCode}
                placeholder="ID"
                maxLength={2}
                onChange={(value) => setProfileForm((current) => ({ ...current, countryCode: value.toUpperCase() }))}
              />
            </div>

            <InputField
              label="Avatar URL"
              value={profileForm.avatarUrl}
              placeholder="https://example.com/avatar.jpg"
              onChange={(value) => setProfileForm((current) => ({ ...current, avatarUrl: value }))}
            />

            <TextAreaField
              label="Bio"
              value={profileForm.bio}
              placeholder="Ceritakan sedikit tentang kamu, konten yang kamu suka, atau identitas publik akun ini."
              rows={5}
              onChange={(value) => setProfileForm((current) => ({ ...current, bio: value }))}
            />

            <div className="flex flex-wrap gap-3">
              <PrimaryButton type="submit" disabled={isSavingProfile || isLoading}>
                {isSavingProfile ? "Saving profile..." : "Save Profile"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() => {
                  if (!settings) {
                    return;
                  }

                  setProfileForm({
                    username: settings.profile.username ?? "",
                    avatarUrl: settings.profile.avatarUrl ?? "",
                    bio: settings.profile.bio ?? "",
                    countryCode: settings.profile.countryCode ?? "",
                  });
                  setProfileError("");
                  setProfileMessage("");
                }}
              >
                Reset Changes
              </SecondaryButton>
            </div>
          </form>
        </ContentCard>

        <ContentCard>
          <SectionHeader
            title="Notification Preferences"
            description="Semua toggle ini tersimpan di tabel notification preferences milik user."
          />

          {notificationError ? <InlineAlert tone="error" message={notificationError} /> : null}
          {notificationMessage ? <InlineAlert tone="success" message={notificationMessage} /> : null}

          <form className="mt-5 space-y-4" onSubmit={handleNotificationSubmit}>
            <ToggleField
              label="Followed host goes live"
              description="Notifikasi saat user yang kamu follow mulai live."
              checked={notificationForm.hostLive}
              onChange={(checked) => setNotificationForm((current) => ({ ...current, hostLive: checked }))}
            />
            <ToggleField
              label="Payment success"
              description="Konfirmasi untuk top-up atau transaksi pembayaran berhasil."
              checked={notificationForm.paymentSuccess}
              onChange={(checked) => setNotificationForm((current) => ({ ...current, paymentSuccess: checked }))}
            />
            <ToggleField
              label="Withdrawal status"
              description="Update status pencairan untuk akun creator."
              checked={notificationForm.withdrawalStatus}
              onChange={(checked) => setNotificationForm((current) => ({ ...current, withdrawalStatus: checked }))}
            />
            <ToggleField
              label="Moderation alerts"
              description="Peringatan yang berkaitan dengan keamanan atau moderasi akun."
              checked={notificationForm.moderationAlerts}
              onChange={(checked) => setNotificationForm((current) => ({ ...current, moderationAlerts: checked }))}
            />

            <SelectField
              label="Preferred Channel"
              value={notificationForm.preferredChannel}
              onChange={(value) =>
                setNotificationForm((current) => ({
                  ...current,
                  preferredChannel: value as NotificationPreferences["preferredChannel"],
                }))
              }
              options={[
                { value: "PUSH", label: "Push Notification" },
                { value: "EMAIL", label: "Email" },
                { value: "IN_APP", label: "In-App Inbox" },
              ]}
            />

            <PrimaryButton type="submit" disabled={isSavingNotifications || isLoading}>
              {isSavingNotifications ? "Saving preferences..." : "Save Notifications"}
            </PrimaryButton>
          </form>
        </ContentCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <ContentCard>
          <SectionHeader
            title="Security"
            description="Password change di bawah akan memperbarui kredensial di backend dan menerbitkan session token baru."
          />

          {passwordError ? <InlineAlert tone="error" message={passwordError} /> : null}
          {passwordMessage ? <InlineAlert tone="success" message={passwordMessage} /> : null}

          <form className="mt-5 space-y-4" onSubmit={handlePasswordSubmit}>
            <InputField
              label="Current Password"
              type="password"
              value={passwordForm.currentPassword}
              placeholder="Masukkan password sekarang"
              onChange={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))}
            />
            <InputField
              label="New Password"
              type="password"
              value={passwordForm.newPassword}
              placeholder="Masukkan password baru"
              onChange={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))}
            />
            <InputField
              label="Confirm New Password"
              type="password"
              value={passwordForm.confirmPassword}
              placeholder="Ulangi password baru"
              onChange={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))}
            />

            <PrimaryButton type="submit" disabled={isSavingPassword || isLoading}>
              {isSavingPassword ? "Updating password..." : "Update Password"}
            </PrimaryButton>
          </form>
        </ContentCard>

        <ContentCard>
          <SectionHeader
            title="Account Snapshot"
            description="Ringkasan ini membantu user melihat state akun tanpa membuka halaman lain."
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <SnapshotCard
              title="Session Handle"
              value={user?.handle ?? "@neonpulse"}
              meta="Diambil dari session frontend setelah sinkronisasi auth."
            />
            <SnapshotCard
              title="Backend Status"
              value={settings?.profile.status ?? "ACTIVE"}
              meta="Status akun yang dipakai saat authorization."
            />
            <SnapshotCard
              title="Notification Mode"
              value={notificationLabel(notificationForm.preferredChannel)}
              meta="Channel preferensi notifikasi yang saat ini tersimpan."
            />
            <SnapshotCard
              title="Profile Bio"
              value={profileForm.bio.trim() ? `${profileForm.bio.trim().length} chars` : "Empty"}
              meta="Membantu user menjaga ringkas atau memperkaya bio."
            />
          </div>
        </ContentCard>
      </section>
    </PageContainer>
  );
}

function InsightCard({ icon, title, value, meta }: { icon: string; title: string; value: string; meta: string }) {
  return (
    <div className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(186,158,255,0.12)] text-primary">
        <MaterialIcon name={icon} className="text-xl" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary">{title}</p>
      <p className="mt-2 text-xl font-bold text-on-surface">{value}</p>
      <p className="mt-2 text-sm text-on-surface-variant">{meta}</p>
    </div>
  );
}

function SnapshotCard({ title, value, meta }: { title: string; value: string; meta: string }) {
  return (
    <div className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{title}</p>
      <p className="mt-3 text-lg font-bold text-on-surface">{value}</p>
      <p className="mt-2 text-sm text-on-surface-variant">{meta}</p>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[rgb(64_72_93_/_0.18)] bg-surface-container px-4 py-3">
      <span className="text-sm text-on-surface-variant">{label}</span>
      <span className="text-sm font-semibold text-on-surface">{value}</span>
    </div>
  );
}

function InlineAlert({ tone, message }: { tone: "error" | "success"; message: string }) {
  return (
    <div
      className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
        tone === "error"
          ? "border-[rgb(255_110_132_/_0.28)] bg-[rgb(167_1_56_/_0.22)] text-on-error-container"
          : "border-[rgb(105_246_184_/_0.24)] bg-[rgb(105_246_184_/_0.12)] text-tertiary"
      }`}
    >
      {message}
    </div>
  );
}

function InputField({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
  maxLength,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-on-surface">{label}</span>
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-lg border border-[rgb(64_72_93_/_0.28)] bg-surface-container-low px-4 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant focus:border-[rgb(186_158_255_/_0.45)] focus:ring-2 focus:ring-[rgb(186_158_255_/_0.22)]"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  placeholder,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-on-surface">{label}</span>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-[rgb(64_72_93_/_0.28)] bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant focus:border-[rgb(186_158_255_/_0.45)] focus:ring-2 focus:ring-[rgb(186_158_255_/_0.22)]"
      />
    </label>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-4">
      <div>
        <p className="text-sm font-semibold text-on-surface">{label}</p>
        <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
      </div>
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
          checked ? "bg-primary" : "bg-surface-container-low"
        }`}
      >
        <span
          className={`absolute h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-[24px]" : "left-[4px]"
          }`}
        />
      </button>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-on-surface">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-lg border border-[rgb(64_72_93_/_0.28)] bg-surface-container-low px-4 text-sm text-on-surface outline-none transition focus:border-[rgb(186_158_255_/_0.45)] focus:ring-2 focus:ring-[rgb(186_158_255_/_0.22)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProfileAvatar({ name, avatarUrl, size }: { name: string; avatarUrl: string | null; size: "md" | "lg" }) {
  const dimension = size === "lg" ? "h-20 w-20" : "h-14 w-14";

  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${dimension} rounded-full border border-[rgb(186_158_255_/_0.28)] object-cover`} />;
  }

  return (
    <div className={`${dimension} flex items-center justify-center rounded-full border border-[rgb(186_158_255_/_0.28)] bg-surface-container text-sm font-bold text-on-surface`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function notificationLabel(value: NotificationPreferences["preferredChannel"]) {
  if (value === "EMAIL") {
    return "Email";
  }

  if (value === "IN_APP") {
    return "In-App Inbox";
  }

  return "Push Notification";
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan tak terduga.";
}
