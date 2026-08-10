import Layout from "../components/Layout";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";
import usePermissions from "../hooks/usePermissions";
import "../styles/app-pages.css";

function Dashboard() {
  const navigate = useNavigate();
  const {
    canApproveOc,
    canCreateOc,
    canManageUsers,
    canViewGestorOcs,
    canViewOwnOcs
  } = usePermissions();

  const shortcuts = useMemo(() => {
    const items = [];

    if (canCreateOc) {
      items.push({ label: "Gerar OC", to: "/gerar-oc" });
    }

    if (canViewGestorOcs) {
      items.push({ label: "Gestor", to: "/gestor" });
    }

    if (canApproveOc) {
      items.push({ label: "Aprovação", to: "/aprovacao" });
    }

    if (canViewOwnOcs) {
      items.push({ label: "Minhas OCs", to: "/minhas-ocs" });
    }

    if (canManageUsers) {
      items.push({ label: "Usuários", to: "/users" });
    }

    return items;
  }, [canApproveOc, canCreateOc, canManageUsers, canViewGestorOcs, canViewOwnOcs]);

  return (
    <Layout>
      <div className="page-shell stack-lg">
        <PageHeader
          level={1}
          title="Dashboard"
          subtitle="Acompanhe o sistema de inventário e acesse rapidamente as rotinas principais."
        />

        <Panel
          title="Bem-vindo ao sistema"
          subtitle="Use os atalhos abaixo ou o menu lateral para acessar OCs, contagens e usuários."
        >
          <div className="dashboard-shortcuts">
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.to}
                className="primary-button"
                type="button"
                onClick={() => navigate(shortcut.to)}
              >
                {shortcut.label}
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </Layout>
  );
}

export default Dashboard;
