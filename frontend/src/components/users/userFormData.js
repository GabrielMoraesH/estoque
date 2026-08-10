import { asArray } from "../../utils/ocData";

export const INITIAL_USER_FORM = {
  nome: "",
  login: "",
  senha: "",
  role: "gestor",
  nivel_estoquista: null,
  empresa_ids: []
};

export const getUserLevelValue = (user) => {
  const level = Number(user?.nivel_estoquista);
  return [1, 2, 3].includes(level) ? level : null;
};

export const getEditableUser = (user) => ({
  nome: user?.nome || "",
  login: user?.login || "",
  role: user?.role || "gestor",
  nivel_estoquista: user?.role === "estoquista" ? (getUserLevelValue(user) || 1) : null,
  senha: "",
  empresa_ids: asArray(user?.empresas)
    .map((empresa) => Number(empresa?.id))
    .filter((empresaId) => Number.isInteger(empresaId) && empresaId > 0)
});

export const getEditableUsersById = (users) =>
  asArray(users).reduce((acc, user) => {
    if (!user?.id) {
      return acc;
    }

    acc[user.id] = getEditableUser(user);
    return acc;
  }, {});

export const areUserFormsEqual = (nextForm, currentForm) => (
  (nextForm?.nome || "") === (currentForm?.nome || "")
  && (nextForm?.login || "") === (currentForm?.login || "")
  && (nextForm?.role || "gestor") === (currentForm?.role || "gestor")
  && (nextForm?.nivel_estoquista || null) === (currentForm?.nivel_estoquista || null)
  && (nextForm?.senha || "") === (currentForm?.senha || "")
  && areEmpresaIdsEqual(nextForm?.empresa_ids, currentForm?.empresa_ids)
);

function normalizeEmpresaIds(empresaIds) {
  return asArray(empresaIds)
    .map((empresaId) => Number(empresaId))
    .filter((empresaId) => Number.isInteger(empresaId) && empresaId > 0)
    .sort((a, b) => a - b);
}

function areEmpresaIdsEqual(nextEmpresaIds, currentEmpresaIds) {
  const next = normalizeEmpresaIds(nextEmpresaIds);
  const current = normalizeEmpresaIds(currentEmpresaIds);

  return next.length === current.length
    && next.every((empresaId, index) => empresaId === current[index]);
}
