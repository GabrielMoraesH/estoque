import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

function PrivateRoute({ children, canAccess, redirectTo = "/dashboard" }) {
  const { isAuthenticated, isInitializing, user } = useAuth();

  if (isInitializing) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (typeof canAccess === "function" && !canAccess(user)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

export default PrivateRoute;
