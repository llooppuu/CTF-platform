import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import { authApi } from "../lib/api";
import { useApp } from "../context/AppContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { refreshSession } = useApp();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authApi.login(form);
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
          <h1 className="h3 mb-4">Login</h1>
          {error ? <Alert type="danger">{error}</Alert> : null}
          <form className="d-grid gap-3" onSubmit={submit}>
            <div>
              <label className="form-label">Username</label>
              <input className="form-control" value={form.username} onChange={(event) => setForm((old) => ({ ...old, username: event.target.value }))} />
            </div>
            <div>
              <label className="form-label">Password</label>
              <input type="password" className="form-control" value={form.password} onChange={(event) => setForm((old) => ({ ...old, password: event.target.value }))} />
            </div>
            <button className="btn btn-dark" disabled={loading}>{loading ? "Signing in…" : "Login"}</button>
          </form>
          <div className="small text-secondary mt-3">No account yet? <Link to="/register">Register here</Link></div>
        </div>
      </div>
    </div>
  );
}
