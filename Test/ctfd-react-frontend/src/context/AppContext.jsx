import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi, settingsApi } from "../lib/api";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    siteTitle: "CTFd Estonia",
    startTime: null,
    endTime: null,
    registrationOpen: true,
    registrationVisibility: "public",
    challengeVisibility: "private",
    accountVisibility: "public",
    scoreVisibility: "public",
    paused: false,
    registrationCode: "",
    announcement: ""
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [error, setError] = useState("");

  async function bootstrap(options = {}) {
    if (!options.silent) setLoading(true);
    try {
      const [settingsResponse, userResponse] = await Promise.allSettled([
        settingsApi.get(),
        authApi.me()
      ]);

      if (settingsResponse.status === "fulfilled") {
        setSettings(settingsResponse.value.settings);
        setAnnouncements(settingsResponse.value.announcements || []);
      }

      if (userResponse.status === "fulfilled") {
        setCurrentUser(userResponse.value.user);
      } else {
        setCurrentUser(null);
      }

      setError("");
    } catch (err) {
      setError(err.message || "Backend connection failed.");
    } finally {
      if (!options.silent) setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
    const timer = setInterval(() => {
      bootstrap({ silent: true });
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const value = useMemo(() => ({
    loading,
    settings,
    announcements,
    currentUser,
    setCurrentUser,
    error,
    refreshSession: bootstrap
  }), [loading, settings, announcements, currentUser, error]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used within AppProvider");
  return value;
}
