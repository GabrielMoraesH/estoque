import { useCallback, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import "../styles/login.css";
import { useToast } from "../components/ToastProvider";
import useAuth from "../hooks/useAuth";
import { feedbackMessages, getFeedbackErrorMessage } from "../utils/feedbackMessages";

function Login() {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isAuthenticated, isInitializing, login: loginWithPassword } = useAuth();
  const isSubmitDisabled = submitting || !login.trim() || !senha;

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitting(true);

    try {
      await loginWithPassword({ login, senha });
      setSenha("");
      showToast(feedbackMessages.login.success);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setSenha("");
      showToast(getFeedbackErrorMessage(error, feedbackMessages.login.error), "error");
    } finally {
      setSubmitting(false);
    }
  }, [login, loginWithPassword, navigate, senha, showToast, submitting]);

  if (isInitializing) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img
          className="login-logo"
          src="/dimebras-oficial.png"
          alt="Dimebras"
        />

        <div className="desktop-only">
          <form className="login-form" onSubmit={handleSubmit}>
            <input
              className="login-input"
              placeholder="Usuário"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              disabled={submitting}
            />

            <input
              className="login-input"
              type="password"
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={submitting}
            />

            <button className="login-button" type="submit" disabled={isSubmitDisabled}>
              {submitting ? "Acessando..." : "Acessar sistema"}
            </button>
          </form>
        </div>

        <div className="mobile-only">
          <div className="login-copy">
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <input
                id="login-user"
                className="login-input"
                placeholder="Usuário"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="login-field">
              <input
                id="login-password"
                className="login-input"
                type="password"
                placeholder="Senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={submitting}
              />
            </div>

            <button className="login-button" type="submit" disabled={isSubmitDisabled}>
              {submitting ? "Acessando..." : "Acessar sistema"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
