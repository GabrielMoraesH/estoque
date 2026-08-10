function FeedbackState({
  type = "empty",
  title,
  message,
  compact = false
}) {
  const isLoading = type === "loading";
  const statusRole = isLoading ? "status" : "alert";

  return (
    <div
      className={`feedback-state feedback-${type}${compact ? " feedback-compact" : ""}`}
      role={statusRole}
      aria-live={isLoading ? "polite" : "assertive"}
    >
      {isLoading ? (
        <span className="feedback-spinner" aria-hidden="true" />
      ) : (
        <span className="feedback-icon" aria-hidden="true">
          {type === "error" ? "!" : "i"}
        </span>
      )}

      <div>
        <strong>{title}</strong>
        {message && <p>{message}</p>}
      </div>
    </div>
  );
}

export default FeedbackState;
