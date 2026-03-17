import { useEffect, useMemo, useReducer } from "react";
import ChallengeModal from "../components/ChallengeModal";
import MapBoard from "../components/MapBoard";
import { challengesApi } from "../lib/api";

const initialState = {
  geoJson: null,
  challenges: [],
  selected: null,
  detail: null,
  loading: true,
  detailLoading: false,
  error: "",
  activeCategory: "all",
  submitting: false
};

function challengesReducer(state, action) {
  switch (action.type) {
    case "load_start":
      return {
        ...state,
        loading: true
      };
    case "load_success":
      return {
        ...state,
        loading: false,
        geoJson: action.geoJson,
        challenges: action.challenges,
        error: ""
      };
    case "load_error":
      return {
        ...state,
        loading: false,
        error: action.error
      };
    case "select":
      return {
        ...state,
        selected: action.challenge
      };
    case "clear_selection":
      return {
        ...state,
        selected: null,
        detail: null,
        detailLoading: false
      };
    case "clear_detail":
      return {
        ...state,
        detail: null,
        detailLoading: false
      };
    case "detail_start":
      return {
        ...state,
        detailLoading: true
      };
    case "detail_success":
      return {
        ...state,
        detailLoading: false,
        detail: action.detail
      };
    case "detail_error":
      return {
        ...state,
        detailLoading: false,
        error: action.error
      };
    case "set_category":
      return {
        ...state,
        activeCategory: action.category
      };
    case "submit_start":
      return {
        ...state,
        submitting: true
      };
    case "submit_end":
      return {
        ...state,
        submitting: false
      };
    default:
      return state;
  }
}

export default function ChallengesPage() {
  const [state, dispatch] = useReducer(challengesReducer, initialState);
  const {
    geoJson,
    challenges,
    selected,
    detail,
    loading,
    detailLoading,
    error,
    activeCategory,
    submitting
  } = state;

  async function loadChallenges() {
    dispatch({ type: "load_start" });
    try {
      const [geo, response] = await Promise.all([
        fetch("/estonia.geojson").then((res) => res.json()),
        challengesApi.list()
      ]);
      dispatch({
        type: "load_success",
        geoJson: geo,
        challenges: response.challenges
      });
    } catch (err) {
      dispatch({
        type: "load_error",
        error: err.message
      });
    }
  }

  useEffect(() => {
    loadChallenges();
  }, []);

  useEffect(() => {
    if (!selected?.id) {
      dispatch({ type: "clear_detail" });
      return;
    }

    let active = true;
    dispatch({ type: "detail_start" });
    challengesApi.get(selected.id)
      .then((response) => {
        if (active) {
          dispatch({
            type: "detail_success",
            detail: response.challenge
          });
        }
      })
      .catch((err) => {
        if (active) {
          dispatch({
            type: "detail_error",
            error: err.message
          });
        }
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
    dispatch({ type: "submit_start" });
    try {
      const response = await challengesApi.submit(selected.id, flag);
      await loadChallenges();
      const detailResponse = await challengesApi.get(selected.id);
      dispatch({
        type: "detail_success",
        detail: detailResponse.challenge
      });
      return response;
    } catch (err) {
      dispatch({
        type: "detail_error",
        error: err.message
      });
      throw err;
    } finally {
      dispatch({ type: "submit_end" });
    }
  }

  async function handleUnlockHint(hintId) {
    try {
      const response = await challengesApi.unlockHint(selected.id, hintId);
      const detailResponse = await challengesApi.get(selected.id);
      dispatch({
        type: "detail_success",
        detail: detailResponse.challenge
      });
      await loadChallenges();
      return response;
    } catch (err) {
      dispatch({
        type: "detail_error",
        error: err.message
      });
      throw err;
    }
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
                <button type="button" className={`btn text-start ${activeCategory === "all" ? "btn-dark" : "btn-outline-dark"}`} onClick={() => dispatch({ type: "set_category", category: "all" })}>All categories <span className="float-end">{challenges.length}</span></button>
                {categories.map(([category, stats]) => (
                  <button type="button" key={category} className={`btn text-start ${activeCategory === category ? "btn-warning" : "btn-outline-dark"}`} onClick={() => dispatch({ type: "set_category", category })}>
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
            <MapBoard geoJson={geoJson} challenges={visibleChallenges} selectedId={selected?.id} onSelect={(challenge) => dispatch({ type: "select", challenge })} />
          ) : null}
        </div>
      </div>

      {selected ? <ChallengeModal challenge={detail || { ...selected, descriptionHtml: detailLoading ? "<p>Loading…</p>" : "<p>No detail loaded.</p>", hints: [] }} onClose={() => dispatch({ type: "clear_selection" })} onSubmitFlag={handleSubmitFlag} onUnlockHint={handleUnlockHint} submitting={submitting || detailLoading} /> : null}
    </div>
  );
}
