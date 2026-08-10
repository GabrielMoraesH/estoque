# Arquivos alterados - polish final do frontend

## frontend/src/components/Layout.jsx
```jsx
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../styles/layout.css";

function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="layout">
      <button
        className="hamburger"
        type="button"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        aria-controls="app-sidebar"
        onClick={() => setOpen(!open)}
      >
        {open ? "\u00d7" : "\u2630"}
      </button>

      {open && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      )}

      <div id="app-sidebar" className={open ? "sidebar open" : "sidebar"}>
        <Sidebar />
      </div>

      <div className="content" onClick={() => open && setOpen(false)}>
        {children}
      </div>
    </div>
  );
}

export default Layout;

```

## frontend/src/components/Sidebar.jsx
```jsx
import "../styles/sidebar.css";
import "../styles/user.css";
import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import usePermissions from "../hooks/usePermissions";
import { formatUserRoleLabel } from "../utils/formatters";

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
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

  return (
    <div className="sidebar-content">
      <img
        className="sidebar-logo"
        src="/dimebras.png"
        alt="Dimebras"
      />

      <nav className="sidebar-menu" aria-label="Navegação principal">
        {menuItems.filter((item) => item.visible).map((item) => (
          <button
            key={item.to}
            className={getMenuItemClassName(item.to)}
            type="button"
            aria-current={isRouteActive(item.to) ? "page" : undefined}
            onClick={() => handleNavigate(item.to)}
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

        <button
          className="logout"
          type="button"
          onClick={() => {
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

```

## frontend/src/components/FeedbackState.jsx
```jsx
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

```

## frontend/src/components/ToastProvider.jsx
```jsx
import { createContext, useContext, useEffect, useRef, useState } from "react";
import "../styles/toast.css";

const ToastContext = createContext(null);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timeoutIds = useRef({});

  const removeToast = (id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));

    if (timeoutIds.current[id]) {
      clearTimeout(timeoutIds.current[id]);
      delete timeoutIds.current[id];
    }
  };

  const showToast = (message, type = "success") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setToasts((current) => [...current, { id, message, type }]);

    timeoutIds.current[id] = setTimeout(() => {
      removeToast(id);
    }, 3500);
  };

  useEffect(() => {
    const currentTimeouts = timeoutIds.current;

    return () => {
      Object.values(currentTimeouts).forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutIds.current = {};
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            role="status"
          >
            <div className="toast-content">
              <div className="toast-badge" />
              <p className="toast-message">{toast.message}</p>
            </div>

            <button
              className="toast-close"
              type="button"
              aria-label="Fechar aviso"
              onClick={() => removeToast(toast.id)}
            >
              \u00d7
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}

export default ToastProvider;

```

## frontend/src/components/approval/ApprovalDetailModal.jsx
```jsx
import { useEffect } from "react";

function ApprovalDetailModal({ detailModal, onClose }) {
  useEffect(() => {
    if (!detailModal) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailModal, onClose]);

  if (!detailModal) {
    return null;
  }

  const rows = Array.isArray(detailModal.rows) ? detailModal.rows : [];

  return (
    <div className="aprovacao-modal-overlay" onClick={onClose}>
      <div
        className="aprovacao-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-detail-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aprovacao-modal-header">
          <h3 id="approval-detail-modal-title">{detailModal.title || "Detalhes"}</h3>
          <button
            className="aprovacao-close-button"
            type="button"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="aprovacao-modal-list">
          {rows.map((row, index) => (
            <div key={`${row?.principal || "detail"}-${index}`} className="aprovacao-modal-item">
              <strong>{row?.principal || "Não informado"}</strong>
              <span>{row?.secondary || ""}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ApprovalDetailModal;

```

## frontend/src/components/approval/ApprovalDetailsPanel.jsx
```jsx
import { memo, useCallback } from "react";
import DataState from "../ui/DataState";
import Panel from "../ui/Panel";
import TableContainer from "../ui/TableContainer";
import {
  formatBalance,
  formatOcCode,
  formatProductName,
  formatResponsibleName,
  formatSignedNumber,
  getItemStatusLabel
} from "../../utils/formatters";
import { getRenderableList } from "../../utils/ocData";

const ApprovalDetailsRow = memo(function ApprovalDetailsRow({
  item,
  canRequestRecount,
  interactionDisabled,
  isMarkedForRecount,
  onToggleRecountGroup,
  onOpenLocationDetails,
  onOpenLotDetails
}) {
  const handleOpenLocationDetails = useCallback(() => {
    if (item) {
      onOpenLocationDetails(item);
    }
  }, [item, onOpenLocationDetails]);

  const handleOpenLotDetails = useCallback(() => {
    if (item) {
      onOpenLotDetails(item);
    }
  }, [item, onOpenLotDetails]);

  const handleToggleRecountGroup = useCallback(() => {
    const itemIds = Array.isArray(item?.itemIds) ? item.itemIds : [];
    onToggleRecountGroup(itemIds);
  }, [item?.itemIds, onToggleRecountGroup]);

  return (
    <tr>
      <td className="aprovacao-product-name">{formatProductName(item)}</td>
      <td>{formatBalance(item?.saldoSistemaTotal)}</td>
      <td>{formatBalance(item?.saldoContadoTotal)}</td>
      <td className="aprovacao-difference">{formatSignedNumber(item?.diferencaTotal)}</td>
      <td>
        <button
          className="aprovacao-detail-button"
          type="button"
          onClick={handleOpenLocationDetails}
          disabled={interactionDisabled}
        >
          Ver localizações
        </button>
      </td>
      <td>
        <button
          className="aprovacao-detail-button"
          type="button"
          onClick={handleOpenLotDetails}
          disabled={interactionDisabled}
        >
          Ver lotes
        </button>
      </td>
      <td>
        <span className="aprovacao-item-status">{getItemStatusLabel(item?.status)}</span>
      </td>
      {canRequestRecount && (
        <td>
          <input
            className="aprovacao-checkbox"
            type="checkbox"
            checked={isMarkedForRecount}
            onChange={handleToggleRecountGroup}
            disabled={interactionDisabled}
          />
        </td>
      )}
    </tr>
  );
});

function ApprovalDetailsPanel({
  selectedOC,
  groupedItems,
  loading,
  error,
  recounting,
  approvingId,
  openingDetailsId,
  canRequestRecount,
  isGroupMarkedForRecount,
  onToggleRecountGroup,
  onOpenLocationDetails,
  onOpenLotDetails,
  onClose,
  onSendToRecount
}) {
  if (!selectedOC) {
    return null;
  }

  const safeGroupedItems = getRenderableList(groupedItems);
  const interactionDisabled = recounting || approvingId === selectedOC?.id || openingDetailsId === selectedOC?.id;

  return (
    <Panel
      className="aprovacao-details"
      title={`Detalhes da OC ${formatOcCode(selectedOC?.id)}`}
      subtitle={`Estoquista: ${formatResponsibleName(selectedOC?.estoquista_nome)}`}
      headerClassName="aprovacao-details-header"
      actions={(
        <button
          className="secondary-button"
          type="button"
          onClick={onClose}
          disabled={interactionDisabled}
        >
          Fechar
        </button>
      )}
    >

      <DataState
        loading={loading}
        error={error}
        empty={safeGroupedItems.length === 0}
        loadingTitle="Carregando itens da OC"
        loadingMessage="Preparando os saldos e diferenças para revisão."
        errorTitle="Não foi possível carregar os itens"
        emptyTitle="Nenhum item disponível para revisão"
        emptyMessage="Os itens contados ou aprovados aparecerão neste painel."
        panel={false}
      >
        <>
          <TableContainer className="aprovacao-table-wrapper">
            <table className="aprovacao-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Saldo do sistema</th>
                  <th>Saldo contado</th>
                  <th>Diferença</th>
                  <th>Localizações</th>
                  <th>Lotes</th>
                  <th>Status</th>
                  {canRequestRecount && <th>Recontar</th>}
                </tr>
              </thead>
              <tbody>
                {safeGroupedItems.map((item) => (
                  <ApprovalDetailsRow
                    key={item?.produto || item?.itemIds?.join("-")}
                    item={item}
                    canRequestRecount={canRequestRecount}
                    interactionDisabled={interactionDisabled}
                    isMarkedForRecount={isGroupMarkedForRecount(item?.itemIds || [])}
                    onToggleRecountGroup={onToggleRecountGroup}
                    onOpenLocationDetails={onOpenLocationDetails}
                    onOpenLotDetails={onOpenLotDetails}
                  />
                ))}
              </tbody>
            </table>
          </TableContainer>

          {canRequestRecount && (
            <div className="aprovacao-recount-actions">
              <button
                className="aprovacao-recount-button"
                type="button"
                onClick={onSendToRecount}
                disabled={interactionDisabled}
              >
                {recounting ? "Enviando para recontagem..." : "Enviar para recontagem"}
              </button>
            </div>
          )}
        </>
      </DataState>
    </Panel>
  );
}

export default memo(ApprovalDetailsPanel);

```

## frontend/src/components/users/DeleteUserModal.jsx
```jsx
import { memo, useCallback, useEffect } from "react";
import { feedbackMessages } from "../../utils/feedbackMessages";

function DeleteUserModal({ user, deletingId, onCancel, onConfirm }) {
  const isDeleting = deletingId === user?.id;

  const handleModalClick = useCallback((e) => {
    e.stopPropagation();
  }, []);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isDeleting) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting, onCancel, user]);

  if (!user) {
    return null;
  }

  return (
    <div className="users-modal-overlay" onClick={isDeleting ? undefined : onCancel}>
      <div
        className="users-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-user-modal-title"
        onClick={handleModalClick}
      >
        <h3 id="delete-user-modal-title" className="users-modal-title">{feedbackMessages.users.deleteTitle}</h3>
        <p className="users-modal-text">
          {feedbackMessages.users.deleteQuestionPrefix} <strong>{user.nome}</strong>?
        </p>
        <p className="users-modal-warning">
          {feedbackMessages.users.deleteWarning}
        </p>

        <div className="users-modal-actions">
          <button
            className="users-modal-cancel"
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancelar
          </button>

          <button
            className="users-delete-button"
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting
              ? feedbackMessages.users.deletingButton
              : feedbackMessages.users.deleteButton}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(DeleteUserModal);

```

## frontend/src/pages/OcDetails.jsx
```jsx
import Layout from "../components/Layout";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import BackButton from "../components/BackButton";
import DataState from "../components/ui/DataState";
import PageHeader from "../components/ui/PageHeader";
import ProductCountingSection from "../components/products/ProductCountingSection";
import usePermissions from "../hooks/usePermissions";
import useOCs from "../hooks/useOCs";
import useProdutos from "../hooks/useProdutos";
import { useToast } from "../components/ToastProvider";
import { feedbackMessages, getFeedbackErrorMessage } from "../utils/feedbackMessages";
import {
  asArray,
  attachLocationsToItems,
  getActionableOcItems,
  getUniqueProductNames
} from "../utils/ocData";
import { formatOcCode } from "../utils/formatters";
import "../styles/produto.css";
import "../styles/app-pages.css";

function OcDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { canViewCountingItem } = usePermissions();
  const { fetchOcItems } = useOCs();
  const { fetchProdutos, getLocalizacoesPorProduto } = useProdutos();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [produtosExterno, setProdutosExterno] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const loadItems = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const [data, produtosData] = await Promise.all([
          fetchOcItems(id),
          fetchProdutos()
        ]);

        const actionableItems = getActionableOcItems(data);

        setItems(actionableItems);
        setProdutosExterno(asArray(produtosData));
        setSelectedProduct((current) => {
          const preferredProduct = location.state?.selectedProduct;
          const hasPreferredProduct = actionableItems.some(
            (item) => item?.produto === preferredProduct
          );

          if (hasPreferredProduct) {
            return preferredProduct;
          }

          return current && actionableItems.some((item) => item?.produto === current)
            ? current
            : actionableItems[0]?.produto || "";
        });
      } catch (error) {
        const message = getFeedbackErrorMessage(error, feedbackMessages.oc.loadItemsError);
        setItems([]);
        setSelectedProduct("");
        setLoadError(message);
        showToast(message, "error");
      } finally {
        setLoading(false);
      }
    };

    if (canViewCountingItem) {
      loadItems();
    }
  }, [canViewCountingItem, fetchOcItems, fetchProdutos, id, location.state?.selectedProduct, showToast]);

  const groupedProducts = useMemo(() => {
    return getUniqueProductNames(items);
  }, [items]);

  const selectedProductItems = useMemo(() => {
    return attachLocationsToItems(
      items,
      produtosExterno,
      selectedProduct,
      getLocalizacoesPorProduto
    );
  }, [getLocalizacoesPorProduto, items, produtosExterno, selectedProduct]);

  const handleSelectedProductChange = useCallback((e) => {
    setSelectedProduct(e.target.value);
  }, []);

  const handleOpenItem = useCallback((itemId) => {
    navigate(`/contar/${id}/${itemId}`, {
      state: {
        from: location.state?.from || "/minhas-ocs",
        selectedProduct
      }
    });
  }, [id, location.state?.from, navigate, selectedProduct]);

  if (!canViewCountingItem) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="page-shell stack-lg">
        <BackButton fallbackTo="/minhas-ocs" />

        <PageHeader
          title={`OC ${formatOcCode(id)}`}
          subtitle="Selecione um produto e acompanhe o status de cada localização."
        />

        <DataState
          loading={loading}
          error={loadError}
          empty={!loading && !loadError && items.length === 0}
          loadingTitle="Carregando itens da OC"
          loadingMessage="Buscando produtos e localizações para contagem."
          errorTitle="Não foi possível carregar os itens"
          emptyTitle="Nenhum item disponível para contagem"
          emptyMessage="Esta OC não possui itens pendentes ou todos os itens já foram aprovados."
        >
          <ProductCountingSection
            products={groupedProducts}
            selectedProduct={selectedProduct}
            locationItems={selectedProductItems}
            canOpenItem={canViewCountingItem}
            onSelectedProductChange={handleSelectedProductChange}
            onOpenItem={handleOpenItem}
          />
        </DataState>
      </div>
    </Layout>
  );
}

export default OcDetails;

```

## frontend/src/styles/layout.css
```css
.layout {
  display: flex;
  min-height: 100vh;
  background: linear-gradient(180deg, #f4f7fb 0%, #eef3f9 100%);
}

.sidebar {
  display: block;
  flex-shrink: 0;
}

.content {
  flex: 1;
  display: flex;
  justify-content: center;
  min-width: 0;
  padding: 24px 32px;
  box-sizing: border-box;
}

.hamburger,
.sidebar-backdrop {
  display: none;
}

@media (max-width: 768px) {
  .layout {
    display: block;
  }

  .hamburger {
    display: flex;
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 1100;
    width: 46px;
    height: 46px;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 14px;
    background: #223c79;
    color: #ffffff;
    font-size: 22px;
    font-weight: 700;
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.18);
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  }

  .hamburger:hover,
  .hamburger:focus-visible {
    background: #1a2f61;
    outline: none;
    box-shadow: 0 0 0 3px rgba(34, 60, 121, 0.18), 0 12px 24px rgba(15, 23, 42, 0.18);
  }

  .hamburger:active {
    transform: translateY(1px);
  }

  .sidebar.open ~ .content .hamburger {
    display: none;
  }

  .hamburger[aria-label="Fechar menu"] {
    background: #dc2626;
  }

  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 999;
    border: none;
    background: rgba(15, 23, 42, 0.48);
    backdrop-filter: blur(2px);
  }

  .sidebar {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
    width: min(84vw, 340px);
    max-width: 340px;
    height: 100vh;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    overflow-y: auto;
    box-shadow: 18px 0 40px rgba(15, 23, 42, 0.26);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .content {
    display: block;
    padding: 78px 14px 24px;
  }
}

@media (min-width: 769px) and (max-width: 1180px) {
  .content {
    padding: 22px 24px;
  }
}

```

## frontend/src/styles/app-pages.css
```css
.page-shell {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-header {
  margin: 0;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin: 0;
}

.section-header-content {
  min-width: 0;
}

.section-header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
}

.panel-card > .section-header {
  width: 100%;
}

.back-button {
  align-self: flex-start;
  min-width: 110px;
  height: 42px;
  border: 1px solid #d3dbe7;
  border-radius: 8px;
  background: #ffffff;
  color: #223c79;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.back-button:hover,
.back-button:focus-visible {
  border-color: #c3d2eb;
  background: #eef4ff;
  color: #1a2f61;
  outline: none;
  box-shadow: 0 10px 22px rgba(34, 60, 121, 0.1);
}

.back-button:active {
  transform: translateY(1px);
}

.page-title {
  margin: 0 0 8px;
  font-size: 34px;
  line-height: 1.12;
  font-weight: 800;
  color: #0f172a;
}

.page-subtitle {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
  color: #64748b;
  max-width: 760px;
}

.panel-card {
  background: #ffffff;
  border: 1px solid #d9e0ea;
  border-radius: 12px;
  padding: 26px 30px;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
  box-sizing: border-box;
}

.section-title {
  margin: 0 0 8px;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 800;
  color: #0f172a;
}

.section-subtitle {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #64748b;
}

.table-container {
  overflow-x: auto;
}

.toolbar-card {
  display: flex;
  align-items: end;
  gap: 16px;
  margin-bottom: 0;
  flex-wrap: wrap;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 260px;
  flex: 1;
}

.field-group label {
  font-size: 14px;
  font-weight: 700;
  color: #223c79;
}

.field-control {
  height: 46px;
  width: 100%;
  padding: 0 14px;
  border: 1px solid #d3dbe7;
  border-radius: 8px;
  font-size: 14px;
  color: #0f172a;
  background: #f8fafc;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.field-control:focus {
  border-color: #223c79;
  box-shadow: 0 0 0 3px rgba(34, 60, 121, 0.12);
  background: #ffffff;
}

.primary-button {
  min-width: 190px;
  height: 46px;
  border: none;
  border-radius: 8px;
  background: #223c79;
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.primary-button:hover,
.primary-button:focus-visible {
  background: #1a2f61;
  transform: translateY(-1px);
  outline: none;
  box-shadow: 0 0 0 3px rgba(34, 60, 121, 0.14);
}

.primary-button:active {
  transform: translateY(1px);
}

.primary-button:disabled {
  opacity: 0.72;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.secondary-button {
  min-width: 130px;
  height: 42px;
  border: 1px solid #d3dbe7;
  border-radius: 8px;
  background: #f8fafc;
  color: #223c79;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.secondary-button:hover,
.secondary-button:focus-visible {
  background: #eef4ff;
  border-color: #c3d2eb;
  outline: none;
  transform: translateY(-1px);
  box-shadow: 0 0 0 3px rgba(34, 60, 121, 0.12);
}

.secondary-button:active {
  transform: translateY(1px);
}

.secondary-button:disabled {
  opacity: 0.72;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.dashboard-shortcuts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}

.dashboard-shortcuts .primary-button {
  min-width: 170px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  padding: 24px;
  color: #64748b;
  font-size: 15px;
  text-align: center;
  line-height: 1.5;
}

.feedback-state {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-height: 118px;
  padding: 22px;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  color: #334155;
  box-sizing: border-box;
}

.feedback-compact {
  min-height: 0;
  padding: 16px;
}

.feedback-state strong {
  display: block;
  margin-bottom: 6px;
  font-size: 15px;
  color: #0f172a;
}

.feedback-state p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #64748b;
}

.feedback-icon,
.feedback-spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  border-radius: 999px;
}

.feedback-icon {
  background: #eef4ff;
  color: #223c79;
  font-size: 14px;
  font-weight: 800;
}

.feedback-error {
  border-color: #fecaca;
  background: #fff7f7;
}

.feedback-error .feedback-icon {
  background: #fee2e2;
  color: #b91c1c;
}

.feedback-loading {
  border-style: solid;
}

.feedback-spinner {
  border: 3px solid #dbe7ff;
  border-top-color: #223c79;
  animation: feedback-spin 0.8s linear infinite;
}

@keyframes feedback-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes modal-fade {
  from {
    opacity: 0;
  }
}

@keyframes modal-enter {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}

.stack-lg {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@media (max-width: 768px) {
  .page-shell {
    max-width: 100%;
  }

  .page-header {
    margin-bottom: 0;
  }

  .page-title {
    font-size: 28px;
    line-height: 1.1;
  }

  .page-subtitle {
    font-size: 14px;
    line-height: 1.5;
  }

  .panel-card {
    padding: 18px 14px;
    border-radius: 12px;
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.05);
  }

  .section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .section-header-actions {
    justify-content: stretch;
  }

  .section-header-actions > * {
    width: 100%;
  }

  .back-button {
    width: 100%;
    min-width: 0;
    height: 44px;
  }

  .toolbar-card {
    align-items: stretch;
    gap: 14px;
    margin-bottom: 0;
  }

  .field-group {
    min-width: 100%;
  }

  .field-group label {
    font-size: 13px;
  }

  .field-control {
    height: 44px;
    font-size: 14px;
  }

  .primary-button {
    width: 100%;
    min-width: 0;
    height: 44px;
    font-size: 14px;
  }

  .secondary-button {
    width: 100%;
    min-width: 0;
    height: 44px;
  }

  .dashboard-shortcuts {
    margin-top: 16px;
  }

  .dashboard-shortcuts .primary-button {
    min-width: 0;
  }

  .empty-state {
    min-height: 108px;
    padding: 18px 14px;
    font-size: 14px;
  }

  .feedback-state {
    min-height: 104px;
    padding: 18px 14px;
  }

  .stack-lg {
    gap: 18px;
  }
}

```

## frontend/src/styles/sidebar.css
```css
.sidebar {
  width: 250px;
  min-height: 100vh;
  background-color: #223c79;
  color: white;
  padding: 20px;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  align-self: flex-start;
  box-sizing: border-box;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: calc(100vh - 40px);
}

.sidebar-logo {
  display: block;
  max-width: 100%;
  height: auto;
  margin-bottom: 28px;
}

.sidebar-menu {
  flex: 1;
  padding-bottom: 180px;
}

.menu-item {
  display: flex;
  width: 100%;
  padding: 14px 12px;
  margin-bottom: 16px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  text-align: left;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 700;
  transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.menu-item:hover,
.menu-item:focus-visible {
  background-color: #1e293b;
  border-color: rgba(255, 255, 255, 0.14);
  outline: none;
}

.menu-item:active {
  transform: translateY(1px);
}

.menu-item.active {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.22);
  color: #ffffff;
  box-shadow: inset 4px 0 0 #ffffff;
}

.sidebar-footer {
  position: sticky;
  bottom: 20px;
  margin-top: auto;
  padding-top: 20px;
  background-color: #223c79;
}

.logout {
  margin-top: 16px;
  width: 100%;
  background-color: #dc2626;
  color: white;
  border: none;
  min-height: 42px;
  padding: 10px 12px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.logout:hover,
.logout:focus-visible {
  background-color: #d10f0f;
  transform: translateY(-1px);
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.18);
}

.logout:active {
  transform: translateY(1px);
}

@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    min-height: 100%;
    height: 100%;
    padding: 20px 18px 22px;
    position: relative;
    top: auto;
    align-self: auto;
    border-radius: 0 24px 24px 0;
  }

  .sidebar-content {
    min-height: 100%;
  }

  .sidebar-logo {
    max-width: 210px;
    margin: 8px 0 28px;
  }

  .sidebar-menu {
    padding-bottom: 18px;
  }

  .menu-item {
    margin-bottom: 12px;
    padding: 14px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 15px;
    font-weight: 700;
  }

  .sidebar-footer {
    position: static;
    bottom: auto;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
  }

  .logout {
    width: 100%;
    margin-top: 18px;
  }
}

```

## frontend/src/styles/toast.css
```css
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(360px, calc(100vw - 24px));
}

.toast {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 14px 14px 16px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.96);
  color: #ffffff;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
}

.toast-success .toast-badge {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
}

.toast-error .toast-badge {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.toast-info .toast-badge {
  background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%);
}

.toast-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
}

.toast-badge {
  width: 12px;
  height: 12px;
  margin-top: 4px;
  border-radius: 999px;
  flex-shrink: 0;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.08);
}

.toast-message {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  font-weight: 600;
}

.toast-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}

.toast-close:hover,
.toast-close:focus-visible {
  background: rgba(255, 255, 255, 0.16);
  outline: none;
}

@media (max-width: 768px) {
  .toast-container {
    top: 14px;
    right: 12px;
    left: 12px;
    width: auto;
  }

  .toast {
    border-radius: 14px;
    padding: 13px 12px 13px 14px;
  }
}

```
