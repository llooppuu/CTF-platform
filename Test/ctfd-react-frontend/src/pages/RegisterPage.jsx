import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import { useApp } from "../context/AppContext";
import { register } from "../lib/ctfd";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { refreshAuth } = useApp();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setErrors([]);
    try {
      const result = await register(form);
      if (result.success) {
        await refreshAuth();
        navigate("/challenges");
      } else {
        setErrors(result.errors?.length ? result.errors : ["Registration failed"]);
      }
    } catch (error) {
      setErrors([error?.message || "Registration failed"]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm"><div className="card-body p-4">
            <h1 className="h3 mb-3">Register</h1>
            <Alert type="danger">{errors.length ? <ul className="mb-0 ps-3">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}</Alert>
            <form onSubmit={handleSubmit} className="d-grid gap-3">
              <div><label className="form-label">Username</label><input className="form-control" value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} /></div>
              <div><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} /></div>
              <div><label className="form-label">Password</label><input className="form-control" type="password" value={form.password} onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))} /></div>
              <button className="btn btn-dark" disabled={submitting}>{submitting ? "Creating account…" : "Register"}</button>
            </form>
          </div></div>
        </div>
      </div>
    </div>
  );
}
