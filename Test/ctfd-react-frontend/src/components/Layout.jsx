import { NavLink } from "react-router-dom";
import { logout } from "../lib/ctfd";
import { useApp } from "../context/AppContext";

function linkClass({ isActive }) {
  return `nav-link ${isActive ? "active" : ""}`;
}

export default function Layout({ children }) {
  const { loading, error, currentUser, siteTitle } = useApp();

  return (
    <div className="min-vh-100 d-flex flex-column bg-body-tertiary">
      <nav className="navbar navbar-expand-lg bg-dark navbar-dark shadow-sm">
        <div className="container">
          <NavLink className="navbar-brand fw-semibold" to="/">
            {siteTitle}
          </NavLink>

          <div className="navbar-nav me-auto">
            <NavLink className={linkClass} to="/">Home</NavLink>
            <NavLink className={linkClass} to="/challenges">Challenges</NavLink>
            <NavLink className={linkClass} to="/scoreboard">Scoreboard</NavLink>
            {currentUser ? <NavLink className={linkClass} to="/settings">Settings</NavLink> : null}
          </div>

          <div className="navbar-nav ms-auto align-items-center gap-2">
            {currentUser ? (
              <>
                <span className="navbar-text small text-white-50">
                  Signed in as <span className="text-white">{currentUser.name}</span>
                </span>
                <button className="btn btn-outline-light btn-sm" onClick={logout}>Logout</button>
              </>
            ) : (
              <>
                <NavLink className="btn btn-outline-light btn-sm" to="/login">Login</NavLink>
                <NavLink className="btn btn-primary btn-sm" to="/register">Register</NavLink>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-grow-1">
        {loading ? (
          <div className="container py-5">
            <div className="card shadow-sm border-0">
              <div className="card-body py-5 text-center">
                <div className="spinner-border" role="status" />
                <p className="mt-3 mb-0 text-secondary">Connecting to CTFd…</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {error ? (
              <div className="container py-3">
                <div className="alert alert-danger mb-0">{error}</div>
              </div>
            ) : null}
            {children}
          </>
        )}
      </main>

      <footer className="border-top bg-white">
        <div className="container py-3 text-center text-secondary small">
          React frontend for the public CTFd experience
        </div>
      </footer>
    </div>
  );
}
