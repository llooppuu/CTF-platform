import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getBootstrapInfo, getCurrentTeam, getCurrentUser } from "../lib/ctfd";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [bootstrap, setBootstrap] = useState({
    loading: true,
    error: "",
    siteTitle: "CTFd React",
    userMode: "users",
    csrfNonce: "",
    currentUser: null,
    currentTeam: null
  });

  async function refreshAuth() {
    try {
      const currentUser = await getCurrentUser();
      let currentTeam = null;
      try {
        currentTeam = currentUser ? await getCurrentTeam() : null;
      } catch {
        currentTeam = null;
      }

      setBootstrap((previous) => ({
        ...previous,
        currentUser,
        currentTeam
      }));
    } catch {
      setBootstrap((previous) => ({
        ...previous,
        currentUser: null,
        currentTeam: null
      }));
    }
  }

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        const info = await getBootstrapInfo();
        const currentUser = await getCurrentUser();
        let currentTeam = null;
        try {
          currentTeam = currentUser ? await getCurrentTeam() : null;
        } catch {
          currentTeam = null;
        }

        if (!active) return;

        setBootstrap({
          loading: false,
          error: "",
          siteTitle: info.siteTitle || "CTFd React",
          userMode: info.userMode || "users",
          csrfNonce: info.csrfNonce || "",
          currentUser,
          currentTeam
        });
      } catch (error) {
        if (!active) return;

        setBootstrap({
          loading: false,
          error: error?.message || "Unable to reach the CTFd backend.",
          siteTitle: "CTFd React",
          userMode: "users",
          csrfNonce: "",
          currentUser: null,
          currentTeam: null
        });
      }
    }

    run();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      ...bootstrap,
      refreshAuth
    }),
    [bootstrap]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return value;
}
