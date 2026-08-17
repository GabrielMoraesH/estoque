import Panel from "../ui/Panel";
import { formatDateTime, formatSignedNumber } from "../../utils/formatters";
import { asArray } from "../../utils/ocData";

const safeText = (value, fallback = "Não informado") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};
const quantity = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const historyDate = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Não informado";
  return formatDateTime(value);
};

function OcHistoryTrace({ history }) {
  const products = asArray(history?.produtos);
  const cycles = asArray(history?.ciclos);

  return (
    <div className="history-stack">
      {cycles.length > 0 && (
        <Panel title="Histórico operacional" subtitle="Cada ciclo mostra somente os produtos atribuídos naquele momento.">
          <div className="history-cycle-list">
            {cycles.map((cycle) => {
              const productIds = new Set(asArray(cycle.produto_ids).map(Number));
              const participants = products.filter((product) => productIds.has(Number(product.oc_produto_id)));
              return (
                <article className="history-cycle" key={cycle.id}>
                  <h3>Ciclo {cycle.ciclo} — {cycle.fase === "recontagem" ? "Recontagem" : "Contagem"}</h3>
                  <p><strong>Responsável:</strong> {safeText(cycle.responsavel_nome)}</p>
                  <p><strong>Estado:</strong> {cycle.status === "finalizado" ? "Finalizado" : "Ativo"}</p>
                  <p><strong>Iniciado:</strong> {historyDate(cycle.created_at)}</p>
                  <p><strong>Finalizado:</strong> {historyDate(cycle.finalizado_em)}</p>
                  <p><strong>Produtos:</strong> {participants.length ? participants.map((p) => `#${p.oc_produto_id} — ${safeText(p.codigo, p.descricao)}`).join(", ") : "Nenhum produto registrado"}</p>
                </article>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel title="Resultado vigente" subtitle="Consolidação por localização usando apenas assignments finalizados.">
        <div className="history-product-list">
          {products.map((product) => {
            const system = quantity(product.saldo_sistema_snapshot ?? product.saldo_sistema);
            const counted = quantity(product.saldo_contado_vigente ?? product.saldo_contado);
            const difference = counted - system;
            return (
              <article className="history-product" key={product.oc_produto_id || `legacy-${product.id}`}>
                <header>
                  <div>
                    <h3>{safeText(product.descricao || product.produto, "Produto sem descrição")}</h3>
                    <p>Código: {safeText(product.codigo, "—")}</p>
                  </div>
                  <span className="history-divergence">{difference === 0 ? "Sem divergência" : "Com divergência"}</span>
                </header>
                <dl className="history-balances">
                  <div><dt>Saldo sistema</dt><dd>{system}</dd></div>
                  <div><dt>Saldo contado vigente</dt><dd>{counted}</dd></div>
                  <div><dt>Diferença</dt><dd>{formatSignedNumber(difference)}</dd></div>
                </dl>
                <div className="history-location-list">
                  {asArray(product.localizacoes || product.locations).map((location) => (
                    <section className="history-location" key={location.id}>
                      <h4>Localização {safeText(location.endereco, `#${location.id}`)}</h4>
                      <p><strong>Código de barras:</strong> {safeText(location.codigo_barras_snapshot, "—")}</p>
                      <p><strong>Validade:</strong> {safeText(location.validade_snapshot, "—")}</p>
                      <p><strong>Vigente:</strong> {location.saldo_contado ?? "Sem resultado"} · Lote {safeText(location.lote, "—")}</p>
                      <h5>Histórico de contagens</h5>
                      <ol className="history-events">
                        {asArray(location.contagens).map((count) => (
                          <li key={count.id}>
                            <strong>{count.ciclo ? `Ciclo ${count.ciclo} — ${count.fase === "recontagem" ? "Recontagem" : "Contagem"}` : "Registro legado"}</strong>
                            <span>{safeText(count.usuario_nome)} · Quantidade {quantity(count.quantidade)} · Lote {safeText(count.lote, "—")} · {historyDate(count.created_at)}{count.assignment_status ? ` · Assignment ${count.assignment_status}` : ""}</span>
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

export default OcHistoryTrace;
