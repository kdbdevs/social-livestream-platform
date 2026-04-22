import { ContentCard, MaterialIcon, PageContainer, PageHeader, PrimaryButton, SectionHeader } from "../../components/layout.js";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../state/session.js";

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useSession();

  if (!user) {
    return null;
  }

  const statusAccent =
    user.role === "HOST" || user.role === "ADMIN"
      ? {
          icon: "verified_user",
          label: "Creator access is active",
          className: "border-[rgb(105_246_184_/_0.2)] bg-[rgb(105_246_184_/_0.08)] text-tertiary",
        }
      : {
          icon: "bolt",
          label: "Account ready for your first session",
          className: "border-[rgb(186_158_255_/_0.2)] bg-[rgb(186_158_255_/_0.08)] text-primary",
        };

  const statCards = [
    {
      title: "Total Viewers",
      value: "42,890",
      delta: "+12.5%",
      icon: "groups",
      iconClassName: "bg-[rgb(186_158_255_/_0.12)] text-primary",
    },
    {
      title: "New Followers",
      value: "1,402",
      delta: "+5.2%",
      icon: "person_add",
      iconClassName: "bg-[rgb(216_227_251_/_0.14)] text-secondary",
    },
    {
      title: "Diamonds Earned",
      value: "8,250",
      delta: "Growth",
      icon: "diamond",
      iconClassName: "bg-[rgb(105_246_184_/_0.12)] text-tertiary",
      valueClassName: "text-tertiary",
    },
  ];

  const recentSessions = [
    {
      title: "Late Night Ranked Grind",
      duration: "04:12:33",
      peakViewers: "2.4k",
      status: "Live",
      statusClassName: "bg-[rgb(255_110_132_/_0.12)] text-error",
      coverClassName: "from-[rgba(132,85,239,0.95)] to-[rgba(31,43,73,0.8)]",
    },
    {
      title: "Sub-Sunday Chill Vibes",
      duration: "06:45:10",
      peakViewers: "1.8k",
      status: "Ended",
      statusClassName: "bg-[rgb(25_37_64_/_0.85)] text-on-surface-variant",
      coverClassName: "from-[rgba(60,71,90,0.95)] to-[rgba(15,25,48,0.85)]",
    },
    {
      title: "New Update Review",
      duration: "Tomorrow",
      peakViewers: "--",
      status: "Scheduled",
      statusClassName: "border border-[rgb(186_158_255_/_0.2)] bg-[rgb(186_158_255_/_0.08)] text-primary",
      coverClassName: "from-[rgba(88,231,171,0.3)] to-[rgba(15,25,48,0.9)]",
    },
  ];

  const supportCards = [
    {
      title: "Host Toolkits",
      description: "Download OBS overlays, intro scenes, and branded transition packs.",
      icon: "auto_awesome",
      iconClassName: "bg-secondary-container text-secondary",
    },
    {
      title: "Partner Support",
      description: "Open a fast lane with partner support whenever your stream needs backup.",
      icon: "support_agent",
      iconClassName: "bg-[rgb(105_246_184_/_0.12)] text-tertiary",
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Creator Home"
        title="Host Dashboard"
        description={`Welcome back, ${user.name}. Your stream energy is high today, and this dashboard follows the host dashboard composition while keeping the same global shell.`}
        actions={
          <div
            className={`inline-flex items-center gap-3 rounded-xl border px-4 py-2 text-sm font-semibold ${statusAccent.className}`}
          >
            <MaterialIcon name={statusAccent.icon} filled className="text-lg" />
            <span>{statusAccent.label}</span>
          </div>
        }
      />

      <section className="grid gap-5 md:grid-cols-3">
        {statCards.map((card) => (
          <ContentCard
            key={card.title}
            className="group bg-surface-container transition duration-300 hover:-translate-y-1 hover:bg-surface-container-high"
          >
            <div className="flex items-start justify-between gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${card.iconClassName}`}>
                <MaterialIcon name={card.icon} filled={card.icon === "diamond"} className="text-[24px]" />
              </div>
              <span className="rounded-full bg-[rgb(105_246_184_/_0.1)] px-2.5 py-1 text-xs font-bold text-tertiary">
                {card.delta}
              </span>
            </div>
            <p className="mt-5 text-sm font-medium text-on-surface-variant">{card.title}</p>
            <p className={`mt-2 font-display text-3xl font-black tracking-tight text-on-surface ${card.valueClassName ?? ""}`}>
              {card.value}
            </p>
          </ContentCard>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <ContentCard className="overflow-hidden bg-surface-container-low p-0">
          <div className="flex items-center justify-between border-b border-[rgb(64_72_93_/_0.18)] px-6 py-5">
            <SectionHeader
              title="Recent Live Sessions"
              description="A dashboard table inspired by the stitch host layout, adapted to the existing card system."
            />
            <button type="button" className="text-sm font-semibold text-primary transition hover:text-primary-fixed">
              View All
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-[rgb(64_72_93_/_0.14)] text-xs uppercase tracking-[0.18em] text-on-surface-variant">
                  <th className="px-6 py-4 font-bold">Session Name</th>
                  <th className="px-6 py-4 font-bold">Duration</th>
                  <th className="px-6 py-4 font-bold">Peak Viewers</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((session) => (
                  <tr key={session.title} className="border-b border-[rgb(64_72_93_/_0.1)] last:border-b-0 hover:bg-surface-container">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gradient-to-br ${session.coverClassName}`}
                        >
                          <MaterialIcon name="live_tv" className="text-lg text-on-surface" />
                        </div>
                        <span className="text-sm font-bold text-on-surface">{session.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{session.duration}</td>
                    <td className="px-6 py-4 text-sm font-display font-bold text-on-surface">{session.peakViewers}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${session.statusClassName}`}
                      >
                        {session.status === "Live" ? <span className="h-1.5 w-1.5 rounded-full bg-error" /> : null}
                        {session.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ContentCard>

        <div className="space-y-6">
          <ContentCard className="relative overflow-hidden border-[rgb(186_158_255_/_0.2)] bg-surface-container p-8">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[rgb(186_158_255_/_0.12)] blur-3xl" />
            <div className="relative z-10 space-y-4">
              <h2 className="font-display text-3xl font-black tracking-tight text-on-surface">
                Ready to start your next session?
              </h2>
              <p className="text-sm leading-7 text-on-surface-variant">
                Connect with your audience, go live instantly, and keep the same polished shell from Home.
              </p>
              <PrimaryButton className="w-full justify-center" onClick={() => navigate("/go-live")}>
                Go Live Now
              </PrimaryButton>
            </div>
          </ContentCard>

          <ContentCard className="bg-surface-container-high">
            <SectionHeader title="Streamer Level Progress" description="A compact utility panel that mirrors the host dashboard reference." />
            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant">Level 4</span>
                  <span className="font-bold text-on-surface">85%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-background">
                  <div className="h-full w-[85%] rounded-full bg-primary" />
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-background/60 p-3">
                <MaterialIcon name="military_tech" className="text-lg text-tertiary" />
                <p className="text-xs text-on-surface-variant">
                  <span className="font-bold text-on-surface">Next unlock:</span> Custom emotes slot
                </p>
              </div>
            </div>
          </ContentCard>

          <ContentCard className="bg-surface-container-high">
            <SectionHeader title="Account Snapshot" description="Session-aware details pulled from backend auth." />
            <div className="mt-5 grid gap-3 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-background/55 px-4 py-3">
                <span className="text-on-surface-variant">Role</span>
                <span className="font-semibold text-on-surface">{user.role}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-background/55 px-4 py-3">
                <span className="text-on-surface-variant">Status</span>
                <span className="font-semibold text-on-surface">{user.status}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-background/55 px-4 py-3">
                <span className="text-on-surface-variant">Joined</span>
                <span className="font-semibold text-on-surface">{formatJoinedDate(user.createdAt)}</span>
              </div>
            </div>
          </ContentCard>
        </div>
      </section>

      <section className="grid gap-6 pb-6 md:grid-cols-2">
        {supportCards.map((card) => (
          <ContentCard key={card.title} className="flex items-center gap-4 bg-surface-container transition hover:bg-surface-container-high">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${card.iconClassName}`}>
              <MaterialIcon name={card.icon} className="text-[22px]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface">{card.title}</h3>
              <p className="mt-1 text-xs text-on-surface-variant">{card.description}</p>
            </div>
          </ContentCard>
        ))}
      </section>
    </PageContainer>
  );
}

function formatJoinedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
