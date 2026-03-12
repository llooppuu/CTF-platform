export default function ChallengeCard({ challenge, active, onSelect }) {
  return (
    <button
      type="button"
      className={`btn text-start challenge-tile ${active ? "challenge-tile-active" : ""} ${challenge.solved_by_me ? "challenge-tile-solved" : ""}`}
      onClick={() => onSelect(challenge.id)}
    >
      <div className="d-flex justify-content-between align-items-start gap-3">
        <div>
          <div className="fw-semibold">{challenge.name}</div>
          <div className="small text-secondary">{challenge.category}</div>
        </div>
        <span className="badge text-bg-dark">{challenge.value}</span>
      </div>
      <div className="mt-3 d-flex flex-wrap gap-2">
        {challenge.tags?.map((tag) => (
          <span key={tag.value} className="badge rounded-pill text-bg-light border">{tag.value}</span>
        ))}
      </div>
    </button>
  );
}
