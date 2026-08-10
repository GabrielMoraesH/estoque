import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function BackButton({ to, fallbackTo = "/dashboard", state }) {
  const navigate = useNavigate();
  const location = useLocation();

  const canUseHistoryBack = typeof window !== "undefined"
    && typeof window.history?.state?.idx === "number"
    && window.history.state.idx > 0;

  const target = to || location.state?.from || fallbackTo;

  const handleBack = useCallback(() => {
    if (!target) {
      navigate(-1);
      return;
    }

    if (to) {
      navigate(to, state ? { state } : undefined);
      return;
    }

    if (location.state?.from) {
      navigate(location.state.from, state ? { state } : undefined);
      return;
    }

    if (canUseHistoryBack) {
      navigate(-1);
      return;
    }

    navigate(target, { replace: true, ...(state ? { state } : {}) });
  }, [canUseHistoryBack, location.state, navigate, state, target, to]);

  return (
    <button
      className="back-button"
      type="button"
      onClick={handleBack}
    >
      Voltar
    </button>
  );
}

export default BackButton;
