import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import { authApi } from "../lib/api";
import { useApp } from "../context/AppContext";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { refreshSession, settings } = useApp();
  const [form, setForm] = useState({ username: "", email: "", password: "", displayName: "", registrationCode: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authApi.register(form);
      await refreshSession();
      navigate("/challenges");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container auth-container">
      <div className="card border-0 shadow-sm auth-card mx-auto">
        <div className="card-body p-4 p-lg-5">
          <h1 className="h3 mb-4">Register</h1>
          {error ? <Alert type="danger">{error}</Alert> : null}
          <form className="row g-3" onSubmit={submit}>
            <div className="col-12">
              <label className="form-label">Display name</label>
              <input className="form-control" value={form.displayName} onChange={(event) => setForm((old) => ({ ...old, displayName: event.target.value }))} />
            </div>
            <div className="col-12">
              <label className="form-label">Username</label>
              <input className="form-control" value={form.username} onChange={(event) => setForm((old) => ({ ...old, username: event.target.value }))} required />
            </div>
            <div className="col-12">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={form.email} onChange={(event) => setForm((old) => ({ ...old, email: event.target.value }))} />
            </div>
            <div className="col-12">
              <label className="form-label">Password</label>
              <input type="password" className="form-control" value={form.password} onChange={(event) => setForm((old) => ({ ...old, password: event.target.value }))} required />
            </div>
            {settings.registrationCode ? (
              <div className="col-12">
                <label className="form-label">Registration code</label>
                <input className="form-control" value={form.registrationCode} onChange={(event) => setForm((old) => ({ ...old, registrationCode: event.target.value }))} required />
              </div>
            ) : null}
            <div className="col-12">
              <button className="btn btn-warning w-100" disabled={loading}>{loading ? "Creating account…" : "Register"}</button>
            </div>
          </form>
          <div className="small text-secondary mt-3">Already have an account? <Link to="/login">Login here</Link></div>
        </div>
      </div>
    </div>
  );
}
