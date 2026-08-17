import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PrivateRoute from "./components/PrivateRoute";
import Users from "./pages/Users";
import Gestor from "./pages/Gestor";
import GestorOcDetails from "./pages/GestorOcDetails";
import MinhasOCs from "./pages/MinhasOCs";
import OcDetails from "./pages/OcDetails";
import ContarItem from "./pages/ContarItem";
import GerarOC from "./pages/GerarOC";
import Aprovacao from "./pages/Aprovacao";
import Audit from "./pages/Audit";
import Empresas from "./pages/Empresas";
import ToastProvider from "./components/ToastProvider";
import { AuthProvider } from "./contexts/AuthContext";
import {
  canApproveOc,
  canCountOc,
  canCreateOc,
  canManageUsers,
  canManageEmpresas,
  canViewAudit,
  canViewCountingItem,
  canViewGestorOcs,
  canViewOwnOcs
} from "./utils/permissions";

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />

            <Route
              path="/auditoria"
              element={<PrivateRoute canAccess={canViewAudit}><Audit /></PrivateRoute>}
            />

            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />

            <Route
              path="/empresas"
              element={<PrivateRoute canAccess={canManageEmpresas}><Empresas /></PrivateRoute>}
            />

            <Route
              path="/users"
              element={
                <PrivateRoute canAccess={canManageUsers}>
                  <Users />
                </PrivateRoute>
              }
            />

            <Route
              path="/gestor"
              element={
                <PrivateRoute canAccess={canViewGestorOcs}>
                  <Gestor />
                </PrivateRoute>
              }
            />

            <Route
              path="/gestor/oc/:id"
              element={
                <PrivateRoute canAccess={canViewGestorOcs}>
                  <GestorOcDetails />
                </PrivateRoute>
              }
            />

            <Route
              path="/gerar-oc"
              element={
                <PrivateRoute canAccess={canCreateOc}>
                  <GerarOC />
                </PrivateRoute>
              }
            />

            <Route
              path="/aprovacao"
              element={
                <PrivateRoute canAccess={canApproveOc}>
                  <Aprovacao />
                </PrivateRoute>
              }
            />

            <Route
              path="/minhas-ocs"
              element={
                <PrivateRoute canAccess={canViewOwnOcs}>
                  <MinhasOCs />
                </PrivateRoute>
              }
            />

            <Route
              path="/oc/:id"
              element={
                <PrivateRoute canAccess={canCountOc}>
                  <OcDetails />
                </PrivateRoute>
              }
            />

            <Route
              path="/contar/:ocId/:itemId"
              element={
                <PrivateRoute canAccess={canViewCountingItem}>
                  <ContarItem />
                </PrivateRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
