import { useMemo, useState } from "react";

export default function ChallengeModal({ challenge, onClose, onSubmitFlag, onUnlockHint, submitting }) {
  const [flag, setFlag] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  const unlockedHints = useMemo(() => challenge?.hints?.filter((hint) => hint.unlocked) ?? [], [challenge]);
  const lockedHints = useMemo(() => challenge?.hints?.filter((hint) => !hint.unlocked) ?? [], [challenge]);

  if (!challenge) return null;

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    try {
      const result = await onSubmitFlag(flag);
      setMessage(result.message);
      setMessageType(result.status === "correct" ? "success" : result.status === "already_solved" ? "info" : "danger");
      if (result.status === "correct") setFlag("");
    } catch (error) {
      setMessage(error.message);
      setMessageType("danger");
    }
  }

  async function unlockHint(hintId) {
    setMessage("");
    try {
      const result = await onUnlockHint(hintId);
      setMessage(result.message);
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("danger");
    }
  }

  return (
    <div className="challenge-modal-backdrop" onClick={onClose}>
      <div className="challenge-modal card shadow-lg border-0" onClick={(event) => event.stopPropagation()}>
        <div className="card-header bg-dark text-white d-flex justify-content-between align-items-start gap-3">
          <div>
            <div className="small text-uppercase text-warning fw-semibold">{challenge.category} · {challenge.difficulty}</div>
            <h2 className="h4 mb-1">{challenge.title}</h2>
            <div className="small text-white-50">{challenge.points} pts {challenge.usedTallinnFallback ? "· Tallinn fallback" : ""}</div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>×</button>
        </div>
        <div className="card-body modal-scroll">
          {message ? <div className={`alert alert-${messageType}`}>{message}</div> : null}

          <div className="mb-3">
            <div className="challenge-html" dangerouslySetInnerHTML={{ __html: challenge.descriptionHtml }} />
          </div>

          {challenge.tags?.length ? (
            <div className="mb-4 d-flex flex-wrap gap-2">
              {challenge.tags.map((tag) => <span className="badge text-bg-light border" key={tag}>{tag}</span>)}
            </div>
          ) : null}

          {challenge.files?.length ? (
            <div className="mb-4">
              <h3 className="h6 text-uppercase text-secondary">Files</h3>
              <div className="d-flex flex-wrap gap-2">
                {challenge.files.map((file) => <a className="btn btn-outline-dark btn-sm" href={file.url} target="_blank" rel="noreferrer" key={file.url}>{file.label || file.url}</a>)}
              </div>
            </div>
          ) : null}

          <div className="mb-4">
            <h3 className="h6 text-uppercase text-secondary">Hints</h3>
            <div className="d-grid gap-2">
              {unlockedHints.map((hint) => (
                <details className="hint-box" key={hint.id} open>
                  <summary>{hint.title} <span className="text-success ms-2">Unlocked</span></summary>
                  <div className="small text-secondary mt-1">Hint cost: {hint.cost}</div>
                  <div className="mt-2 challenge-html" dangerouslySetInnerHTML={{ __html: hint.contentHtml }} />
                </details>
              ))}

              {lockedHints.map((hint) => (
                <div className="hint-box d-flex justify-content-between align-items-center gap-3" key={hint.id}>
                  <div>
                    <div className="fw-semibold">{hint.title}</div>
                    <div className="small text-secondary">Unlock for {hint.cost} points</div>
                  </div>
                  <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => unlockHint(hint.id)}>Unlock</button>
                </div>
              ))}

              {!challenge.hints?.length ? <div className="text-secondary small">Sellel challil vihjeid veel ei ole.</div> : null}
            </div>
          </div>

          <form className="border rounded-3 p-3 bg-light" onSubmit={submit}>
            <label className="form-label fw-semibold">Submit flag</label>
            <div className="input-group">
              <input className="form-control" value={flag} onChange={(event) => setFlag(event.target.value)} placeholder="flag{...}" disabled={challenge.solved || submitting} />
              <button className="btn btn-warning" disabled={submitting || challenge.solved}>{challenge.solved ? "Solved" : submitting ? "Checking…" : "Submit"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
