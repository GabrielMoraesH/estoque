import FeedbackPanel from "../FeedbackPanel";
import FeedbackState from "../FeedbackState";

function DataState({
  loading,
  error,
  empty,
  loadingTitle,
  loadingMessage,
  errorTitle,
  emptyTitle,
  emptyMessage,
  children,
  panel = true,
  compact = false
}) {
  const Feedback = panel ? FeedbackPanel : FeedbackState;

  if (loading) {
    return (
      <Feedback
        type="loading"
        title={loadingTitle}
        message={loadingMessage}
        compact={compact}
      />
    );
  }

  if (error) {
    return (
      <Feedback
        type="error"
        title={errorTitle}
        message={error}
        compact={compact}
      />
    );
  }

  if (empty) {
    return (
      <Feedback
        type="empty"
        title={emptyTitle}
        message={emptyMessage}
        compact={compact}
      />
    );
  }

  return children;
}

export default DataState;
