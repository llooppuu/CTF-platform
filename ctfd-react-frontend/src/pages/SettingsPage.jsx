import { useEffect, useState } from "react";
import Alert from "../components/Alert";
import { useApp } from "../context/AppContext";
import { updateCurrentTeam, updateCurrentUser } from "../lib/ctfd";

function copyEditableFields(source, fields) {
  const result = {};
  fields.forEach((field) => { result[field] = source?.[field] ?? ""; });
  return result;
}

function compactPayload(values, original) {
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => (value ?? "") !== (original?.[key] ?? "")));
}

export default function SettingsPage() {
  const { currentUser, currentTeam, refreshAuth } = useApp();
  const [userForm, setUserForm] = useState({});
  const [teamForm, setTeamForm] = useState({});
  const [userMessage, setUserMessage] = useState("");
  const [teamMessage, setTeamMessage] = useState("");
  const [userError, setUserError] = useState("");
  const [teamError, setTeamError] = useState("");

  useEffect(() => {
    setUserForm(copyEditableFields(currentUser, ["name", "website", "affiliation", "country"]));
    setTeamForm(copyEditableFields(currentTeam, ["name", "website", "affiliation", "country"]));
  }, [currentUser, currentTeam]);

  if (!currentUser) {
    return <div className="container py-5"><div className="alert alert-warning">Log in to edit your settings.</div></div>;
  }

  async function saveUser(event) {
    event.preventDefault();
    setUserMessage("");
    setUserError("");
    try {
      const payload = compactPayload(userForm, currentUser);
      if (!Object.keys(payload).length) {
        setUserMessage("Nothing changed.");
        return;
      }
      await updateCurrentUser(payload);
      await refreshAuth();
      setUserMessage("Profile updated.");
    } catch (error) {
      setUserError(error?.message || "Unable to update your profile.");
    }
  }

  async function saveTeam(event) {
    event.preventDefault();
    setTeamMessage("");
    setTeamError("");
    try {
      const payload = compactPayload(teamForm, currentTeam);
      if (!Object.keys(payload).length) {
        setTeamMessage("Nothing changed.");
        return;
      }
      await updateCurrentTeam(payload);
      await refreshAuth();
      setTeamMessage("Team profile updated.");
    } catch (error) {
      setTeamError(error?.message || "Unable to update the team.");
    }
  }

  return (
    <div className="container py-5">
      <div className="row g-4">
        <div className="col-lg-6"><div className="card border-0 shadow-sm h-100"><div className="card-body p-4">
          <h1 className="h4 mb-3">Your profile</h1>
          <Alert type="success">{userMessage}</Alert>
          <Alert type="danger">{userError}</Alert>
          <form className="d-grid gap-3" onSubmit={saveUser}>
            <div><label className="form-label">Name</label><input className="form-control" value={userForm.name || ""} onChange={(event) => setUserForm((previous) => ({ ...previous, name: event.target.value }))} /></div>
            <div><label className="form-label">Website</label><input className="form-control" value={userForm.website || ""} onChange={(event) => setUserForm((previous) => ({ ...previous, website: event.target.value }))} /></div>
            <div><label className="form-label">Affiliation</label><input className="form-control" value={userForm.affiliation || ""} onChange={(event) => setUserForm((previous) => ({ ...previous, affiliation: event.target.value }))} /></div>
            <div><label className="form-label">Country</label><input className="form-control" value={userForm.country || ""} onChange={(event) => setUserForm((previous) => ({ ...previous, country: event.target.value }))} placeholder="US, EE, DE…" /></div>
            <button className="btn btn-dark">Save profile</button>
          </form>
        </div></div></div>
        <div className="col-lg-6"><div className="card border-0 shadow-sm h-100"><div className="card-body p-4">
          <h2 className="h4 mb-3">Team profile</h2>
          {currentTeam ? (
            <>
              <Alert type="success">{teamMessage}</Alert>
              <Alert type="danger">{teamError}</Alert>
              <form className="d-grid gap-3" onSubmit={saveTeam}>
                <div><label className="form-label">Team name</label><input className="form-control" value={teamForm.name || ""} onChange={(event) => setTeamForm((previous) => ({ ...previous, name: event.target.value }))} /></div>
                <div><label className="form-label">Website</label><input className="form-control" value={teamForm.website || ""} onChange={(event) => setTeamForm((previous) => ({ ...previous, website: event.target.value }))} /></div>
                <div><label className="form-label">Affiliation</label><input className="form-control" value={teamForm.affiliation || ""} onChange={(event) => setTeamForm((previous) => ({ ...previous, affiliation: event.target.value }))} /></div>
                <div><label className="form-label">Country</label><input className="form-control" value={teamForm.country || ""} onChange={(event) => setTeamForm((previous) => ({ ...previous, country: event.target.value }))} placeholder="US, EE, DE…" /></div>
                <button className="btn btn-dark">Save team</button>
              </form>
            </>
          ) : <div className="text-secondary">This account is not currently attached to a team or teams mode is disabled.</div>}
        </div></div></div>
      </div>
    </div>
  );
}
