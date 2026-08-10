const { assertOcRepository } = require('./IOcRepository');

function clone(value) {
  return value === null || value === undefined
    ? value
    : JSON.parse(JSON.stringify(value));
}

function createInMemoryOcRepository({
  users = [],
  ocs = [],
  items = [],
  counts = [],
  ocProdutos = [],
  ocLocalizacoes = [],
  ocAssignments = [],
  failOnCreateOcLocalizacao = false,
  failOnUpdateItemCount = false
} = {}) {
  const state = {
    users: users.map(clone),
    ocs: ocs.map(clone),
    items: items.map(clone),
    counts: counts.map(clone),
    ocProdutos: ocProdutos.map(clone),
    ocLocalizacoes: ocLocalizacoes.map(clone),
    ocAssignments: ocAssignments.map(clone),
    nextOcId: ocs.reduce((maxId, oc) => Math.max(maxId, Number(oc.id || 0)), 0) + 1,
    nextItemId: items.reduce((maxId, item) => Math.max(maxId, Number(item.id || 0)), 0) + 1,
    nextCountId: counts.reduce((maxId, count) => Math.max(maxId, Number(count.id || 0)), 0) + 1,
    nextOcProdutoId: ocProdutos.reduce((maxId, item) => Math.max(maxId, Number(item.id || 0)), 0) + 1,
    nextOcLocalizacaoId: ocLocalizacoes.reduce((maxId, item) => Math.max(maxId, Number(item.id || 0)), 0) + 1,
    nextOcAssignmentId: ocAssignments.reduce((maxId, item) => Math.max(maxId, Number(item.id || 0)), 0) + 1
  };

  function createRepository(currentState) {
    const repository = {
      async withTransaction(callback) {
        const snapshot = clone(currentState);
        const tx = createRepository(snapshot);
        const result = await callback(tx);

        currentState.users = snapshot.users;
        currentState.ocs = snapshot.ocs;
        currentState.items = snapshot.items;
        currentState.counts = snapshot.counts;
        currentState.ocProdutos = snapshot.ocProdutos;
        currentState.ocLocalizacoes = snapshot.ocLocalizacoes;
        currentState.ocAssignments = snapshot.ocAssignments;
        currentState.nextOcId = snapshot.nextOcId;
        currentState.nextItemId = snapshot.nextItemId;
        currentState.nextCountId = snapshot.nextCountId;
        currentState.nextOcProdutoId = snapshot.nextOcProdutoId;
        currentState.nextOcLocalizacaoId = snapshot.nextOcLocalizacaoId;
        currentState.nextOcAssignmentId = snapshot.nextOcAssignmentId;

        return result;
      },

      async getNextIdentity() {
        const nextId = currentState.nextOcId++;

        return {
          nextId,
          codigo: `OC-${String(nextId).padStart(5, '0')}`
        };
      },

      async findOcById(ocId) {
        return clone(currentState.ocs.find((oc) => Number(oc.id) === Number(ocId)) || null);
      },

      async findUserById(userId) {
        const user = currentState.users.find((item) => Number(item.id) === Number(userId));

        if (!user) {
          return null;
        }

        return clone({
          id: user.id,
          nome: user.nome,
          role: user.role,
          nivel_estoquista: user.nivel_estoquista ?? null,
          ativo: user.ativo !== false
        });
      },

      async userHasEmpresaAccess(userId, empresaId) {
        const user = currentState.users.find((item) => Number(item.id) === Number(userId));

        if (!user) {
          return false;
        }

        if (!Array.isArray(user.empresas)) {
          return true;
        }

        return user.empresas.some((empresa) => Number(empresa.id) === Number(empresaId));
      },

      async createOc({ id, codigo, gestorId, estoquistaId, empresaId, status }) {
        const oc = {
          id,
          codigo,
          gestor_id: Number(gestorId),
          estoquista_id: Number(estoquistaId),
          empresa_id: Number(empresaId),
          status
        };
        currentState.ocs.push(oc);
        return clone(oc);
      },

      async createOcProduto({
        ocId,
        produtoExternoId,
        codigo,
        codigoBarras,
        descricaoSnapshot,
        saldoSistemaSnapshot,
        status
      }) {
        const hasDuplicate = currentState.ocProdutos.some((produto) => {
          if (Number(produto.oc_id) !== Number(ocId)) {
            return false;
          }

          if (produtoExternoId) {
            return produto.produto_externo_id === produtoExternoId;
          }

          return codigo && produto.codigo === codigo && !produto.produto_externo_id;
        });

        if (hasDuplicate) {
          const err = new Error('duplicate oc produto');
          err.code = '23505';
          err.constraint = produtoExternoId
            ? 'idx_oc_produtos_oc_id_produto_externo_id_unique'
            : 'idx_oc_produtos_oc_id_codigo_unique';
          throw err;
        }

        const produto = {
          id: currentState.nextOcProdutoId++,
          oc_id: Number(ocId),
          produto_externo_id: produtoExternoId || null,
          codigo: codigo || null,
          codigo_barras: codigoBarras || null,
          descricao_snapshot: descricaoSnapshot,
          saldo_sistema_snapshot: saldoSistemaSnapshot,
          status
        };
        currentState.ocProdutos.push(produto);
        return clone(produto);
      },

      async createOcLocalizacao({
        ocProdutoId,
        localizacaoExternaId,
        enderecoSnapshot,
        codigoBarrasSnapshot,
        validadeSnapshot,
        status
      }) {
        if (failOnCreateOcLocalizacao) {
          throw new Error('location failed');
        }

        const hasDuplicate = currentState.ocLocalizacoes.some((localizacao) => {
          if (Number(localizacao.oc_produto_id) !== Number(ocProdutoId)) {
            return false;
          }

          if (localizacaoExternaId) {
            return localizacao.localizacao_externa_id === localizacaoExternaId;
          }

          return localizacao.endereco_snapshot === enderecoSnapshot && !localizacao.localizacao_externa_id;
        });

        if (hasDuplicate) {
          const err = new Error('duplicate oc localizacao');
          err.code = '23505';
          err.constraint = localizacaoExternaId
            ? 'idx_oc_localizacoes_produto_localizacao_externa_unique'
            : 'idx_oc_localizacoes_produto_endereco_unique';
          throw err;
        }

        const localizacao = {
          id: currentState.nextOcLocalizacaoId++,
          oc_produto_id: Number(ocProdutoId),
          localizacao_externa_id: localizacaoExternaId || null,
          endereco_snapshot: enderecoSnapshot,
          codigo_barras_snapshot: codigoBarrasSnapshot || null,
          validade_snapshot: validadeSnapshot || null,
          status
        };
        currentState.ocLocalizacoes.push(localizacao);
        return clone(localizacao);
      },

      async createOcAssignment({ ocId, ciclo, fase, estoquistaId, status }) {
        const assignment = {
          id: currentState.nextOcAssignmentId++,
          oc_id: Number(ocId),
          ciclo,
          fase,
          estoquista_id: Number(estoquistaId),
          status
        };
        currentState.ocAssignments.push(assignment);
        return clone(assignment);
      },

      async createItem({ ocId, produto, saldoSistema, endereco, codigo, codigoBarras, validade, status }) {
        currentState.items.push({
          id: currentState.nextItemId++,
          oc_id: Number(ocId),
          produto,
          saldo_sistema: saldoSistema,
          endereco: endereco || null,
          codigo: codigo || null,
          codigo_barras: codigoBarras || null,
          validade: validade || null,
          saldo_contado: null,
          lote: null,
          diferenca: null,
          status
        });
      },

      async listByGestor({ gestorId, empresaId }) {
        return currentState.ocs
          .filter((oc) => Number(oc.gestor_id) === Number(gestorId))
          .filter((oc) => Number(oc.empresa_id) === Number(empresaId))
          .map((oc) => {
            const ocItems = currentState.items.filter((item) => Number(item.oc_id) === Number(oc.id));
            const products = currentState.ocProdutos.filter((item) => Number(item.oc_id) === Number(oc.id));
            const estoquista = currentState.users.find((user) => Number(user.id) === Number(oc.estoquista_id));
            return {
              ...clone(oc),
              qtd: products.length > 0 ? products.length : ocItems.length,
              estoquista_nome: estoquista?.nome || null,
              ultima_contagem_em: null
            };
          })
          .sort((a, b) => Number(b.id) - Number(a.id));
      },

      async listByEstoquista({ estoquistaId, empresaId, itemStatus, ocStatus }) {
        return currentState.ocs
          .filter((oc) => {
            const assignment = currentState.ocAssignments.find(
              (item) =>
                Number(item.oc_id) === Number(oc.id) &&
                item.fase === 'contagem' &&
                Number(item.ciclo) === 1 &&
                item.status === 'ativo'
            );
            return Number(assignment?.estoquista_id || oc.estoquista_id) === Number(estoquistaId);
          })
          .filter((oc) => Number(oc.empresa_id) === Number(empresaId))
          .filter((oc) => ![ocStatus.waitingApproval, ocStatus.finalized].includes(oc.status || ocStatus.open))
          .map((oc) => {
            const ocItems = currentState.items.filter((item) => Number(item.oc_id) === Number(oc.id));
            const productIds = currentState.ocProdutos
              .filter((produto) => Number(produto.oc_id) === Number(oc.id))
              .map((produto) => Number(produto.id));
            const locations = currentState.ocLocalizacoes.filter((localizacao) =>
              productIds.includes(Number(localizacao.oc_produto_id))
            );

            if (locations.length > 0) {
              return {
                ...clone(oc),
                qtd: locations.length,
                qtd_contados: locations.filter((localizacao) => localizacao.status === itemStatus.counted).length
              };
            }

            return {
              ...clone(oc),
              qtd: ocItems.filter((item) => item.status !== itemStatus.approved).length,
              qtd_contados: ocItems.filter((item) => item.status === itemStatus.counted).length
            };
          })
          .sort((a, b) => Number(b.id) - Number(a.id));
      },

      async listApprovalForAdmin({ empresaId, openStatus, waitingApprovalStatus }) {
        return listApproval({
          currentState,
          empresaId,
          openStatus,
          waitingApprovalStatus
        });
      },

      async listApprovalForGestor({ gestorId, empresaId, openStatus, waitingApprovalStatus }) {
        return listApproval({
          currentState,
          gestorId,
          empresaId,
          openStatus,
          waitingApprovalStatus
        });
      },

      async approveItems({ ocId, approvedStatus, countedStatus }) {
        currentState.items
          .filter((item) => Number(item.oc_id) === Number(ocId))
          .filter((item) => [approvedStatus, countedStatus].includes(item.status))
          .forEach((item) => {
            item.status = approvedStatus;
          });
      },

      async updateOcStatus({ ocId, status }) {
        const oc = currentState.ocs.find((item) => Number(item.id) === Number(ocId));

        if (!oc) {
          return null;
        }

        oc.status = status;
        return clone(oc);
      },

      async updateOcAssignmentAndStatus({ ocId, status, estoquistaId }) {
        const oc = currentState.ocs.find((item) => Number(item.id) === Number(ocId));

        if (!oc) {
          return null;
        }

        oc.status = status;
        oc.estoquista_id = Number(estoquistaId);
        return clone(oc);
      },

      async findItemsByIdsForUpdate(itemIds) {
        return clone(currentState.items.filter((item) => itemIds.map(Number).includes(Number(item.id))));
      },

      async markItemsForRecount({ ocId, itemIds, recountStatus }) {
        currentState.items
          .filter((item) => Number(item.oc_id) === Number(ocId))
          .filter((item) => itemIds.map(Number).includes(Number(item.id)))
          .forEach((item) => {
            item.status = recountStatus;
            item.saldo_contado = null;
            item.lote = null;
            item.diferenca = null;
          });
      },

      async approveItemsExcept({ ocId, itemIds, approvedStatus, countedStatus }) {
        currentState.items
          .filter((item) => Number(item.oc_id) === Number(ocId))
          .filter((item) => !itemIds.map(Number).includes(Number(item.id)))
          .filter((item) => [approvedStatus, countedStatus].includes(item.status))
          .forEach((item) => {
            item.status = approvedStatus;
          });
      },

      async listItems(ocId) {
        return clone(
          currentState.items
            .filter((item) => Number(item.oc_id) === Number(ocId))
            .sort((a, b) => Number(a.id) - Number(b.id))
        );
      },

      async findItemById(itemId) {
        return clone(currentState.items.find((item) => Number(item.id) === Number(itemId)) || null);
      },

      async ocHasNewModel(ocId) {
        return currentState.ocProdutos.some((produto) => Number(produto.oc_id) === Number(ocId));
      },

      async listOperationalProducts({ ocId, assignmentId }) {
        const hasAssignment = currentState.ocAssignments.some(
          (assignment) => Number(assignment.id) === Number(assignmentId) && Number(assignment.oc_id) === Number(ocId)
        );

        if (!hasAssignment) {
          return [];
        }

        return clone(
          currentState.ocProdutos
            .filter((produto) => Number(produto.oc_id) === Number(ocId))
            .map((produto) => {
              const locations = currentState.ocLocalizacoes
                .filter((localizacao) => Number(localizacao.oc_produto_id) === Number(produto.id));

              return {
                id: produto.id,
                descricao: produto.descricao_snapshot,
                status: produto.status,
                total_localizacoes: locations.length,
                localizacoes_contadas: locations.filter((location) => location.status === 'contado').length
              };
            })
            .sort((a, b) => Number(a.id) - Number(b.id))
        );
      },

      async listOperationalLocationsByProduct({ ocProdutoId, assignmentId }) {
        const produto = currentState.ocProdutos.find((item) => Number(item.id) === Number(ocProdutoId));
        const hasAssignment = currentState.ocAssignments.some(
          (assignment) => Number(assignment.id) === Number(assignmentId) && Number(assignment.oc_id) === Number(produto?.oc_id)
        );

        if (!produto || !hasAssignment) {
          return [];
        }

        return clone(
          currentState.ocLocalizacoes
            .filter((localizacao) => Number(localizacao.oc_produto_id) === Number(ocProdutoId))
            .map((localizacao) => {
              const count = currentState.counts.find(
                (item) =>
                  Number(item.assignment_id) === Number(assignmentId) &&
                  Number(item.oc_localizacao_id) === Number(localizacao.id)
              );

              return {
                id: localizacao.id,
                oc_produto_id: localizacao.oc_produto_id,
                endereco: localizacao.endereco_snapshot,
                status: localizacao.status,
                quantidade: count?.quantidade ?? null,
                lote: count?.lote ?? null
              };
            })
            .sort((a, b) => Number(a.id) - Number(b.id))
        );
      },

      async findLocalizacaoContextById(ocLocalizacaoId) {
        const localizacao = currentState.ocLocalizacoes.find(
          (item) => Number(item.id) === Number(ocLocalizacaoId)
        );
        const produto = currentState.ocProdutos.find(
          (item) => Number(item.id) === Number(localizacao?.oc_produto_id)
        );
        const oc = currentState.ocs.find((item) => Number(item.id) === Number(produto?.oc_id));

        if (!localizacao || !produto || !oc) {
          return null;
        }

        return clone({
          id: localizacao.id,
          oc_produto_id: localizacao.oc_produto_id,
          endereco_snapshot: localizacao.endereco_snapshot,
          status: localizacao.status,
          oc_id: produto.oc_id,
          codigo: produto.codigo,
          descricao_snapshot: produto.descricao_snapshot,
          gestor_id: oc.gestor_id,
          estoquista_id: oc.estoquista_id,
          empresa_id: oc.empresa_id,
          oc_status: oc.status
        });
      },

      async findActiveFirstCountAssignment({ ocId, estoquistaId }) {
        return clone(
          currentState.ocAssignments.find(
            (assignment) =>
              Number(assignment.oc_id) === Number(ocId) &&
              Number(assignment.estoquista_id) === Number(estoquistaId) &&
              assignment.fase === 'contagem' &&
              Number(assignment.ciclo) === 1 &&
              assignment.status === 'ativo'
          ) || null
        );
      },

      async findCountByAssignmentAndLocation({ assignmentId, ocLocalizacaoId }) {
        return clone(
          currentState.counts.find(
            (count) =>
              Number(count.assignment_id) === Number(assignmentId) &&
              Number(count.oc_localizacao_id) === Number(ocLocalizacaoId)
          ) || null
        );
      },

      async findLegacyItemForLocalizacao({ ocId, codigo, descricao, endereco }) {
        const matches = currentState.items.filter((item) => {
          if (Number(item.oc_id) !== Number(ocId) || item.endereco !== endereco) {
            return false;
          }

          return codigo ? item.codigo === codigo : item.produto === descricao;
        });

        return clone(matches.length === 1 ? matches[0] : null);
      },

      async createNewModelCount({
        ocId,
        ocProdutoId,
        ocLocalizacaoId,
        assignmentId,
        legacyItemId,
        quantidade,
        lote,
        userId
      }) {
        const duplicated = currentState.counts.some(
          (count) =>
            Number(count.assignment_id) === Number(assignmentId) &&
            Number(count.oc_localizacao_id) === Number(ocLocalizacaoId)
        );

        if (duplicated) {
          const err = new Error('duplicate assignment location count');
          err.code = '23505';
          err.constraint = 'idx_contagens_assignment_localizacao_unique';
          throw err;
        }

        const count = {
          id: currentState.nextCountId++,
          oc_id: Number(ocId),
          item_id: legacyItemId ? Number(legacyItemId) : null,
          oc_produto_id: Number(ocProdutoId),
          oc_localizacao_id: Number(ocLocalizacaoId),
          assignment_id: Number(assignmentId),
          quantidade,
          lote,
          user_id: Number(userId)
        };
        currentState.counts.push(count);
        return clone(count);
      },

      async updateLocalizacaoStatus({ ocLocalizacaoId, status }) {
        const localizacao = currentState.ocLocalizacoes.find(
          (item) => Number(item.id) === Number(ocLocalizacaoId)
        );

        if (localizacao) {
          localizacao.status = status;
        }
      },

      async updateProdutoStatusFromLocalizacoes({ ocProdutoId, pendingStatus, countedStatus }) {
        const produto = currentState.ocProdutos.find((item) => Number(item.id) === Number(ocProdutoId));

        if (!produto) {
          return null;
        }

        const locations = currentState.ocLocalizacoes.filter(
          (localizacao) => Number(localizacao.oc_produto_id) === Number(ocProdutoId)
        );
        produto.status = locations.some((localizacao) => localizacao.status === pendingStatus)
          ? pendingStatus
          : countedStatus;

        return clone(produto);
      },

      async getNewModelFinalizeValidation({ ocId, assignmentId }) {
        const ocExists = currentState.ocs.some((oc) => Number(oc.id) === Number(ocId));
        const hasAssignment = currentState.ocAssignments.some(
          (assignment) => Number(assignment.id) === Number(assignmentId) && Number(assignment.oc_id) === Number(ocId)
        );
        const productIds = currentState.ocProdutos
          .filter((produto) => Number(produto.oc_id) === Number(ocId))
          .map((produto) => Number(produto.id));
        const locations = hasAssignment
          ? currentState.ocLocalizacoes.filter((localizacao) =>
              productIds.includes(Number(localizacao.oc_produto_id))
            )
          : [];

        return {
          oc_existe: ocExists,
          qtd_ativos: locations.length,
          qtd_contados: locations.filter((localizacao) => localizacao.status === 'contado').length
        };
      },

      async finalizeAssignment({ assignmentId }) {
        const assignment = currentState.ocAssignments.find((item) => Number(item.id) === Number(assignmentId));

        if (!assignment) {
          return null;
        }

        assignment.status = 'finalizado';
        assignment.finalizado_em = new Date().toISOString();
        return clone(assignment);
      },

      async createCount({ ocId, itemId, quantidade, lote, userId }) {
        const count = {
          id: currentState.nextCountId++,
          oc_id: Number(ocId),
          item_id: Number(itemId),
          quantidade,
          lote,
          user_id: Number(userId)
        };
        currentState.counts.push(count);
        return clone(count);
      },

      async updateItemCount({ ocId, itemId, quantidade, lote, countedStatus }) {
        if (failOnUpdateItemCount) {
          throw new Error('item count update failed');
        }

        const item = currentState.items.find(
          (candidate) => Number(candidate.id) === Number(itemId) && Number(candidate.oc_id) === Number(ocId)
        );

        if (!item) {
          return;
        }

        item.saldo_contado = quantidade;
        item.lote = lote;
        item.diferenca = quantidade - item.saldo_sistema;
        item.status = countedStatus;
      },

      async getFinalizeValidation({ ocId, approvedStatus, countedStatus }) {
        const ocExists = currentState.ocs.some((oc) => Number(oc.id) === Number(ocId));
        const ocItems = currentState.items.filter((item) => Number(item.oc_id) === Number(ocId));
        const activeItems = ocItems.filter((item) => item.status !== approvedStatus);
        const countedItems = ocItems.filter((item) => item.status === countedStatus);

        return {
          oc_existe: ocExists,
          qtd_ativos: activeItems.length,
          qtd_contados: countedItems.length
        };
      },

      __getState() {
        return clone(currentState);
      }
    };

    assertOcRepository(repository);
    return repository;
  }

  return createRepository(state);
}

function listApproval({ currentState, gestorId, empresaId, openStatus, waitingApprovalStatus }) {
  return currentState.ocs
    .filter((oc) => (oc.status || openStatus) === waitingApprovalStatus)
    .filter((oc) => gestorId === undefined || Number(oc.gestor_id) === Number(gestorId))
    .filter((oc) => Number(oc.empresa_id) === Number(empresaId))
    .map((oc) => {
      const gestor = currentState.users.find((user) => Number(user.id) === Number(oc.gestor_id));
      const estoquista = currentState.users.find((user) => Number(user.id) === Number(oc.estoquista_id));
      const ocItems = currentState.items.filter((item) => Number(item.oc_id) === Number(oc.id));
      const products = currentState.ocProdutos.filter((item) => Number(item.oc_id) === Number(oc.id));

      return {
        ...clone(oc),
        qtd: products.length > 0 ? products.length : ocItems.length,
        gestor_nome: gestor?.nome || null,
        estoquista_nome: estoquista?.nome || null
      };
    })
    .sort((a, b) => Number(b.id) - Number(a.id));
}

module.exports = createInMemoryOcRepository;
module.exports.createInMemoryOcRepository = createInMemoryOcRepository;
