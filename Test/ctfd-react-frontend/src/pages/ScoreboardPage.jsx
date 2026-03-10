import { useEffect, useMemo, useState } from "react";
import Alert from "../components/Alert";
import { getScoreboard } from "../lib/ctfd";

export default function ScoreboardPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await getScoreboard();
        if (!active) return;
        setEntries(data);
      } catch (loadError) {
        if (!active) return;
        setError(loadError?.message || "Unable to load the scoreboard");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!filter) return entries;
    const needle = filter.toLowerCase();
    return entries.filter((entry) => entry.name?.toLowerCase().includes(needle));
  }, [entries, filter]);

  return (
    <div className="container py-5">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div>
          <h1 className="h2 mb-1">Scoreboard</h1>
          <p className="text-secondary mb-0">Pulled from the standard CTFd scoreboard API.</p>
        </div>
        <div className="scoreboard-filter">
          <label className="form-label">Filter by name</label>
          <input className="form-control" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search teams or users" />
        </div>
      </div>
      <Alert type="danger">{error}</Alert>
      <div className="card border-0 shadow-sm"><div className="table-responsive"><table className="table align-middle mb-0">
        <thead className="table-light"><tr><th style={{ width: "80px" }}>#</th><th>Name</th><th style={{ width: "140px" }}>Score</th></tr></thead>
        <tbody>
          {loading ? (
            <tr><td colSpan="3" className="text-center py-5"><div className="spinner-border" role="status" /></td></tr>
          ) : filtered.length ? (
            filtered.map((entry) => (
              <tr key={`${entry.account_type}-${entry.account_id}`}>
                <td className="fw-semibold">{entry.pos}</td>
                <td>
                  <div className="fw-semibold">{entry.name}</div>
                  {entry.members?.length ? <div className="small text-secondary mt-1">Members: {entry.members.map((member) => member.name).join(", ")}</div> : null}
                </td>
                <td>{entry.score}</td>
              </tr>
            ))
          ) : (
            <tr><td colSpan="3" className="text-center py-4 text-secondary">No visible scoreboard entries.</td></tr>
          )}
        </tbody>
      </table></div></div>
    </div>
  );
}
