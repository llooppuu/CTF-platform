import { useEffect, useMemo, useState } from "react";
import Alert from "../components/Alert";
import ChallengeCard from "../components/ChallengeCard";
import { useApp } from "../context/AppContext";
import { attemptChallenge, getChallenge, getChallenges } from "../lib/ctfd";
import { extractChallengePresentation, filenameFromUrl } from "../lib/html";

function groupByCategory(challenges) {
  return challenges.reduce((accumulator, challenge) => {
    const category = challenge.category || "Uncategorized";
    accumulator[category] ||= [];
    accumulator[category].push(challenge);
    return accumulator;
  }, {});
}

export default function ChallengesPage() {
  const { currentUser, refreshAuth } = useApp();
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [challenges, setChallenges] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [submission, setSubmission] = useState("");
  const [responseMessage, setResponseMessage] = useState(null);
  const [error, setError] = useState("");

  async function loadList() {
    setLoadingList(true);
    setError("");
    try {
      const data = await getChallenges();
      setChallenges(data);
      if (!selectedId && data.length) setSelectedId(data[0].id);
    } catch (loadError) {
      setError(loadError?.message || "Unable to load challenges");
    } finally {
      setLoadingList(false);
    }
  }

  async function loadDetail(challengeId) {
    if (!challengeId) return;
    setLoadingDetail(true);
    setResponseMessage(null);
    try {
      const data = await getChallenge(challengeId);
      setDetail(data);
      setSubmission("");
    } catch (loadError) {
      setError(loadError?.message || "Unable to load challenge details");
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => { loadList(); }, []);
  useEffect(() => { loadDetail(selectedId); }, [selectedId]);

  const filteredChallenges = useMemo(() => {
    if (!search) return challenges;
    const needle = search.toLowerCase();
    return challenges.filter((challenge) => challenge.name?.toLowerCase().includes(needle) || challenge.category?.toLowerCase().includes(needle) || challenge.tags?.some((tag) => tag.value?.toLowerCase().includes(needle)));
  }, [challenges, search]);

  const categories = useMemo(() => groupByCategory(filteredChallenges), [filteredChallenges]);
  const presentation = useMemo(() => extractChallengePresentation(detail), [detail]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!detail || !submission.trim()) return;
    try {
      const result = await attemptChallenge(detail.id, submission.trim());
      setResponseMessage(result?.data || null);
      await Promise.all([loadList(), loadDetail(detail.id), refreshAuth()]);
    } catch (submitError) {
      setResponseMessage({ status: "error", message: submitError?.message || "Submission failed" });
    }
  }

  const alertClass = responseMessage?.status === "correct" ? "success" : responseMessage?.status === "already_solved" ? "info" : responseMessage?.status === "incorrect" || responseMessage?.status === "error" ? "danger" : "warning";

  return (
    <div className="container-fluid px-lg-5 py-4">
      <div className="row g-4">
        <div className="col-xl-5">
          <div className="card border-0 shadow-sm h-100"><div className="card-body">
            <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
              <div><h1 className="h3 mb-1">Challenges</h1><p className="text-secondary mb-0">Browse by category and open a challenge on the right.</p></div>
              <div className="challenge-search"><label className="form-label">Search</label><input className="form-control" placeholder="Name, category, or tag" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            </div>
            <Alert type="danger">{error}</Alert>
            {loadingList ? <div className="py-5 text-center"><div className="spinner-border" role="status" /></div> : (
              <div className="challenge-category-stack">
                {Object.entries(categories).map(([category, items]) => (
                  <section key={category} className="mb-4">
                    <h2 className="h6 text-uppercase text-secondary mb-3">{category}</h2>
                    <div className="d-grid gap-2">
                      {items.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} active={challenge.id === selectedId} onSelect={setSelectedId} />)}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div></div>
        </div>
        <div className="col-xl-7">
          <div className="card border-0 shadow-sm h-100"><div className="card-body challenge-detail-body">
            {loadingDetail ? <div className="py-5 text-center"><div className="spinner-border" role="status" /></div> : detail ? (
              <>
                <div className="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-3">
                  <div><h2 className="h3 mb-1">{detail.name}</h2><div className="text-secondary">{detail.category} • {detail.value} points</div></div>
                  <div className="d-flex flex-wrap gap-2">
                    {detail.solved_by_me ? <span className="badge text-bg-success">Solved</span> : null}
                    {typeof detail.solves === "number" ? <span className="badge text-bg-light border">{detail.solves} solves</span> : null}
                    {detail.attempts !== undefined ? <span className="badge text-bg-light border">{detail.attempts} attempts</span> : null}
                  </div>
                </div>
                {detail.tags?.length ? <div className="d-flex flex-wrap gap-2 mb-3">{detail.tags.map((tag) => <span key={tag} className="badge rounded-pill text-bg-light border">{tag}</span>)}</div> : null}
                <div className="mb-4 challenge-html" dangerouslySetInnerHTML={{ __html: presentation.descriptionHtml }} />
                {presentation.connectionHtml ? <div className="mb-4"><div className="small text-uppercase text-secondary fw-semibold mb-2">Connection</div><div className="challenge-html" dangerouslySetInnerHTML={{ __html: presentation.connectionHtml }} /></div> : null}
                {detail.files?.length ? <div className="mb-4"><div className="small text-uppercase text-secondary fw-semibold mb-2">Files</div><div className="d-flex flex-wrap gap-2">{detail.files.map((file) => <a key={file} className="btn btn-outline-dark btn-sm" href={file} target="_blank" rel="noreferrer">{filenameFromUrl(file)}</a>)}</div></div> : null}
                {presentation.hints?.length ? <div className="mb-4"><div className="small text-uppercase text-secondary fw-semibold mb-2">Hints</div><div className="d-grid gap-2">{presentation.hints.map((hint, index) => <details key={`${hint.summary}-${index}`} className="hint-box"><summary>{hint.summary}</summary>{hint.contentHtml ? <div className="mt-2 challenge-html" dangerouslySetInnerHTML={{ __html: hint.contentHtml }} /> : <div className="mt-2 text-secondary small">Hint unlock actions can be added next if you want full parity.</div>}</details>)}</div></div> : null}
                <form onSubmit={handleSubmit} className="border-top pt-4">
                  <div className="small text-uppercase text-secondary fw-semibold mb-2">Submit flag</div>
                  {!currentUser ? <Alert type="warning">You need to log in before you can submit a flag.</Alert> : null}
                  {responseMessage ? <div className={`alert alert-${alertClass}`}>{responseMessage.message || "Submission finished"}</div> : null}
                  <div className="row g-2">
                    <div className="col-sm-8"><input className="form-control" placeholder="flag{...}" value={submission} onChange={(event) => setSubmission(event.target.value)} disabled={!currentUser} /></div>
                    <div className="col-sm-4"><button className="btn btn-dark w-100" disabled={!currentUser || !submission.trim()}>Submit</button></div>
                  </div>
                </form>
              </>
            ) : <div className="py-5 text-center text-secondary">Select a challenge to view it here.</div>}
          </div></div>
        </div>
      </div>
    </div>
  );
}
