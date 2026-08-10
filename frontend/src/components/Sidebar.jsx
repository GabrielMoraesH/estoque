import "../styles/sidebar.css";
import "../styles/user.css";
import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useEmpresa from "../hooks/useEmpresa";
import usePermissions from "../hooks/usePermissions";
import { useToast } from "./ToastProvider";
import { formatUserRoleLabel } from "../utils/formatters";

function Sidebar({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { empresas, activeEmpresa, setActiveEmpresa } = useEmpresa();
  const { showToast } = useToast();
  const {
    canApproveOc,
    canCreateOc,
    canManageUsers,
    canViewGestorOcs,
    canViewOwnOcs
  } = usePermissions();

  const initials = user?.nome
    ?.split(" ")
    .map((name) => name[0])
    .join("");

  const menuItems = [
    { to: "/dashboard", label: "Dashboard", visible: true },
    { to: "/users", label: "Usuários", visible: canManageUsers },
    { to: "/gerar-oc", label: "Gerar OC", visible: canCreateOc },
    { to: "/gestor", label: "Gestão de OCs", visible: canViewGestorOcs },
    { to: "/aprovacao", label: "Aprovação", visible: canApproveOc },
    { to: "/minhas-ocs", label: "Minhas OCs", visible: canViewOwnOcs }
  ];

  const handleNavigate = (to) => {
    if (location.pathname === to) {
      return;
    }

    navigate(to);
  };

  const isRouteActive = (to) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  const getMenuItemClassName = (to) =>
    isRouteActive(to) ? "menu-item active" : "menu-item";

  const handleClose = () => {
    if (typeof onClose === "function") {
      onClose();
    }
  };

  const handleEmpresaChange = (event) => {
    const empresaId = Number(event.target.value);
    const empresa = empresas.find((item) => Number(item.id) === empresaId);

    if (Number(activeEmpresa?.id) === empresaId) {
      return;
    }

    setActiveEmpresa(empresaId);

    if (empresa) {
      showToast(`Empresa ativa alterada para ${empresa.nome}`, "info");
    }
  };

  return (
    <div className="sidebar-content">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <img
            className="sidebar-logo"
            src="/dimebras.png"
            alt="Dimebras"
          />
          <span className="sidebar-mobile-caption">Navegação do sistema</span>
        </div>  
      </div>

      <nav className="sidebar-menu" aria-label="Navegação principal">
        {menuItems.filter((item) => item.visible).map((item) => (
          <button
            key={item.to}
            className={getMenuItemClassName(item.to)}
            type="button"
            aria-current={isRouteActive(item.to) ? "page" : undefined}
            onClick={() => {
              handleNavigate(item.to);
              handleClose();
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-box">
          <div className="user-avatar">{initials}</div>
          <div className="user-details">
            <div className="user-name">{user?.nome}</div>
            <div className="user-role">{formatUserRoleLabel(user?.role)}</div>
          </div>
        </div>

        {empresas.length > 0 && (
          <div className="sidebar-company">
            <label className="sidebar-company-label" htmlFor="active-empresa">
              Empresa ativa
            </label>

            {empresas.length > 1 ? (
              <select
                id="active-empresa"
                className="sidebar-company-select"
                value={activeEmpresa?.id || empresas[0]?.id || ""}
                onChange={handleEmpresaChange}
              >
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nome}
                  </option>
                ))}
              </select>
            ) : (
              <div className="sidebar-company-name">{empresas[0].nome}</div>
            )}
          </div>
        )}

        <button
          className="logout"
          type="button"
          onClick={() => {
            handleClose();
            logout();
            navigate("/", { replace: true });
          }}
        >
          Sair
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
