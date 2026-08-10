import Layout from "../components/Layout";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import "../styles/contar.css";
import "../styles/app-pages.css";
import { useToast } from "../components/ToastProvider";
import BackButton from "../components/BackButton";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";
import useEmpresa from "../hooks/useEmpresa";
import usePermissions from "../hooks/usePermissions";
import useOCs from "../hooks/useOCs";
import { feedbackMessages, getFeedbackErrorMessage } from "../utils/feedbackMessages";

function ContarItem() {
  const { ocId, itemId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { activeEmpresa } = useEmpresa();
  const { canCountOc } = usePermissions();
  const { saveItemCount } = useOCs();

  const [quantidade, setQuantidade] = useState("");
  const [lote, setLote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQuantidade("");
    setLote("");
    setSaving(false);
  }, [activeEmpresa?.id, itemId, ocId]);

  const handleSalvar = useCallback(async (event) => {
    event?.preventDefault();

    if (!canCountOc || saving) {
      return;
    }

    if (!quantidade || !lote.trim()) {
      showToast(feedbackMessages.count.requiredFields, "info");
      return;
    }

    setSaving(true);

    try {
      const newModelLocationId = location.state?.ocLocalizacaoId || itemId;
      const countPayload = location.state?.newModel
        ? {
            oc_id: ocId,
            oc_localizacao_id: newModelLocationId,
            quantidade,
            lote
          }
        : {
            oc_id: ocId,
            item_id: itemId,
            quantidade,
            lote
          };
      const response = await saveItemCount({
        ...countPayload
      });

      if (response?.id) {
        showToast(feedbackMessages.count.saveSuccess);
        setQuantidade("");
        setLote("");
        navigate(`/oc/${ocId}`, {
          replace: true,
          state: {
            from: location.state?.from || "/minhas-ocs",
            selectedProduct: location.state?.selectedProduct
          }
        });
        return;
      }

      showToast(feedbackMessages.count.saveError, "error");
    } catch (error) {
      showToast(getFeedbackErrorMessage(error, feedbackMessages.count.saveError), "error");
    } finally {
      setSaving(false);
    }
  }, [
    canCountOc,
    itemId,
    location.state?.newModel,
    location.state?.ocLocalizacaoId,
    location.state?.from,
    location.state?.selectedProduct,
    navigate,
    ocId,
    quantidade,
    lote,
    saveItemCount,
    saving,
    showToast
  ]);

  if (!canCountOc) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="page-shell stack-lg">
        <BackButton
          to={`/oc/${ocId}`}
          fallbackTo="/minhas-ocs"
          state={{
            from: location.state?.from || "/minhas-ocs",
            selectedProduct: location.state?.selectedProduct
          }}
        />

        <PageHeader
          title="Registrar contagem"
          subtitle="Informe a quantidade e o lote para registrar a contagem do item."
        />

        <Panel className="counting-card">
          <div className="counting-meta">
            <span className="counting-badge">OC: {ocId}</span>
            <span className="counting-badge">Item: {itemId}</span>
          </div>

          <form className="counting-form" onSubmit={handleSalvar}>
            <div className="field-group">
              <label htmlFor="quantidade">Quantidade</label>
              <input
                id="quantidade"
                className="field-control"
                placeholder="Informe a quantidade"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="field-group">
              <label htmlFor="lote">Lote</label>
              <input
                id="lote"
                className="field-control"
                placeholder="Informe o lote"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="counting-actions">
              {canCountOc && (
                <button className="primary-button" type="submit" disabled={saving || !quantidade || !lote.trim()}>
                  {saving ? "Salvando contagem..." : "Salvar contagem"}
                </button>
              )}
            </div>
          </form>
        </Panel>
      </div>
    </Layout>
  );
}

export default ContarItem;
