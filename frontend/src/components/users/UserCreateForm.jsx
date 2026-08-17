import { memo, useCallback, useMemo } from "react";
import Panel from "../ui/Panel";

function UserCreateForm({ form, empresas = [], empresasLoading = false, creating, onChange, onSubmit }) {
  const selectedEmpresaIds = useMemo(
    () => (Array.isArray(form.empresa_ids) ? form.empresa_ids : []),
    [form.empresa_ids]
  );
  const isSubmitDisabled = creating || empresasLoading || !form.nome.trim() || !form.login.trim() || !form.senha;
  const showLevelSelect = form.role === "estoquista";

  const handleNomeChange = useCallback(
    (e) => onChange("nome", e.target.value),
    [onChange]
  );
  const handleLoginChange = useCallback(
    (e) => onChange("login", e.target.value),
    [onChange]
  );
  const handleSenhaChange = useCallback(
    (e) => onChange("senha", e.target.value),
    [onChange]
  );
  const handleRoleChange = useCallback(
    (e) => onChange("role", e.target.value),
    [onChange]
  );
  const handleNivelEstoquistaChange = useCallback(
    (e) => onChange("nivel_estoquista", Number(e.target.value)),
    [onChange]
  );
  const handleEmpresaToggle = useCallback(
    (empresaId) => {
      const isSelected = selectedEmpresaIds.includes(empresaId);
      const nextEmpresaIds = isSelected
        ? selectedEmpresaIds.filter((selectedId) => selectedId !== empresaId)
        : [...selectedEmpresaIds, empresaId];

      onChange("empresa_ids", nextEmpresaIds);
    },
    [onChange, selectedEmpresaIds]
  );

  return (
    <Panel className="users-card">
      <form className="users-form" onSubmit={onSubmit}>
        <div className="users-field">
          <label htmlFor="nome">Nome *</label>
          <input
            id="nome"
            value={form.nome}
            placeholder="Informe o nome completo"
            onChange={handleNomeChange}
            disabled={creating}
            required
          />
        </div>

        <div className="users-field">
          <label htmlFor="login">Login *</label>
          <input
            id="login"
            value={form.login}
            placeholder="Informe o login"
            onChange={handleLoginChange}
            disabled={creating}
            required
          />
        </div>

        <div className="users-field">
          <label htmlFor="senha">Senha *</label>
          <input
            id="senha"
            type="password"
            value={form.senha}
            placeholder="Informe a senha"
            minLength={6}
            required
            onChange={handleSenhaChange}
            disabled={creating}
          />
        </div>

        <div className={`users-role-level-row${showLevelSelect ? " has-level" : ""}`}>
          <div className="users-field">
            <label htmlFor="role">Perfil</label>
            <select
              id="role"
              value={form.role}
              onChange={handleRoleChange}
              disabled={creating}
            >
              <option value="gestor">Gestor</option>
              <option value="estoquista">Estoquista</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {showLevelSelect && (
            <div className="users-field">
              <label htmlFor="nivel_estoquista">Nível</label>
              <select
                id="nivel_estoquista"
                value={form.nivel_estoquista || 1}
                onChange={handleNivelEstoquistaChange}
                disabled={creating}
              >
                <option value={1}>Nível 1</option>
                <option value={2}>Nível 2</option>
                <option value={3}>Nível 3</option>
              </select>
            </div>
          )}
        </div>

        <fieldset className="users-field users-companies-field">
          <legend>Empresas de acesso *</legend>

          <div className="users-company-options">
            {empresasLoading ? (
              <span className="users-company-empty">Carregando empresas...</span>
            ) : empresas.length === 0 ? (
              <span className="users-company-empty">Nenhuma empresa ativa encontrada.</span>
            ) : (
              empresas.map((empresa) => {
                const empresaId = Number(empresa.id);

                return (
                  <label className="users-company-option" key={empresa.id}>
                    <input
                      type="checkbox"
                      checked={selectedEmpresaIds.includes(empresaId)}
                      onChange={() => handleEmpresaToggle(empresaId)}
                      disabled={creating}
                    />
                    <span>{empresa.nome}</span>
                  </label>
                );
              })
            )}
          </div>
        </fieldset>

        <div className="users-actions">
          <button className="users-button" type="submit" disabled={isSubmitDisabled}>
            {creating ? "Criando..." : "Criar usuário"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

export default memo(UserCreateForm);
