import { memo } from "react";

function getEmpresaNome(oc) {
  return oc?.empresa_nome || oc?.empresa?.nome || "";
}

function OcEmpresaBadge({ oc, className = "" }) {
  const empresaNome = getEmpresaNome(oc);
  const classes = ["empresa-badge", className].filter(Boolean).join(" ");

  return (
    <span className={classes}>
      {empresaNome || "Empresa não definida"}
    </span>
  );
}

export default memo(OcEmpresaBadge);
