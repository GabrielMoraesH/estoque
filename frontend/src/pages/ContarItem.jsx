import Layout from "../components/Layout";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import "../styles/contar.css";
import "../styles/app-pages.css";
import { useToast } from "../components/ToastProvider";
import BackButton from "../components/BackButton";
import DataState from "../components/ui/DataState";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";
import useEmpresa from "../hooks/useEmpresa";
import usePermissions from "../hooks/usePermissions";
import useOCs from "../hooks/useOCs";
import { feedbackMessages, getFeedbackErrorMessage } from "../utils/feedbackMessages";
import { formatFallbackText, formatLocationName, formatProductName } from "../utils/formatters";

function isValidCountQuantity(value) {
  if (typeof value !== "string" || value.trim() === "" || !/^\d+$/.test(value.trim())) return false;
  const numberValue = Number(value);
  return Number.isSafeInteger(numberValue) && numberValue >= 0;
}

function ContarItem() {
  const { ocId, itemId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { activeEmpresa } = useEmpresa();
  const activeEmpresaIdRef = useRef(activeEmpresa?.id || null);
  activeEmpresaIdRef.current = activeEmpresa?.id || null;
  const { canCountOc } = usePermissions();
  const { fetchOcItems, saveItemCount } = useOCs();
  const [quantidade, setQuantidade] = useState("");
  const [lote, setLote] = useState("");
  const [saving, setSaving] = useState(false);
  const [countTarget, setCountTarget] = useState(null);
  const [loadingTarget, setLoadingTarget] = useState(true);
  const [targetError, setTargetError] = useState("");
  const [quantityTouched, setQuantityTouched] = useState(false);
  const [lotTouched, setLotTouched] = useState(false);

  useEffect(() => {
    setQuantidade(""); setLote(""); setSaving(false); setCountTarget(null);
    setQuantityTouched(false); setLotTouched(false);
  }, [activeEmpresa?.id, itemId, ocId]);

  useEffect(() => {
    let current = true;
    async function loadCountTarget() {
      if (!canCountOc) return;
      setLoadingTarget(true); setTargetError("");
      try {
        const items = await fetchOcItems(ocId);
        if (!current) return;
        const item = Array.isArray(items)
          ? items.find((candidate) => String(candidate?.oc_localizacao_id || candidate?.id) === String(itemId))
          : null;
        if (!item) throw new Error("A localização não está disponível neste assignment.");
        setCountTarget({
          ...item,
          newModel: Boolean(item?.new_model || item?.oc_localizacao_id),
          ocLocalizacaoId: item?.oc_localizacao_id || (item?.new_model ? item?.id : null)
        });
      } catch (error) {
        if (current) setTargetError(getFeedbackErrorMessage(error, "Não foi possível carregar a localização para contagem."));
      } finally {
        if (current) setLoadingTarget(false);
      }
    }
    loadCountTarget();
    return () => { current = false; };
  }, [activeEmpresa?.id, canCountOc, fetchOcItems, itemId, ocId]);

  const isQuantidadeValida = isValidCountQuantity(quantidade);
  const quantityError = quantityTouched && !isQuantidadeValida ? "Informe uma quantidade inteira maior ou igual a zero." : "";
  const lotError = lotTouched && !lote.trim() ? "Informe o lote." : "";
  const isAlreadyCounted = countTarget?.status === "contado";
  const isSaveDisabled = saving || loadingTarget || isAlreadyCounted || !isQuantidadeValida || !lote.trim();

  const handleSalvar = useCallback(async (event) => {
    event?.preventDefault();
    if (!canCountOc || saving || loadingTarget || isAlreadyCounted) return;
    if (!isQuantidadeValida || !lote.trim()) {
      setQuantityTouched(true); setLotTouched(true);
      showToast(feedbackMessages.count.requiredFields, "info"); return;
    }
    setSaving(true);
    const empresaIdAtStart = activeEmpresaIdRef.current;
    try {
      const countPayload = countTarget?.newModel
        ? { oc_id: ocId, oc_localizacao_id: countTarget.ocLocalizacaoId, quantidade: Number(quantidade), lote: lote.trim() }
        : { oc_id: ocId, item_id: itemId, quantidade: Number(quantidade), lote: lote.trim() };
      const response = await saveItemCount(countPayload);
      if (empresaIdAtStart !== activeEmpresaIdRef.current) return;
      if (!response?.id) throw new Error(feedbackMessages.count.saveError);
      showToast(feedbackMessages.count.saveSuccess);
      navigate(`/oc/${ocId}`, { replace: true, state: { from: location.state?.from || "/minhas-ocs", selectedProduct: countTarget?.produto } });
    } catch (error) {
      if (empresaIdAtStart !== activeEmpresaIdRef.current) return;
      showToast(getFeedbackErrorMessage(error, feedbackMessages.count.saveError), "error");
    } finally {
      if (empresaIdAtStart === activeEmpresaIdRef.current) setSaving(false);
    }
  }, [canCountOc, countTarget, isAlreadyCounted, isQuantidadeValida, itemId, loadingTarget, location.state?.from, lote, navigate, ocId, quantidade, saveItemCount, saving, showToast]);

  if (!canCountOc) return <Navigate to="/dashboard" replace />;

  return (
    <Layout><div className="page-shell stack-lg">
      <BackButton to={`/oc/${ocId}`} fallbackTo="/minhas-ocs" state={{ from: location.state?.from || "/minhas-ocs", selectedProduct: countTarget?.produto }} />
      <PageHeader title="Registrar contagem" subtitle="Informe a quantidade e o lote da localização selecionada." />
      <DataState loading={loadingTarget} error={targetError} loadingTitle="Carregando localização" loadingMessage="Validando os dados da OC e do assignment." errorTitle="Localização indisponível">
        <Panel className="counting-card">
          <div className="counting-meta">
            <span className="counting-badge">OC {ocId}</span>
            <span className="counting-badge">{formatProductName(countTarget?.produto)}</span>
            <span className="counting-badge">Localização: {formatLocationName(countTarget?.location?.endereco || countTarget?.endereco)}</span>
          </div>
          {(countTarget?.codigo_barras_snapshot || countTarget?.validade_snapshot) && <div className="counting-snapshot">
            {countTarget?.codigo_barras_snapshot && <p>Código de barras: {formatFallbackText(countTarget.codigo_barras_snapshot, "Não informado")}</p>}
            {countTarget?.validade_snapshot && <p>Validade: {formatFallbackText(countTarget.validade_snapshot, "Não informada")}</p>}
          </div>}
          {isAlreadyCounted ? <div className="counting-complete" role="status"><strong>Localização já contada</strong><p>Esta localização não aceita uma segunda contagem neste assignment.</p></div> :
          <form className="counting-form" onSubmit={handleSalvar}>
            <div className="field-group"><label htmlFor="quantidade">Quantidade</label><input id="quantidade" type="number" className="field-control" placeholder="Informe a quantidade" value={quantidade} min={0} step={1} inputMode="numeric" aria-invalid={Boolean(quantityError)} aria-describedby={quantityError ? "quantidade-error" : undefined} onBlur={() => setQuantityTouched(true)} onChange={(e) => setQuantidade(e.target.value)} disabled={saving} />{quantityError && <p id="quantidade-error" className="counting-field-error">{quantityError}</p>}</div>
            <div className="field-group"><label htmlFor="lote">Lote</label><input id="lote" type="text" className="field-control" placeholder="Informe o lote" value={lote} aria-invalid={Boolean(lotError)} aria-describedby={lotError ? "lote-error" : undefined} onBlur={() => setLotTouched(true)} onChange={(e) => setLote(e.target.value)} disabled={saving} />{lotError && <p id="lote-error" className="counting-field-error">{lotError}</p>}</div>
            <div className="counting-actions"><button className="primary-button" type="submit" disabled={isSaveDisabled}>{saving ? "Salvando contagem..." : "Salvar contagem"}</button></div>
          </form>}
        </Panel>
      </DataState>
    </div></Layout>
  );
}

export default ContarItem;
