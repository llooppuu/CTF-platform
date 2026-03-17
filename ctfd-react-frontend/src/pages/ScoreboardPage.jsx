import { useEffect, useState } from "react";
import { scoreboardApi } from "../lib/api";

export default function ScoreboardPage() {
  const [entries, setEntries] = useState([]);
  const [topTen, setTopTen] = useState([]);
  const [teamEntries, setTeamEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    scoreboardApi.get()
      .then((response) => {
        if (!active) return;
        setEntries(response.entries);
        setTopTen(response.topTen || response.entries.slice(0, 10));
        setTeamEntries(response.teamEntries || []);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="container">
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <div className="small text-uppercase text-warning fw-semibold">Rankings</div>
              <h1 className="h3 mb-0">Scoreboard</h1>
            </div>
          </div>
          {loading ? <div className="text-secondary">Loading scoreboard…</div> : null}
          {error ? <div className="alert alert-danger">{error}</div> : null}
          {!loading && !error ? (
            <div className="d-grid gap-4">
              <div>
                <h2 className="h5">Top 10 chart</h2>
                <div className="d-grid gap-2">
                  {topTen.map((entry, index) => (
                    <div key={entry.userId} className="d-flex align-items-center gap-2">
                      <div style={{ width: 24 }} className="text-secondary small">{index + 1}</div>
                      <div style={{ minWidth: 170 }} className="small fw-semibold text-truncate">{entry.displayName || entry.username}</div>
                      <div className="flex-grow-1 scoreboard-bar-track">
                        <div
                          className="scoreboard-bar-fill"
                          style={{ width: `${Math.max(6, (entry.score / Math.max(1, topTen[0]?.score || 1)) * 100)}%` }}
                        />
                      </div>
                      <div style={{ width: 80 }} className="text-end fw-semibold">{entry.score}</div>
                    </div>
                  ))}
                  {!topTen.length ? <div className="text-secondary small">No players yet.</div> : null}
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-striped align-middle mb-0">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      <th>Team</th>
                      <th>Score</th>
                      <th>Solves</th>
                      <th>Hints</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, index) => (
                      <tr key={entry.userId}>
                        <td>{index + 1}</td>
                        <td>
                          <div className="fw-semibold">{entry.displayName || entry.username}</div>
                          <div className="small text-secondary">@{entry.username}</div>
                        </td>
                        <td>{entry.teamName || "-"}</td>
                        <td>{entry.score}</td>
                        <td>{entry.solveCount}</td>
                        <td>{entry.hintPenalty}</td>
                      </tr>
                    ))}
                    {!entries.length ? <tr><td colSpan="6" className="text-center text-secondary py-5">No players yet.</td></tr> : null}
                  </tbody>
                </table>
              </div>

              <div className="table-responsive">
                <h2 className="h5">Team scoreboard</h2>
                <table className="table table-striped align-middle mb-0">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>Members</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamEntries.map((team, index) => (
                      <tr key={team.teamId}>
                        <td>{index + 1}</td>
                        <td>{team.name}</td>
                        <td>{team.memberCount}</td>
                        <td>{team.score}</td>
                      </tr>
                    ))}
                    {!teamEntries.length ? <tr><td colSpan="4" className="text-center text-secondary py-4">No teams yet.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
