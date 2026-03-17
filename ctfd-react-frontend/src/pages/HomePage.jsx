import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";

function toDhms(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0")
  };
}

export default function HomePage() {
  const { settings, currentUser } = useApp();
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timerState = useMemo(() => {
    const startMs = settings.startTime ? Date.parse(settings.startTime) : NaN;
    const endMs = settings.endTime ? Date.parse(settings.endTime) : NaN;

    if (Number.isFinite(startMs) && nowTick < startMs) {
      return {
        title: "CTF starts in",
        parts: toDhms(startMs - nowTick)
      };
    }

    if (Number.isFinite(endMs) && nowTick < endMs) {
      return {
        title: "CTF ends in",
        parts: toDhms(endMs - nowTick)
      };
    }

    if (Number.isFinite(endMs) && nowTick >= endMs) {
      return {
        title: "CTF ended",
        parts: toDhms(0)
      };
    }

    return {
      title: "CTF timer not set",
      parts: toDhms(0)
    };
  }, [settings.startTime, settings.endTime, nowTick]);

  return (
    <div className="container">
      <div className="row g-4 align-items-stretch">
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm hero-panel h-100">
            <div className="card-body p-4 p-lg-5">
              <div className="small text-uppercase text-warning fw-semibold mb-2">Classic CTFd style · Estonia map mode</div>
              <h1 className="display-5 fw-bold mb-3">{settings.siteTitle}</h1>
              <p className="lead text-secondary mb-4">
                Tüüpilise CTFd tunnetusega starter, kus challenge’id avanevad Eesti kaardilt ning ümbruse taustaks on Tallinna foto.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Link className="btn btn-warning btn-lg" to="/challenges">Open challenges</Link>
                <Link className="btn btn-outline-dark btn-lg" to="/scoreboard">View scoreboard</Link>
                {!currentUser ? <Link className="btn btn-dark btn-lg" to="/register">Create player</Link> : null}
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h4 mb-3">Quick info</h2>
              <dl className="mb-0 small quick-info-grid">
                <dt>Registration</dt><dd>{settings.registrationOpen ? "Open" : "Closed"}</dd>
                <dt>Announcement</dt><dd>{settings.announcement || "No announcement"}</dd>
                <dt>User</dt><dd>{currentUser ? currentUser.username : "Guest"}</dd>
                <dt>Mode</dt><dd>Solo</dd>
                <dt>Admin</dt><dd>admin / Admin123!</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mt-4">
        <div className="card-body p-4 p-lg-5 text-center">
          <div className="small text-uppercase text-warning fw-semibold mb-2">Event Timer</div>
          <h2 className="h4 mb-4">{timerState.title}</h2>
          <div className="d-flex justify-content-center align-items-center gap-3 flex-wrap">
            <div className="px-3 py-2 rounded bg-light border"><div className="h3 mb-0">{timerState.parts.days}</div><div className="small text-secondary">Days</div></div>
            <div className="h4 mb-0">:</div>
            <div className="px-3 py-2 rounded bg-light border"><div className="h3 mb-0">{timerState.parts.hours}</div><div className="small text-secondary">Hours</div></div>
            <div className="h4 mb-0">:</div>
            <div className="px-3 py-2 rounded bg-light border"><div className="h3 mb-0">{timerState.parts.minutes}</div><div className="small text-secondary">Minutes</div></div>
            <div className="h4 mb-0">:</div>
            <div className="px-3 py-2 rounded bg-light border"><div className="h3 mb-0">{timerState.parts.seconds}</div><div className="small text-secondary">Seconds</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
