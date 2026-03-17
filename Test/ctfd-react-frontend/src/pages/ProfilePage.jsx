import { useState } from "react";
import Alert from "../components/Alert";
import { useApp } from "../context/AppContext";
import { authApi } from "../lib/api";

export default function ProfilePage() {
  const { currentUser, refreshSession } = useApp();
  const [form, setForm] = useState({
    displayName: currentUser?.displayName || "",
    email: currentUser?.email || "",
    bio: currentUser?.bio || "",
    password: ""
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await authApi.updateProfile(form);
      await refreshSession();
      setMessage("Profile updated.");
      setForm((old) => ({ ...old, password: "" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="card border-0 shadow-sm mx-auto" style={{ maxWidth: 760 }}>
        <div className="card-body p-4 p-lg-5">
          <h1 className="h3 mb-4">Profile</h1>
          {message ? <Alert type="success">{message}</Alert> : null}
          {error ? <Alert type="danger">{error}</Alert> : null}
          <form className="row g-3" onSubmit={submit}>
            <div className="col-md-6">
              <label className="form-label">Display name</label>
              <input className="form-control" value={form.displayName} onChange={(event) => setForm((old) => ({ ...old, displayName: event.target.value }))} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Email</label>
              <input className="form-control" value={form.email} onChange={(event) => setForm((old) => ({ ...old, email: event.target.value }))} />
            </div>
            <div className="col-12">
              <label className="form-label">Bio</label>
              <textarea className="form-control" rows="4" value={form.bio} onChange={(event) => setForm((old) => ({ ...old, bio: event.target.value }))} />
            </div>
            <div className="col-12">
              <label className="form-label">New password</label>
              <input type="password" className="form-control" value={form.password} onChange={(event) => setForm((old) => ({ ...old, password: event.target.value }))} placeholder="Leave empty to keep the old one" />
            </div>
            <div className="col-12">
              <button className="btn btn-dark" disabled={loading}>{loading ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
