import { useEffect, useMemo, useState } from "react";
import ChallengeModal from "../components/ChallengeModal";
import MapBoard from "../components/MapBoard";
import { challengesApi } from "../lib/api";

export default function ChallengesPage() {
  const [geoJson, setGeoJson] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [submitting, setSubmitting] = useState(false);

  async function loadChallenges() {
    setLoading(true);
    try {
      const [geo, response] = await Promise.all([
        fetch("/estonia.geojson").then((res) => res.json()),
        challengesApi.list()
      ]);
      setGeoJson(geo);
      setChallenges(response.challenges);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadChallenges();
  }, []);

  useEffect(() => {
    if (!selected?.id) {
      setDetail(null);
      return;
    }

    let active = true;
    setDetailLoading(true);
    challengesApi.get(selected.id)
      .then((response) => {
        if (active) setDetail(response.challenge);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selected?.id]);

  const categories = useMemo(() => {
    const stats = new Map();
    challenges.forEach((challenge) => {
      const current = stats.get(challenge.category) || { total: 0, solved: 0 };
      current.total += 1;
      if (challenge.solved) current.solved += 1;
      stats.set(challenge.category, current);
    });
    return Array.from(stats.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [challenges]);

  const visibleChallenges = useMemo(() => activeCategory === "all"
    ? challenges
    : challenges.filter((challenge) => challenge.category === activeCategory), [challenges, activeCategory]);

  async function handleSubmitFlag(flag) {
    setSubmitting(true);
    try {
      const response = await challengesApi.submit(selected.id, flag);
      await loadChallenges();
      const detailResponse = await challengesApi.get(selected.id);
      setDetail(detailResponse.challenge);
      return response;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnlockHint(hintId) {
    const response = await challengesApi.unlockHint(selected.id, hintId);
    const detailResponse = await challengesApi.get(selected.id);
    setDetail(detailResponse.challenge);
    await loadChallenges();
    return response;
  }

  return (
    <div className="container-fluid px-lg-4">
      <div className="row g-4 align-items-start">
        <div className="col-xl-3">
          <div className="card border-0 shadow-sm ops-panel">
            <div className="card-body p-4">
              <div className="small text-uppercase text-warning fw-semibold mb-2">Operations</div>
              <h1 className="h3 mb-3">Targets</h1>
              <div className="d-grid gap-2 mb-4">
                <button type="button" className={`btn text-start ${activeCategory === "all" ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setActiveCategory("all")}>All categories <span className="float-end">{challenges.length}</span></button>
                {categories.map(([category, stats]) => (
                  <button type="button" key={category} className={`btn text-start ${activeCategory === category ? "btn-warning" : "btn-outline-dark"}`} onClick={() => setActiveCategory(category)}>
                    <span className="text-capitalize">{category}</span>
                    <span className="float-end">{stats.solved}/{stats.total}</span>
                  </button>
                ))}
              </div>
              <div className="small text-secondary">
                The map lives in its own movable frame. Drag inside it to pan around Tallinn background and the Estonia overlay. If a challenge coordinate falls off Estonian land, the marker moves to the Tallinn fallback point.
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-9">
          {loading ? <div className="card border-0 shadow-sm"><div className="card-body p-5 text-center">Loading map…</div></div> : null}
          {error ? <div className="alert alert-danger">{error}</div> : null}
          {!loading && !error ? (
            <MapBoard geoJson={geoJson} challenges={visibleChallenges} selectedId={selected?.id} onSelect={setSelected} />
          ) : null}
        </div>
      </div>

      {selected ? <ChallengeModal challenge={detail || { ...selected, descriptionHtml: detailLoading ? "<p>Loading…</p>" : "<p>No detail loaded.</p>", hints: [] }} onClose={() => setSelected(null)} onSubmitFlag={handleSubmitFlag} onUnlockHint={handleUnlockHint} submitting={submitting || detailLoading} /> : null}
    </div>
  );
}
