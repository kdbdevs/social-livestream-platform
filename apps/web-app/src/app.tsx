import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout.js";
import { AnalyticsPage } from "./features/analytics/analytics-page.js";
import { AuthPage } from "./features/auth/auth-page.js";
import { BrowsePage } from "./features/browse/browse-page.js";
import { DashboardPage } from "./features/dashboard/dashboard-page.js";
import { MyFeedPage } from "./features/feed/my-feed-page.js";
import { FollowingPage } from "./features/following/following-page.js";
import { GenericPage } from "./features/generic/generic-page.js";
import { HomePage } from "./features/home/home-page.js";
import { MessagesPage } from "./features/messages/messages-page.js";
import { StreamManagerPage } from "./features/host/stream-manager-page.js";
import { WatchHistoryPage } from "./features/history/watch-history-page.js";
import { StreamSetupPage } from "./features/host/stream-setup-page.js";
import { RoomWatchPage } from "./features/rooms/room-watch-page.js";
import { SettingsPage } from "./features/settings/settings-page.js";
import { SavedPage } from "./features/saved/saved-page.js";
import { useSession } from "./state/session.js";

export function App() {
  const { isAuthenticated, isLoading } = useSession();

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/rooms/:id" element={<RoomWatchPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/go-live"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <StreamSetupPage mode="go-live" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-feed"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <MyFeedPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <MessagesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/watch-history"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <WatchHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/saved"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <SavedPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stream-manager"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <StreamManagerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/earnings"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <GenericPage
                eyebrow="Host Tools"
                title="Earnings"
                description="Review monetization, payouts, and creator revenue insights from your unified dashboard."
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/following"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <FollowingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/browse"
          element={
            <BrowsePage />
          }
        />
        <Route
          path="/esports"
          element={
            <GenericPage
              eyebrow="Esports"
              title="Esports Broadcast Hub"
              description="Tournament programming, featured matchups, and live desk coverage with the same global shell."
            />
          }
        />
        <Route
          path="/clips"
          element={
            <GenericPage
              eyebrow="Clips"
              title="Trending Clips"
              description="Snackable highlights, quick replays, and viral moments surfaced inside the master layout."
            />
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/help"
          element={
            <GenericPage
              eyebrow="Help"
              title="Help Center"
              description="Support resources and troubleshooting content presented without redesigning navbar or sidebar."
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

function ProtectedRoute({
  children,
  isAuthenticated,
  isLoading,
}: {
  children: ReactNode;
  isAuthenticated: boolean;
  isLoading: boolean;
}) {
  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}
