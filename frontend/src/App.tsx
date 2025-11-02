import { useEffect, useMemo, useState } from "react";
import WorkoutsPanel from "./components/WorkoutsPanel";
import BodyMetricsPanel from "./components/BodyMetricsPanel";
import Header from "./components/Header";
import LoadingScreen from "./components/LoadingScreen";
import LoginPrompt from "./components/LoginPrompt";
import { api, type Me } from "./lib/api";

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [activeTab, setActiveTab] = useState<"workouts" | "body">("workouts");
  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoadingMe(false));
  }, []);

  const userInitials = useMemo(() => {
    const name = me?.name?.trim();
    if (!name) return "";
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2);
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }, [me?.name]);

  if (loadingMe) {
    return <LoadingScreen />;
  }

  if (!me) {
    return <LoginPrompt onLogin={() => api.login()} />;
  }

  return (
    <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userInitials={userInitials || ""}
        userName={me.name ?? me.userId}
        onLogout={() => api.logout()}
        onAddWorkout={() => setAddModalOpen(true)}
      />

      <main className="flex-1">
        {activeTab === "workouts" ? (
          <WorkoutsPanel
            addModalOpen={addModalOpen}
            onCloseAddModal={() => setAddModalOpen(false)}
          />
        ) : (
          <BodyMetricsPanel />
        )}
      </main>
    </div>
  );
}
