import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function HomePage() {
  const { currentUser, currentTeam, userMode, siteTitle } = useApp();

  return (
    <div className="container py-5">
      <div className="hero-card p-4 p-md-5 mb-4">
        <div className="row align-items-center g-4">
          <div className="col-lg-8">
            <span className="badge text-bg-light border mb-3">React frontend</span>
            <h1 className="display-6 fw-bold mb-3">{siteTitle}</h1>
            <p className="lead text-secondary mb-4">
              This frontend keeps the CTFd backend and API in place while moving the player experience to React.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <Link className="btn btn-dark" to="/challenges">Browse challenges</Link>
              <Link className="btn btn-outline-dark" to="/scoreboard">View scoreboard</Link>
              {!currentUser ? <Link className="btn btn-primary" to="/register">Create account</Link> : null}
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <h2 className="h5">Session snapshot</h2>
                {currentUser ? (
                  <dl className="row mb-0 small">
                    <dt className="col-5">User</dt><dd className="col-7">{currentUser.name}</dd>
                    <dt className="col-5">Score</dt><dd className="col-7">{currentUser.score ?? "—"}</dd>
                    <dt className="col-5">Place</dt><dd className="col-7">{currentUser.place ?? "—"}</dd>
                    <dt className="col-5">Mode</dt><dd className="col-7">{userMode}</dd>
                    {currentTeam ? <><dt className="col-5">Team</dt><dd className="col-7">{currentTeam.name}</dd></> : null}
                  </dl>
                ) : (
                  <p className="mb-0 text-secondary">You are not signed in yet. Use the React login/register routes to start.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
