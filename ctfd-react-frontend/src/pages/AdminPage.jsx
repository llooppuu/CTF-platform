import { useEffect, useMemo, useState } from "react";
import Alert from "../components/Alert";
import AdminMapPicker from "../components/AdminMapPicker";
import { adminApi, settingsApi } from "../lib/api";

const CATEGORY_OPTIONS = [
  { value: "web", label: "Web exploitation" },
  { value: "crypto", label: "Cryptography" },
  { value: "reverse", label: "Reverse Engineering" },
  { value: "binary", label: "Binary" },
  { value: "pwn", label: "Pwn" },
  { value: "forensics", label: "Forensics" },
  { value: "misc", label: "Misc" },
  { value: "osint", label: "OSINT" }
];

const CHALLENGE_VISIBILITY_OPTIONS = [
  { value: "private", label: "Private" },
  { value: "public", label: "Public" }
];

const ACCOUNT_VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "users", label: "Authenticated Users" },
  { value: "admins", label: "Admins" }
];

const SCORE_VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "users", label: "Authenticated Users" },
  { value: "hidden", label: "Hidden" },
  { value: "admins", label: "Admins" }
];

const REGISTRATION_VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "disabled", label: "Disabled" }
];

const emptyForm = {
  title: "",
  slug: "",
  category: "misc",
  difficulty: "easy",
  points: 100,
  description: "",
  flag: "flag{example}",
  lat: 59.437,
  lng: 24.7536,
  tags: "",
  files: "",
  hints: "",
  positionLocked: false,
  visible: true
};

function challengeToForm(challenge) {
  return {
    title: challenge.title,
    slug: challenge.slug,
    category: challenge.category,
    difficulty: challenge.difficulty,
    points: challenge.points,
    description: challenge.description,
    flag: challenge.flag || "",
    lat: challenge.lat ?? 59.437,
    lng: challenge.lng ?? 24.7536,
    tags: (challenge.tags || []).join(", "),
    files: JSON.stringify(challenge.files || [], null, 2),
    hints: JSON.stringify(challenge.hints || [], null, 2),
    positionLocked: challenge.positionLocked === true,
    visible: challenge.visible !== false
  };
}

function buildPayload(form) {
  return {
    ...form,
    points: Number(form.points),
    lat: Number(form.lat),
    lng: Number(form.lng),
    tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    files: form.files ? JSON.parse(form.files) : [],
    hints: form.hints ? JSON.parse(form.hints) : [],
    positionLocked: form.positionLocked === true
  };
}

export default function AdminPage() {
  const [tab, setTab] = useState("challenges");
  const [challenges, setChallenges] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geoJson, setGeoJson] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({ title: "", content: "", visible: true });
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    siteTitle: "",
    registrationOpen: true,
    challengeVisibility: "private",
    accountVisibility: "public",
    scoreVisibility: "public",
    registrationVisibility: "public",
    paused: false,
    registrationCode: "",
    logoUrl: "",
    theme: "default",
    localization: "en",
    customFields: "[]",
    scoreboardBrackets: "[]",
    sanitizeHtml: true,
    announcement: "",
    startTime: "",
    endTime: ""
  });
  const [configSection, setConfigSection] = useState("visibility");
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamForm, setTeamForm] = useState({ name: "", bio: "", memberIds: [] });
  const [editingTeamId, setEditingTeamId] = useState(null);

  async function loadAdminChallenges() {
    setLoading(true);
    try {
      const response = await adminApi.challenges();
      setChallenges(response.challenges);
      setError("");
      if (!selectedId && response.challenges.length) {
        setSelectedId(response.challenges[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnnouncements() {
    const response = await adminApi.announcements();
    setAnnouncements(response.announcements || []);
  }

  async function loadSettings() {
    const response = await settingsApi.get();
    const settings = response.settings || {};
    setSettingsForm({
      siteTitle: settings.siteTitle || "",
      registrationOpen: Boolean(settings.registrationOpen),
      challengeVisibility: settings.challengeVisibility || "private",
      accountVisibility: settings.accountVisibility || "public",
      scoreVisibility: settings.scoreVisibility || "public",
      registrationVisibility: settings.registrationVisibility || (settings.registrationOpen === false ? "disabled" : "public"),
      paused: Boolean(settings.paused),
      registrationCode: settings.registrationCode || "",
      logoUrl: settings.logoUrl || "",
      theme: settings.theme || "default",
      localization: settings.localization || "en",
      customFields: JSON.stringify(settings.customFields || [], null, 2),
      scoreboardBrackets: JSON.stringify(settings.scoreboardBrackets || [], null, 2),
      sanitizeHtml: settings.sanitizeHtml !== false,
      announcement: settings.announcement || "",
      startTime: settings.startTime || "",
      endTime: settings.endTime || ""
    });
  }

  async function loadTeamsAndUsers() {
    const [usersResponse, teamsResponse] = await Promise.all([
      adminApi.users(),
      adminApi.teams()
    ]);
    setUsers(usersResponse.users || []);
    setTeams(teamsResponse.teams || []);
  }

  async function loadGeoJson() {
    try {
      const response = await fetch("/estonia.geojson");
      const data = await response.json();
      setGeoJson(data);
    } catch (err) {
      console.error("Failed to load geoJson:", err);
    }
  }

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setError("");
      try {
        await Promise.all([loadAdminChallenges(), loadGeoJson(), loadAnnouncements(), loadSettings(), loadTeamsAndUsers()]);
      } catch (err) {
        setError(err.message || "Failed to load admin data");
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  const selectedChallenge = useMemo(() => challenges.find((challenge) => challenge.id === selectedId) || null, [challenges, selectedId]);

  useEffect(() => {
    if (selectedChallenge) {
      setForm(challengeToForm(selectedChallenge));
    } else {
      setForm(emptyForm);
    }
  }, [selectedChallenge]);

  async function createNew() {
    setSelectedId(null);
    setForm(emptyForm);
    setMessage("");
    setError("");
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = buildPayload(form);
      if (selectedChallenge) {
        await adminApi.updateChallenge(selectedChallenge.id, payload);
        setMessage("Challenge updated.");
      } else {
        const response = await adminApi.createChallenge(payload);
        setSelectedId(response.challenge.id);
        setMessage("Challenge created.");
      }
      await loadAdminChallenges();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeChallenge() {
    if (!selectedChallenge) return;
    const confirmed = window.confirm(`Delete ${selectedChallenge.title}?`);
    if (!confirmed) return;
    try {
      await adminApi.deleteChallenge(selectedChallenge.id);
      setSelectedId(null);
      setMessage("Challenge deleted.");
      await loadAdminChallenges();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleMapPick(coords) {
    setForm((old) => ({
      ...old,
      lat: coords.lat,
      lng: coords.lng
    }));
  }

  function handleFileUpload(event, field) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (field === "files" || field === "hints") {
        try {
          const parsed = JSON.parse(content);
          setForm((old) => ({
            ...old,
            [field]: JSON.stringify(parsed, null, 2)
          }));
          setMessage(`${field === "files" ? "Files" : "Hints"} uploaded successfully`);
        } catch (err) {
          setError(`Invalid JSON in ${field}`);
        }
      }
    };
    reader.readAsText(file);
  }

  function fillSlugFromTitle() {
    setForm((old) => ({
      ...old,
      slug: old.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    }));
  }

  async function saveAnnouncement(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (editingAnnouncementId) {
        await adminApi.updateAnnouncement(editingAnnouncementId, announcementForm);
        setMessage("Announcement updated.");
      } else {
        await adminApi.createAnnouncement(announcementForm);
        setMessage("Announcement created.");
      }
      setAnnouncementForm({ title: "", content: "", visible: true });
      setEditingAnnouncementId(null);
      await loadAnnouncements();
    } catch (err) {
      setError(err.message);
    }
  }

  function editAnnouncement(item) {
    setEditingAnnouncementId(item.id);
    setAnnouncementForm({
      title: item.title,
      content: item.content,
      visible: item.visible !== false
    });
  }

  async function deleteAnnouncement(id) {
    const confirmed = window.confirm("Delete this announcement?");
    if (!confirmed) return;
    try {
      await adminApi.deleteAnnouncement(id);
      setMessage("Announcement deleted.");
      if (editingAnnouncementId === id) {
        setEditingAnnouncementId(null);
        setAnnouncementForm({ title: "", content: "", visible: true });
      }
      await loadAnnouncements();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await adminApi.updateSettings({
        ...settingsForm,
        registrationOpen: settingsForm.registrationVisibility !== "disabled",
        customFields: settingsForm.customFields ? JSON.parse(settingsForm.customFields) : [],
        scoreboardBrackets: settingsForm.scoreboardBrackets ? JSON.parse(settingsForm.scoreboardBrackets) : []
      });
      setMessage("Platform settings updated.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function exportConfigData() {
    setError("");
    setMessage("");
    try {
      const response = await adminApi.exportData();
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `ctf-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      setMessage("Data exported.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function importConfigData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setMessage("");

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await adminApi.importData(data);
      setMessage("Data imported.");
      await Promise.all([loadAdminChallenges(), loadAnnouncements(), loadSettings(), loadTeamsAndUsers()]);
    } catch (err) {
      setError(err.message || "Import failed");
    } finally {
      event.target.value = "";
    }
  }

  async function saveTeam(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (editingTeamId) {
        await adminApi.updateTeam(editingTeamId, teamForm);
        setMessage("Team updated.");
      } else {
        await adminApi.createTeam(teamForm);
        setMessage("Team created.");
      }
      setTeamForm({ name: "", bio: "", memberIds: [] });
      setEditingTeamId(null);
      await loadTeamsAndUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  function editTeam(team) {
    setEditingTeamId(team.id);
    setTeamForm({
      name: team.name,
      bio: team.bio || "",
      memberIds: (team.members || []).map((member) => member.id)
    });
  }

  async function removeTeam(teamId) {
    const confirmed = window.confirm("Delete this team?");
    if (!confirmed) return;
    try {
      await adminApi.deleteTeam(teamId);
      setMessage("Team deleted.");
      if (editingTeamId === teamId) {
        setEditingTeamId(null);
        setTeamForm({ name: "", bio: "", memberIds: [] });
      }
      await loadTeamsAndUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container-fluid px-lg-4">
      <div className="d-flex flex-wrap gap-2 mb-3">
        <button className={`btn ${tab === "challenges" ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setTab("challenges")}>Challenges</button>
        <button className={`btn ${tab === "config" ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setTab("config")}>Config</button>
        <button className={`btn ${tab === "teams" ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setTab("teams")}>Teams</button>
        <button className={`btn ${tab === "announcements" ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setTab("announcements")}>Announcements</button>
      </div>
      {message ? <Alert type="success">{message}</Alert> : null}
      {error ? <Alert type="danger">{error}</Alert> : null}

      {tab === "challenges" ? (
      <div className="row g-4" style={{ minHeight: "100vh" }}>
        <div className="col-xl-3">
          <div className="card border-0 shadow-sm sticky-lg-top ops-panel">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h1 className="h4 mb-0">Admin</h1>
                <button className="btn btn-sm btn-warning" onClick={createNew}>New</button>
              </div>
              {loading ? <div className="text-secondary">Loading…</div> : null}
              <div className="list-group admin-list">
                {challenges.map((challenge) => (
                  <button key={challenge.id} className={`list-group-item list-group-item-action ${selectedId === challenge.id ? "active" : ""}`} onClick={() => setSelectedId(challenge.id)}>
                    <div className="fw-semibold">{challenge.title}</div>
                    <div className="small opacity-75">{challenge.category} · {challenge.points} pts</div>
                    <div className="small opacity-75">Solves: {challenge.stats?.solveCount || 0} · Submissions: {challenge.stats?.submissionCount || 0}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-9">
          <div className="row g-4">
            {geoJson && (
              <div className="col-12">
                <AdminMapPicker
                  geoJson={geoJson}
                  challenges={challenges}
                  selectedId={selectedId}
                  currentCoords={{ lat: form.lat, lng: form.lng }}
                  locked={form.positionLocked}
                  onPick={handleMapPick}
                />
              </div>
            )}
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4 p-lg-5">
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                      <div className="small text-uppercase text-warning fw-semibold">Challenge editor</div>
                      <h2 className="h3 mb-0">{selectedChallenge ? selectedChallenge.title : "Create challenge"}</h2>
                    </div>
                    {selectedChallenge ? <button className="btn btn-outline-danger" onClick={removeChallenge}>Delete</button> : null}
                  </div>
                  <form className="row g-3" onSubmit={save}>
                    <div className="col-md-6"><label className="form-label">Title</label><input className="form-control" value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} required /></div>
                    <div className="col-md-6"><label className="form-label">Slug</label><input className="form-control" value={form.slug} onChange={(event) => setForm((old) => ({ ...old, slug: event.target.value }))} required /></div>
                    <div className="col-12"><button type="button" className="btn btn-outline-secondary btn-sm" onClick={fillSlugFromTitle}>Generate slug from title</button></div>
                    <div className="col-md-4">
                      <label className="form-label">Category</label>
                      <select className="form-select" value={form.category} onChange={(event) => setForm((old) => ({ ...old, category: event.target.value }))}>
                        {!CATEGORY_OPTIONS.some((category) => category.value === form.category) ? (
                          <option value={form.category}>{form.category}</option>
                        ) : null}
                        {CATEGORY_OPTIONS.map((category) => (
                          <option key={category.value} value={category.value}>{category.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4"><label className="form-label">Difficulty</label><select className="form-select" value={form.difficulty} onChange={(event) => setForm((old) => ({ ...old, difficulty: event.target.value }))}><option>easy</option><option>medium</option><option>hard</option><option>extreme</option></select></div>
                    <div className="col-md-4"><label className="form-label">Points</label><input type="number" className="form-control" value={form.points} onChange={(event) => setForm((old) => ({ ...old, points: event.target.value }))} /></div>
                    <div className="col-12"><label className="form-label">Description (supports HTML)</label><textarea className="form-control" rows="7" value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} /></div>
                    <div className="col-12"><label className="form-label">Flag</label><input className="form-control" value={form.flag} onChange={(event) => setForm((old) => ({ ...old, flag: event.target.value }))} /></div>
                    <div className="col-md-6"><label className="form-label">Latitude</label><input type="number" step="0.0001" className="form-control" value={form.lat} onChange={(event) => setForm((old) => ({ ...old, lat: event.target.value }))} /></div>
                    <div className="col-md-6"><label className="form-label">Longitude</label><input type="number" step="0.0001" className="form-control" value={form.lng} onChange={(event) => setForm((old) => ({ ...old, lng: event.target.value }))} /></div>
                    <div className="col-12 form-check ms-2"><input className="form-check-input" type="checkbox" checked={form.positionLocked} onChange={(event) => setForm((old) => ({ ...old, positionLocked: event.target.checked }))} id="lockPosition" /><label className="form-check-label" htmlFor="lockPosition">Lock marker position</label></div>
                    <div className="col-12"><label className="form-label">Tags (comma separated)</label><input className="form-control" value={form.tags} onChange={(event) => setForm((old) => ({ ...old, tags: event.target.value }))} /></div>
                    <div className="col-12">
                      <label className="form-label">Files JSON</label>
                      <div className="input-group mb-2">
                        <textarea className="form-control font-monospace" rows="5" value={form.files} onChange={(event) => setForm((old) => ({ ...old, files: event.target.value }))} />
                      </div>
                      <input type="file" className="form-control form-control-sm" accept=".json" onChange={(e) => handleFileUpload(e, "files")} />
                      <small className="text-muted">Or upload JSON file</small>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Hints JSON</label>
                      <div className="input-group mb-2">
                        <textarea className="form-control font-monospace" rows="6" value={form.hints} onChange={(event) => setForm((old) => ({ ...old, hints: event.target.value }))} />
                      </div>
                      <input type="file" className="form-control form-control-sm" accept=".json" onChange={(e) => handleFileUpload(e, "hints")} />
                      <small className="text-muted">Or upload JSON file</small>
                    </div>
                    <div className="col-12 form-check ms-2"><input className="form-check-input" type="checkbox" checked={form.visible} onChange={(event) => setForm((old) => ({ ...old, visible: event.target.checked }))} id="visibleChallenge" /><label className="form-check-label" htmlFor="visibleChallenge">Visible to players</label></div>
                    <div className="col-12"><button className="btn btn-dark" disabled={saving}>{saving ? "Saving…" : "Save challenge"}</button></div>
                  </form>
                  {selectedChallenge ? (
                    <div className="mt-4 p-3 rounded bg-light border">
                      <h3 className="h6">Challenge analytics</h3>
                      <div className="small">Solves: {selectedChallenge.stats?.solveCount || 0}</div>
                      <div className="small">Submissions: {selectedChallenge.stats?.submissionCount || 0}</div>
                      <div className="small">Incorrect submissions: {selectedChallenge.stats?.incorrectSubmissionCount || 0}</div>
                      <div className="small">First blood: {selectedChallenge.stats?.firstBloodAt || "N/A"}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {tab === "teams" ? (
        <div className="row g-4">
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">
                <h2 className="h5">{editingTeamId ? "Edit team" : "Create team"}</h2>
                <form className="row g-3" onSubmit={saveTeam}>
                  <div className="col-12"><label className="form-label">Team name</label><input className="form-control" value={teamForm.name} onChange={(event) => setTeamForm((old) => ({ ...old, name: event.target.value }))} required /></div>
                  <div className="col-12"><label className="form-label">Bio</label><textarea className="form-control" rows="3" value={teamForm.bio} onChange={(event) => setTeamForm((old) => ({ ...old, bio: event.target.value }))} /></div>
                  <div className="col-12">
                    <label className="form-label">Members</label>
                    <select
                      className="form-select"
                      multiple
                      size={8}
                      value={teamForm.memberIds}
                      onChange={(event) => {
                        const selectedOptions = Array.from(event.target.selectedOptions).map((option) => option.value);
                        setTeamForm((old) => ({ ...old, memberIds: selectedOptions }));
                      }}
                    >
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>{user.displayName || user.username} (@{user.username})</option>
                      ))}
                    </select>
                    <small className="text-muted">Hold Ctrl to select multiple members.</small>
                  </div>
                  <div className="col-12 d-flex gap-2">
                    <button className="btn btn-dark">{editingTeamId ? "Update" : "Create"}</button>
                    {editingTeamId ? <button type="button" className="btn btn-outline-secondary" onClick={() => { setEditingTeamId(null); setTeamForm({ name: "", bio: "", memberIds: [] }); }}>Cancel edit</button> : null}
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">
                <h2 className="h5">Teams</h2>
                <div className="list-group">
                  {teams.map((team) => (
                    <div key={team.id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div>
                          <div className="fw-semibold">{team.name}</div>
                          <div className="small text-secondary">{(team.members || []).length} members</div>
                          <div className="small mt-1">{team.bio || "No bio"}</div>
                        </div>
                        <div className="d-flex gap-2">
                          <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => editTeam(team)}>Edit</button>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeTeam(team.id)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!teams.length ? <div className="text-secondary small">No teams yet.</div> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "announcements" ? (
        <div className="row g-4">
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">
                <h2 className="h5">{editingAnnouncementId ? "Edit announcement" : "Create announcement"}</h2>
                <form className="row g-3" onSubmit={saveAnnouncement}>
                  <div className="col-12"><label className="form-label">Title</label><input className="form-control" value={announcementForm.title} onChange={(event) => setAnnouncementForm((old) => ({ ...old, title: event.target.value }))} required /></div>
                  <div className="col-12"><label className="form-label">Content</label><textarea className="form-control" rows="6" value={announcementForm.content} onChange={(event) => setAnnouncementForm((old) => ({ ...old, content: event.target.value }))} required /></div>
                  <div className="col-12 form-check ms-2"><input className="form-check-input" type="checkbox" checked={announcementForm.visible} onChange={(event) => setAnnouncementForm((old) => ({ ...old, visible: event.target.checked }))} id="visibleAnnouncement" /><label className="form-check-label" htmlFor="visibleAnnouncement">Visible to players</label></div>
                  <div className="col-12 d-flex gap-2">
                    <button className="btn btn-dark">{editingAnnouncementId ? "Update" : "Create"}</button>
                    {editingAnnouncementId ? <button type="button" className="btn btn-outline-secondary" onClick={() => { setEditingAnnouncementId(null); setAnnouncementForm({ title: "", content: "", visible: true }); }}>Cancel edit</button> : null}
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">
                <h2 className="h5">Existing announcements</h2>
                <div className="list-group">
                  {announcements.map((item) => (
                    <div key={item.id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div>
                          <div className="fw-semibold">{item.title}</div>
                          <div className="small text-muted">{item.createdAt}</div>
                          <div className="small mt-2">{item.content}</div>
                        </div>
                        <div className="d-flex gap-2">
                          <button className="btn btn-sm btn-outline-dark" onClick={() => editAnnouncement(item)}>Edit</button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => deleteAnnouncement(item.id)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!announcements.length ? <div className="text-secondary small">No announcements yet.</div> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "config" ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4 p-lg-5">
            <h2 className="h4 mb-4">Configuration</h2>
            <div className="row g-4">
              <div className="col-lg-3">
                <div className="list-group">
                  <button type="button" className={`list-group-item list-group-item-action ${configSection === "general" ? "active" : ""}`} onClick={() => setConfigSection("general")}>General</button>
                  <button type="button" className={`list-group-item list-group-item-action ${configSection === "appearance" ? "active" : ""}`} onClick={() => setConfigSection("appearance")}>Appearance</button>
                  <button type="button" className={`list-group-item list-group-item-action ${configSection === "visibility" ? "active" : ""}`} onClick={() => setConfigSection("visibility")}>Visibility</button>
                  <button type="button" className={`list-group-item list-group-item-action ${configSection === "timing" ? "active" : ""}`} onClick={() => setConfigSection("timing")}>Start and End Time</button>
                  <button type="button" className={`list-group-item list-group-item-action ${configSection === "pause" ? "active" : ""}`} onClick={() => setConfigSection("pause")}>Pause</button>
                  <button type="button" className={`list-group-item list-group-item-action ${configSection === "users" ? "active" : ""}`} onClick={() => setConfigSection("users")}>Users</button>
                  <button type="button" className={`list-group-item list-group-item-action ${configSection === "challenges" ? "active" : ""}`} onClick={() => setConfigSection("challenges")}>Challenges</button>
                  <button type="button" className={`list-group-item list-group-item-action ${configSection === "backup" ? "active" : ""}`} onClick={() => setConfigSection("backup")}>Import & Export</button>
                  <button type="button" className={`list-group-item list-group-item-action ${configSection === "security" ? "active" : ""}`} onClick={() => setConfigSection("security")}>Sanitize</button>
                </div>
              </div>
              <div className="col-lg-9">
                <form className="row g-3" onSubmit={saveSettings}>
                  {configSection === "general" ? (
                    <>
                      <div className="col-12"><label className="form-label">Site title</label><input className="form-control" value={settingsForm.siteTitle} onChange={(event) => setSettingsForm((old) => ({ ...old, siteTitle: event.target.value }))} /></div>
                      <div className="col-12"><label className="form-label">Homepage announcement text</label><textarea className="form-control" rows="3" value={settingsForm.announcement} onChange={(event) => setSettingsForm((old) => ({ ...old, announcement: event.target.value }))} /></div>
                    </>
                  ) : null}

                  {configSection === "appearance" ? (
                    <>
                      <div className="col-md-6"><label className="form-label">Logo URL</label><input className="form-control" value={settingsForm.logoUrl} onChange={(event) => setSettingsForm((old) => ({ ...old, logoUrl: event.target.value }))} placeholder="https://example.com/logo.png" /></div>
                      <div className="col-md-3"><label className="form-label">Theme</label><select className="form-select" value={settingsForm.theme} onChange={(event) => setSettingsForm((old) => ({ ...old, theme: event.target.value }))}><option value="default">Default</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
                      <div className="col-md-3"><label className="form-label">Localization</label><select className="form-select" value={settingsForm.localization} onChange={(event) => setSettingsForm((old) => ({ ...old, localization: event.target.value }))}><option value="en">English</option><option value="et">Eesti</option></select></div>
                    </>
                  ) : null}

                  {configSection === "visibility" ? (
                    <>
                      <div className="col-md-6"><label className="form-label">Challenge Visibility</label><select className="form-select" value={settingsForm.challengeVisibility} onChange={(event) => setSettingsForm((old) => ({ ...old, challengeVisibility: event.target.value }))}>{CHALLENGE_VISIBILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                      <div className="col-md-6"><label className="form-label">Account Visibility</label><select className="form-select" value={settingsForm.accountVisibility} onChange={(event) => setSettingsForm((old) => ({ ...old, accountVisibility: event.target.value }))}>{ACCOUNT_VISIBILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                      <div className="col-md-6"><label className="form-label">Score Visibility</label><select className="form-select" value={settingsForm.scoreVisibility} onChange={(event) => setSettingsForm((old) => ({ ...old, scoreVisibility: event.target.value }))}>{SCORE_VISIBILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                      <div className="col-md-6"><label className="form-label">Registration Visibility</label><select className="form-select" value={settingsForm.registrationVisibility} onChange={(event) => setSettingsForm((old) => ({ ...old, registrationVisibility: event.target.value, registrationOpen: event.target.value !== "disabled" }))}>{REGISTRATION_VISIBILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                    </>
                  ) : null}

                  {configSection === "timing" ? (
                    <>
                      <div className="col-md-6"><label className="form-label">Start time (ISO)</label><input className="form-control" value={settingsForm.startTime} onChange={(event) => setSettingsForm((old) => ({ ...old, startTime: event.target.value }))} placeholder="2026-03-17T12:00:00.000Z" /></div>
                      <div className="col-md-6"><label className="form-label">End time (ISO)</label><input className="form-control" value={settingsForm.endTime} onChange={(event) => setSettingsForm((old) => ({ ...old, endTime: event.target.value }))} placeholder="2026-03-18T12:00:00.000Z" /></div>
                    </>
                  ) : null}

                  {configSection === "pause" ? (
                    <div className="col-12 form-check ms-2"><input className="form-check-input" type="checkbox" checked={settingsForm.paused} onChange={(event) => setSettingsForm((old) => ({ ...old, paused: event.target.checked }))} id="ctfPaused" /><label className="form-check-label" htmlFor="ctfPaused">Pause CTF (blocks submissions and hint unlocks)</label></div>
                  ) : null}

                  {configSection === "users" ? (
                    <>
                      <div className="col-md-6"><label className="form-label">Registration Code</label><input className="form-control" value={settingsForm.registrationCode} onChange={(event) => setSettingsForm((old) => ({ ...old, registrationCode: event.target.value }))} placeholder="Leave empty to disable" /></div>
                      <div className="col-md-6"><label className="form-label">Scoreboard Brackets (JSON)</label><textarea className="form-control font-monospace" rows="5" value={settingsForm.scoreboardBrackets} onChange={(event) => setSettingsForm((old) => ({ ...old, scoreboardBrackets: event.target.value }))} /></div>
                      <div className="col-12"><label className="form-label">Custom Fields (JSON)</label><textarea className="form-control font-monospace" rows="5" value={settingsForm.customFields} onChange={(event) => setSettingsForm((old) => ({ ...old, customFields: event.target.value }))} /></div>
                    </>
                  ) : null}

                  {configSection === "challenges" ? (
                    <div className="col-12 small text-secondary">Use the main Challenges admin tab to create, edit, and delete challenges.</div>
                  ) : null}

                  {configSection === "backup" ? (
                    <>
                      <div className="col-12 d-flex gap-2 align-items-center">
                        <button type="button" className="btn btn-outline-dark" onClick={exportConfigData}>Export Data</button>
                        <input type="file" className="form-control" accept="application/json,.json" onChange={importConfigData} />
                      </div>
                    </>
                  ) : null}

                  {configSection === "security" ? (
                    <div className="col-12 form-check ms-2"><input className="form-check-input" type="checkbox" checked={settingsForm.sanitizeHtml} onChange={(event) => setSettingsForm((old) => ({ ...old, sanitizeHtml: event.target.checked }))} id="sanitizeHtml" /><label className="form-check-label" htmlFor="sanitizeHtml">Sanitize HTML content</label></div>
                  ) : null}

                  <div className="col-12"><button className="btn btn-dark">Update</button></div>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
