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

function isValidCountQuantity(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }

  if (!/^\d+$/.test(value.trim())) {
    return false;
  }

  const numberValue = Number(value);
  return Number.isSafeInteger(numberValue) && numberValue >= 0;
}

function ContarItem() {
  const { ocId, itemId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { activeEmpresa } = useEmpresa();
  const { canCountOc } = usePermissions();
  const { fetchOcItems, saveItemCount } = useOCs();

  const [quantidade, setQuantidade] = useState("");
  const [lote, setLote] = useState("");
  const [saving, setSaving] = useState(false);
  const [countTarget, setCountTarget] = useState(null);
  const [quantityTouched, setQuantityTouched] = useState(false);

  useEffect(() => {
    setQuantidade("");
    setLote("");
    setSaving(false);
    setCountTarget(null);
    setQuantityTouched(false);
  }, [activeEmpresa?.id, itemId, ocId]);

  const isQuantidadeValida = isValidCountQuantity(quantidade);
  const quantityError = quantityTouched && !isQuantidadeValida
    ? "Informe uma quantidade inteira maior ou igual a zero."
    : "";
  const isSaveDisabled = saving || !isQuantidadeValida || !lote.trim();

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadCountTarget() {
      if (!canCountOc) {
        return;
      }

      const stateLocationId = location.state?.ocLocalizacaoId;
      if (location.state?.newModel && stateLocationId) {
        setCountTarget({ newModel: true, ocLocalizacaoId: stateLocationId });
        return;
      }

      try {
        const items = await fetchOcItems(ocId);
        if (!isCurrentRequest) {
          return;
        }

        const item = Array.isArray(items)
          ? items.find((candidate) => String(candidate?.id) === String(itemId))
          : null;
        const ocLocalizacaoId = item?.oc_localizacao_id || (item?.new_model ? item?.id : null);

        setCountTarget({
          newModel: Boolean(item?.new_model || item?.oc_localizacao_id),
          ocLocalizacaoId
        });
      } catch (error) {
        if (isCurrentRequest) {
          setCountTarget(null);
        }
      }
    }

    loadCountTarget();

    return () => {
      isCurrentRequest = false;
    };
  }, [
    canCountOc,
    fetchOcItems,
    itemId,
    location.state?.newModel,
    location.state?.ocLocalizacaoId,
    ocId
  ]);

  const handleSalvar = useCallback(async (event) => {
    event?.preventDefault();

    if (!canCountOc || saving) {
      return;
    }

    if (!isQuantidadeValida || !lote.trim()) {
      setQuantityTouched(true);
      showToast(feedbackMessages.count.requiredFields, "info");
      return;
    }

    setSaving(true);

    try {
      const newModelLocationId = countTarget?.ocLocalizacaoId || itemId;
      const countPayload = countTarget?.newModel
        ? {
            oc_id: ocId,
            oc_localizacao_id: newModelLocationId,
            quantidade: Number(quantidade),
            lote
          }
        : {
            oc_id: ocId,
            item_id: itemId,
            quantidade: Number(quantidade),
            lote
          };
      const response = await saveItemCount({
        ...countPayload
      });

      if (response?.id) {
        showToast(feedbackMessages.count.saveSuccess);
        setQuantidade("");
        setLote("");
        setQuantityTouched(false);
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
    countTarget?.newModel,
    countTarget?.ocLocalizacaoId,
    itemId,
    location.state?.from,
    location.state?.selectedProduct,
    navigate,
    ocId,
    quantidade,
    isQuantidadeValida,
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
                type="number"
                className="field-control"
                placeholder="Informe a quantidade"
                value={quantidade}
                min={0}
                step={1}
                inputMode="numeric"
                aria-invalid={Boolean(quantityError)}
                aria-describedby={quantityError ? "quantidade-error" : undefined}
                onBlur={() => setQuantityTouched(true)}
                onChange={(e) => setQuantidade(e.target.value)}
                disabled={saving}
              />
              {quantityError && (
                <p id="quantidade-error" className="counting-field-error">
                  {quantityError}
                </p>
              )}
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
                <button className="primary-button" type="submit" disabled={isSaveDisabled}>
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
