import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { authApi } from "../lib/api";

function linkClass({ isActive }) {
  return `nav-link px-3 ${isActive ? "active" : ""}`;
}

export default function Layout({ children }) {
  const { loading, error, settings, announcements, currentUser, refreshSession } = useApp();
  const navigate = useNavigate();
  const [showToast, setShowToast] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [lastReadId, setLastReadId] = useState(() => localStorage.getItem("ctfd:lastReadAnnouncementId") || "");

  const latestAnnouncement = announcements[0] || null;
  const unread = useMemo(() => {
    if (!latestAnnouncement) return false;
    return lastReadId !== latestAnnouncement.id;
  }, [latestAnnouncement, lastReadId]);

  useEffect(() => {
    if (!unread || !latestAnnouncement) return;
    setShowToast(true);
    const timer = setTimeout(() => setShowToast(false), 5000);
    return () => clearTimeout(timer);
  }, [unread, latestAnnouncement?.id]);

  async function logout() {
    await authApi.logout();
    await refreshSession();
    navigate("/");
  }

  function markLatestAnnouncementRead() {
    if (!latestAnnouncement) return;
    localStorage.setItem("ctfd:lastReadAnnouncementId", latestAnnouncement.id);
    setLastReadId(latestAnnouncement.id);
  }

  function openAnnouncementPanel() {
    setPanelOpen(true);
    markLatestAnnouncementRead();
    setShowToast(false);
  }

  return (
    <div className="app-shell min-vh-100 d-flex flex-column">
      <nav className="navbar navbar-expand-lg ctfd-navbar sticky-top border-bottom">
        <div className="container">
          <NavLink className="navbar-brand fw-bold" to="/">{settings.siteTitle}</NavLink>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
            <span className="navbar-toggler-icon" />
          </button>
          <div className="collapse navbar-collapse" id="mainNav">
            <div className="navbar-nav me-auto">
              <NavLink className={linkClass} to="/">Home</NavLink>
              <NavLink className={linkClass} to="/challenges">Challenges</NavLink>
              <NavLink className={linkClass} to="/scoreboard">Scoreboard</NavLink>
              {currentUser?.isAdmin ? <NavLink className={linkClass} to="/admin">Admin</NavLink> : null}
            </div>
            <div className="navbar-nav ms-auto align-items-lg-center gap-2">
              {currentUser ? (
                <>
                  <NavLink className={linkClass} to="/profile">{currentUser.displayName || currentUser.username}</NavLink>
                  <button className="btn btn-sm btn-outline-light" onClick={logout}>Logout</button>
                </>
              ) : (
                <>
                  <NavLink className="btn btn-sm btn-outline-light" to="/login">Login</NavLink>
                  <NavLink className="btn btn-sm btn-warning" to="/register">Register</NavLink>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow-1 py-4 py-lg-5">
        {loading ? (
          <div className="container">
            <div className="card shadow-sm border-0">
              <div className="card-body text-center py-5">
                <div className="spinner-border text-warning" role="status" />
                <div className="mt-3 text-secondary">Laen CTF platvormi…</div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {error ? <div className="container mb-3"><div className="alert alert-danger">{error}</div></div> : null}
            {children}
          </>
        )}
      </main>

      {showToast && latestAnnouncement ? (
        <button type="button" className="announcement-toast btn btn-light shadow" onClick={openAnnouncementPanel}>
          <div className="fw-semibold text-start">{latestAnnouncement.title}</div>
          <div className="small text-secondary text-start text-truncate">{latestAnnouncement.content}</div>
        </button>
      ) : null}

      {unread && latestAnnouncement && !panelOpen ? (
        <button type="button" className="announcement-bubble btn btn-warning shadow" onClick={openAnnouncementPanel}>
          New announcement
        </button>
      ) : null}

      {panelOpen ? (
        <div className="announcement-panel shadow">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>Announcements</strong>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPanelOpen(false)}>Close</button>
          </div>
          <div className="d-grid gap-2">
            {announcements.map((item) => (
              <div key={item.id} className="announcement-item border rounded p-2 bg-white">
                <div className="fw-semibold">{item.title}</div>
                <div className="small text-secondary">{item.createdAt}</div>
                <div className="small mt-1">{item.content}</div>
              </div>
            ))}
            {!announcements.length ? <div className="small text-secondary">No announcements.</div> : null}
          </div>
        </div>
      ) : null}

      <footer className="border-top bg-white">
        <div className="container py-3 small text-secondary d-flex flex-column flex-lg-row justify-content-between gap-2">
          <span>CTFd-stiilis täisstack starter Eesti kaardiga challenge-vaate jaoks.</span>
          <span>Admin konto: admin / Admin123!</span>
        </div>
      </footer>
    </div>
  );
}
