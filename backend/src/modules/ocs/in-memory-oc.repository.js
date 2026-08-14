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
  ocAssignmentProdutos = [],
  failOnCreateOcLocalizacao = false,
  failOnCreateOcAssignmentProdutos = false,
  failOnUpdateLocalizacaoStatus = false,
  failOnUpdateProdutoStatusFromLocalizacoes = false,
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
    ocAssignmentProdutos: ocAssignmentProdutos.map(clone),
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
        currentState.ocAssignmentProdutos = snapshot.ocAssignmentProdutos;
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
        const duplicated = currentState.ocAssignments.some(
          (assignment) => Number(assignment.oc_id) === Number(ocId) && Number(assignment.ciclo) === Number(ciclo)
        );

        if (duplicated) {
          const err = new Error('duplicate assignment cycle');
          err.code = '23505';
          err.constraint = 'oc_assignments_oc_id_ciclo_unique';
          throw err;
        }

        const duplicatedActive = status === 'ativo' && currentState.ocAssignments.some(
          (assignment) => Number(assignment.oc_id) === Number(ocId) && assignment.status === 'ativo'
        );

        if (duplicatedActive) {
          const err = new Error('duplicate active assignment');
          err.code = '23505';
          err.constraint = 'idx_oc_assignments_active_unique';
          throw err;
        }

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

      async createOcAssignmentProdutos({ assignmentId, ocId, ocProdutoIds }) {
        if (failOnCreateOcAssignmentProdutos) {
          throw new Error('assignment products failed');
        }

        const rows = [];

        for (const ocProdutoId of ocProdutoIds || []) {
          const duplicated = currentState.ocAssignmentProdutos.some(
            (item) =>
              Number(item.assignment_id) === Number(assignmentId) &&
              Number(item.oc_produto_id) === Number(ocProdutoId)
          );

          if (duplicated) {
            continue;
          }

          const assignment = currentState.ocAssignments.find(
            (item) => Number(item.id) === Number(assignmentId) && Number(item.oc_id) === Number(ocId)
          );
          const produto = currentState.ocProdutos.find(
            (item) => Number(item.id) === Number(ocProdutoId) && Number(item.oc_id) === Number(ocId)
          );

          if (!assignment || !produto) {
            const err = new Error('invalid assignment product');
            err.code = '23503';
            throw err;
          }

          const row = {
            assignment_id: Number(assignmentId),
            oc_id: Number(ocId),
            oc_produto_id: Number(ocProdutoId),
            created_at: new Date().toISOString()
          };
          currentState.ocAssignmentProdutos.push(row);
          rows.push(row);
        }

        return clone(rows);
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

      async listByGestor({ empresaId }) {
        return currentState.ocs
          .filter((oc) => Number(oc.empresa_id) === Number(empresaId))
          .map((oc) => {
            const ocItems = currentState.items.filter((item) => Number(item.oc_id) === Number(oc.id));
            const products = currentState.ocProdutos.filter((item) => Number(item.oc_id) === Number(oc.id));
            const latestAssignment = currentState.ocAssignments
              .filter((assignment) => Number(assignment.oc_id) === Number(oc.id))
              .sort((a, b) => Number(b.ciclo) - Number(a.ciclo) || Number(b.id) - Number(a.id))[0] || null;
            const firstAssignment = currentState.ocAssignments
              .filter((assignment) =>
                Number(assignment.oc_id) === Number(oc.id) &&
                Number(assignment.ciclo) === 1 &&
                assignment.fase === 'contagem'
              )
              .sort((a, b) => Number(a.id) - Number(b.id))[0] || null;
            const movementDates = [
              oc.created_at,
              oc.updated_at,
              ...currentState.counts
                .filter((count) => Number(count.oc_id) === Number(oc.id))
                .map((count) => count.created_at),
              ...currentState.ocAssignments
                .filter((assignment) => Number(assignment.oc_id) === Number(oc.id))
                .flatMap((assignment) => [assignment.created_at, assignment.finalizado_em])
            ]
              .filter(Boolean)
              .sort((a, b) => new Date(a) - new Date(b));
            const estoquista = currentState.users.find(
              (user) => Number(user.id) === Number(latestAssignment?.estoquista_id || oc.estoquista_id)
            );
            const criador = currentState.users.find(
              (user) => Number(user.id) === Number(oc.gestor_id)
            );
            const assignedProductIds = latestAssignment
              ? currentState.ocAssignmentProdutos
                .filter((item) => Number(item.assignment_id) === Number(latestAssignment.id))
                .map((item) => Number(item.oc_produto_id))
              : [];
            const assignmentLocations = currentState.ocLocalizacoes.filter((location) =>
              assignedProductIds.includes(Number(location.oc_produto_id))
            );
            const countedLocationIds = new Set(currentState.counts
              .filter((count) => Number(count.assignment_id) === Number(latestAssignment?.id))
              .map((count) => Number(count.oc_localizacao_id)));
            return {
              ...clone(oc),
              qtd: products.length > 0 ? products.length : ocItems.length,
              estoquista_nome: estoquista?.nome || null,
              criador_nome: criador?.nome || null,
              assignment_id: latestAssignment?.id || null,
              assignment_ciclo: latestAssignment?.ciclo || null,
              assignment_fase: latestAssignment?.fase || null,
              assignment_status: latestAssignment?.status || null,
              responsavel_atual_id: latestAssignment?.estoquista_id || oc.estoquista_id,
              primeira_contagem_estoquista_id: firstAssignment?.estoquista_id || null,
              total_localizacoes: products.length > 0 ? assignmentLocations.length : ocItems.length,
              localizacoes_contadas: products.length > 0
                ? assignmentLocations.filter((location) => countedLocationIds.has(Number(location.id))).length
                : ocItems.filter((item) => ['contado', 'aprovado'].includes(item.status)).length,
              has_legacy_recount: products.length === 0 && ocItems.some((item) => item.status === 'recontar'),
              ultima_movimentacao_em: movementDates.at(-1) || null
            };
          })
          .sort((a, b) => {
            const dateDiff = new Date(b.ultima_movimentacao_em || 0) - new Date(a.ultima_movimentacao_em || 0);
            return dateDiff || Number(b.id) - Number(a.id);
          });
      },

      async listByEstoquista({ estoquistaId, empresaId, itemStatus, ocStatus }) {
        return currentState.ocs
          .filter((oc) => {
            const assignment = currentState.ocAssignments.find(
              (item) =>
                Number(item.oc_id) === Number(oc.id) &&
                item.status === 'ativo'
            );
            const hasNewModel = currentState.ocProdutos.some((produto) => Number(produto.oc_id) === Number(oc.id));

            if (hasNewModel) {
              return Boolean(assignment) && Number(assignment.estoquista_id) === Number(estoquistaId);
            }

            return Number(oc.estoquista_id) === Number(estoquistaId);
          })
          .filter((oc) => Number(oc.empresa_id) === Number(empresaId))
          .filter((oc) => ![ocStatus.waitingApproval, ocStatus.finalized].includes(oc.status || ocStatus.open))
          .map((oc) => {
            const ocItems = currentState.items.filter((item) => Number(item.oc_id) === Number(oc.id));
            const productIds = currentState.ocProdutos
              .filter((produto) => Number(produto.oc_id) === Number(oc.id))
              .filter((produto) => {
                const assignment = currentState.ocAssignments.find(
                  (item) => Number(item.oc_id) === Number(oc.id) && item.status === 'ativo'
                );

                if (!assignment) {
                  return true;
                }

                return currentState.ocAssignmentProdutos.some(
                  (item) =>
                    Number(item.assignment_id) === Number(assignment.id) &&
                    Number(item.oc_produto_id) === Number(produto.id)
                );
              })
              .map((produto) => Number(produto.id));
            const locations = currentState.ocLocalizacoes.filter((localizacao) =>
              productIds.includes(Number(localizacao.oc_produto_id))
            );
            const assignment = currentState.ocAssignments.find(
              (item) => Number(item.oc_id) === Number(oc.id) && item.status === 'ativo'
            );
            const movementDates = [
              oc.created_at,
              oc.updated_at,
              assignment?.created_at,
              ...currentState.counts
                .filter((count) => Number(count.oc_id) === Number(oc.id))
                .filter((count) => !assignment || Number(count.assignment_id) === Number(assignment.id))
                .map((count) => count.created_at)
            ].filter(Boolean).sort();
            const estoquista = currentState.users.find(
              (user) => Number(user.id) === Number(assignment?.estoquista_id || oc.estoquista_id)
            );

            if (locations.length > 0) {
              return {
                ...clone(oc),
                qtd: locations.length,
                qtd_contados: locations.filter((localizacao) =>
                  currentState.counts.some((count) =>
                    Number(count.assignment_id) === Number(assignment?.id) &&
                    Number(count.oc_localizacao_id) === Number(localizacao.id)
                  )
                ).length,
                estoquista_nome: estoquista?.nome || null,
                ultima_movimentacao_em: movementDates.at(-1) || null
              };
            }

            return {
              ...clone(oc),
              qtd: ocItems.filter((item) => item.status !== itemStatus.approved).length,
              qtd_contados: ocItems.filter((item) => item.status === itemStatus.counted).length,
              estoquista_nome: estoquista?.nome || null,
              ultima_movimentacao_em: movementDates.at(-1) || null
            };
          })
          .sort((a, b) => {
            const pendingDiff = Number(a.qtd_contados >= a.qtd) - Number(b.qtd_contados >= b.qtd);
            if (pendingDiff) {
              return pendingDiff;
            }

            const dateDiff = new Date(b.ultima_movimentacao_em || 0)
              - new Date(a.ultima_movimentacao_em || 0);
            return dateDiff || Number(b.id) - Number(a.id);
          });
      },

      async listAdminDashboardRows({ empresaId }) {
        return currentState.ocs
          .filter((oc) => Number(oc.empresa_id) === Number(empresaId))
          .map((oc) => {
            const ocItems = currentState.items.filter((item) => Number(item.oc_id) === Number(oc.id));
            const products = currentState.ocProdutos.filter((item) => Number(item.oc_id) === Number(oc.id));
            const activeAssignment = currentState.ocAssignments
              .filter((assignment) => Number(assignment.oc_id) === Number(oc.id) && assignment.status === 'ativo')
              .sort((a, b) => Number(b.ciclo) - Number(a.ciclo) || Number(b.id) - Number(a.id))[0] || null;
            const movementDates = [
              oc.created_at,
              oc.updated_at,
              ...currentState.counts
                .filter((count) => Number(count.oc_id) === Number(oc.id))
                .map((count) => count.created_at),
              ...currentState.ocAssignments
                .filter((assignment) => Number(assignment.oc_id) === Number(oc.id))
                .flatMap((assignment) => [assignment.created_at, assignment.finalizado_em])
            ]
              .filter(Boolean)
              .sort();
            const responsavel = currentState.users.find(
              (user) => Number(user.id) === Number(activeAssignment?.estoquista_id || oc.estoquista_id)
            );
            const criador = currentState.users.find((user) => Number(user.id) === Number(oc.gestor_id));

            return {
              id: oc.id,
              codigo: oc.codigo,
              gestor_id: oc.gestor_id,
              estoquista_id: oc.estoquista_id,
              status: oc.status,
              empresa_id: oc.empresa_id,
              qtd: products.length > 0 ? products.length : ocItems.length,
              responsavel_nome: responsavel?.nome || null,
              criador_nome: criador?.nome || null,
              active_assignment_id: activeAssignment?.id || null,
              active_assignment_fase: activeAssignment?.fase || null,
              active_assignment_status: activeAssignment?.status || null,
              has_legacy_recount: ocItems.some((item) => item.status === 'recontar'),
              empresa_codigo: oc.empresa_codigo || null,
              empresa_nome: oc.empresa_nome || null,
              ultima_movimentacao_em: movementDates.at(-1) || null
            };
          })
          .sort((a, b) => Number(b.id) - Number(a.id));
      },

      async listEstoquistaDashboardRows({ estoquistaId, empresaId, itemStatus, ocStatus }) {
        const rows = await repository.listByEstoquista({
          estoquistaId,
          empresaId,
          itemStatus,
          ocStatus
        });

        return rows.map((oc) => {
          const activeAssignment = currentState.ocAssignments
            .filter((assignment) => Number(assignment.oc_id) === Number(oc.id) && assignment.status === 'ativo')
            .sort((a, b) => Number(b.ciclo) - Number(a.ciclo) || Number(b.id) - Number(a.id))[0] || null;
          const movementDates = [
            oc.created_at,
            oc.updated_at,
            activeAssignment?.created_at,
            ...currentState.counts
              .filter((count) => Number(count.oc_id) === Number(oc.id))
              .filter((count) => !activeAssignment || Number(count.assignment_id) === Number(activeAssignment.id))
              .map((count) => count.created_at)
          ]
            .filter(Boolean)
            .sort();

          return {
            id: oc.id,
            codigo: oc.codigo,
            status: oc.status,
            empresa_id: oc.empresa_id,
            qtd: oc.qtd,
            qtd_contados: oc.qtd_contados,
            empresa_codigo: oc.empresa_codigo || null,
            empresa_nome: oc.empresa_nome || null,
            ultima_movimentacao_em: movementDates.at(-1) || null
          };
        }).sort((a, b) => {
          const dateDiff = new Date(b.ultima_movimentacao_em || 0) - new Date(a.ultima_movimentacao_em || 0);
          return dateDiff || Number(b.id) - Number(a.id);
        });
      },

      async listApprovalForAdmin({ empresaId, openStatus, waitingApprovalStatus }) {
        return listApproval({
          currentState,
          empresaId,
          openStatus,
          waitingApprovalStatus
        });
      },

      async listApprovalForGestor({ empresaId, openStatus, waitingApprovalStatus }) {
        return listApproval({
          currentState,
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

      async findActiveAssignmentForUser({ ocId, estoquistaId }) {
        return clone(
          currentState.ocAssignments
            .filter((assignment) =>
              Number(assignment.oc_id) === Number(ocId) &&
              Number(assignment.estoquista_id) === Number(estoquistaId) &&
              assignment.status === 'ativo'
            )
            .sort((a, b) => Number(b.ciclo) - Number(a.ciclo) || Number(b.id) - Number(a.id))[0] || null
        );
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
            .filter((produto) =>
              currentState.ocAssignmentProdutos.some(
                (item) =>
                  Number(item.assignment_id) === Number(assignmentId) &&
                  Number(item.oc_produto_id) === Number(produto.id)
              )
            )
            .map((produto) => {
              const locations = currentState.ocLocalizacoes
                .filter((localizacao) => Number(localizacao.oc_produto_id) === Number(produto.id));

              return {
                id: produto.id,
                descricao: produto.descricao_snapshot,
                status: produto.status,
                total_localizacoes: locations.length,
                localizacoes_contadas: locations.filter((location) =>
                  currentState.counts.some((count) =>
                    Number(count.assignment_id) === Number(assignmentId) &&
                    Number(count.oc_localizacao_id) === Number(location.id)
                  )
                ).length
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
        const isAssigned = currentState.ocAssignmentProdutos.some(
          (item) =>
            Number(item.assignment_id) === Number(assignmentId) &&
            Number(item.oc_produto_id) === Number(ocProdutoId)
        );

        if (!produto || !hasAssignment || !isAssigned) {
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
                codigo_barras_snapshot: localizacao.codigo_barras_snapshot || null,
                validade_snapshot: localizacao.validade_snapshot || null,
                status: count ? 'contado' : 'pendente',
                quantidade: count?.quantidade ?? null,
                lote: count?.lote ?? null
              };
            })
            .sort((a, b) => Number(a.id) - Number(b.id))
        );
      },

      async listAdminApprovalProducts({ ocId }) {
        return clone(
          currentState.ocProdutos
            .filter((produto) => Number(produto.oc_id) === Number(ocId))
            .map((produto) => {
              const locations = currentState.ocLocalizacoes
                .filter((localizacao) => Number(localizacao.oc_produto_id) === Number(produto.id))
                .sort((a, b) => Number(a.id) - Number(b.id))
                .map((localizacao) => {
                  const history = currentState.counts
                    .filter((count) => Number(count.oc_localizacao_id) === Number(localizacao.id))
                    .map((count) => {
                      const assignment = currentState.ocAssignments.find(
                        (item) => Number(item.id) === Number(count.assignment_id)
                      );
                      const countUser = currentState.users.find((item) => Number(item.id) === Number(count.user_id));

                      return {
                        ...count,
                        ciclo: assignment?.ciclo || null,
                        fase: assignment?.fase || null,
                        assignment_status: assignment?.status || null,
                        usuario_nome: countUser?.nome || null,
                        created_at: count.created_at || null
                      };
                    })
                    .sort((a, b) =>
                      Number(a.ciclo) - Number(b.ciclo) ||
                      new Date(a.created_at || 0) - new Date(b.created_at || 0) ||
                      Number(a.id) - Number(b.id)
                    );
                  const vigente = history.filter((count) => count.assignment_status === 'finalizado').sort(
                    (a, b) => Number(b.ciclo) - Number(a.ciclo) || Number(b.id) - Number(a.id)
                  )[0] || null;

                  return {
                    id: localizacao.id,
                    endereco: localizacao.endereco_snapshot,
                    saldo_contado: vigente?.quantidade ?? null,
                    lote: vigente?.lote ?? null,
                    contado_por: vigente?.usuario_nome || null,
                    contado_em: vigente?.created_at || null,
                    contagens: history
                  };
                });
              const saldoContado = locations.reduce((sum, location) => sum + Number(location.saldo_contado || 0), 0);
              const allHistory = locations.flatMap((location) => location.contagens || []);
              const first = allHistory.find((count) => Number(count.ciclo) === 1) || null;
              const last = [...allHistory].sort(
                (a, b) => Number(b.ciclo) - Number(a.ciclo) || Number(b.id) - Number(a.id)
              )[0] || null;

              return {
                id: produto.id,
                oc_id: produto.oc_id,
                oc_produto_id: produto.id,
                codigo: produto.codigo || null,
                produto: produto.descricao_snapshot,
                descricao: produto.descricao_snapshot,
                saldo_sistema: produto.saldo_sistema_snapshot,
                saldo_sistema_snapshot: produto.saldo_sistema_snapshot,
                saldo_contado: saldoContado,
                saldo_contado_vigente: saldoContado,
                diferenca: saldoContado - Number(produto.saldo_sistema_snapshot || 0),
                lotes: locations.map((location) => location.lote).filter(Boolean),
                localizacoes: locations,
                locations,
                status: locations.length > 0 && locations.every((location) => location.saldo_contado !== null)
                  ? 'contado'
                  : produto.status,
                primeira_contagem_user_id: first?.user_id || null,
                primeira_contagem_usuario_nome: first?.usuario_nome || null,
                primeira_contagem_em: first?.created_at || null,
                ultima_contagem_user_id: last?.user_id || null,
                ultima_contagem_usuario_nome: last?.usuario_nome || null,
                ultima_contagem_em: last?.created_at || null,
                total_contagens: allHistory.length,
                new_model: true
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

      async findAssignmentProduto({ assignmentId, ocProdutoId }) {
        return clone(
          currentState.ocAssignmentProdutos.find(
            (item) =>
              Number(item.assignment_id) === Number(assignmentId) &&
              Number(item.oc_produto_id) === Number(ocProdutoId)
          ) || null
        );
      },

      async findFirstCountAssignment({ ocId }) {
        return clone(
          currentState.ocAssignments.find(
            (assignment) =>
              Number(assignment.oc_id) === Number(ocId) &&
              assignment.fase === 'contagem' &&
              Number(assignment.ciclo) === 1
          ) || null
        );
      },

      async findActiveAssignmentByOc({ ocId }) {
        return clone(
          currentState.ocAssignments
            .filter((assignment) => Number(assignment.oc_id) === Number(ocId) && assignment.status === 'ativo')
            .sort((a, b) => Number(b.ciclo) - Number(a.ciclo) || Number(b.id) - Number(a.id))[0] || null
        );
      },

      async findOcProdutosByIdsForUpdate({ ocId, ocProdutoIds }) {
        const ids = (ocProdutoIds || []).map(Number);
        return clone(
          currentState.ocProdutos.filter(
            (produto) => Number(produto.oc_id) === Number(ocId) && ids.includes(Number(produto.id))
          )
        );
      },

      async getNextAssignmentCycle({ ocId }) {
        const maxCycle = currentState.ocAssignments
          .filter((assignment) => Number(assignment.oc_id) === Number(ocId))
          .reduce((max, assignment) => Math.max(max, Number(assignment.ciclo || 0)), 0);

        return maxCycle + 1;
      },

      async hasActiveAssignment({ ocId }) {
        return currentState.ocAssignments.some(
          (assignment) => Number(assignment.oc_id) === Number(ocId) && assignment.status === 'ativo'
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
          item_id: null,
          oc_produto_id: Number(ocProdutoId),
          oc_localizacao_id: Number(ocLocalizacaoId),
          assignment_id: Number(assignmentId),
          quantidade,
          lote,
          user_id: Number(userId),
          created_at: new Date().toISOString()
        };
        currentState.counts.push(count);
        return clone(count);
      },

      async updateLocalizacaoStatus({ ocLocalizacaoId, status }) {
        if (failOnUpdateLocalizacaoStatus) {
          throw new Error('location status update failed');
        }

        const localizacao = currentState.ocLocalizacoes.find(
          (item) => Number(item.id) === Number(ocLocalizacaoId)
        );

        if (localizacao) {
          localizacao.status = status;
        }
      },

      async updateProdutoStatusFromLocalizacoes({ ocProdutoId, pendingStatus, countedStatus }) {
        if (failOnUpdateProdutoStatusFromLocalizacoes) {
          throw new Error('product status update failed');
        }

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
        const productIds = currentState.ocProdutos
          .filter((produto) => Number(produto.oc_id) === Number(ocId))
          .filter((produto) =>
            currentState.ocAssignmentProdutos.some(
              (item) =>
                Number(item.assignment_id) === Number(assignmentId) &&
                Number(item.oc_produto_id) === Number(produto.id)
            )
          )
          .map((produto) => Number(produto.id));
        const locations = currentState.ocLocalizacoes.filter((localizacao) =>
          productIds.includes(Number(localizacao.oc_produto_id))
        );

        return {
          oc_existe: ocExists,
          qtd_ativos: locations.length,
          qtd_contados: locations.filter((localizacao) =>
            currentState.counts.some((count) =>
              Number(count.assignment_id) === Number(assignmentId) &&
              Number(count.oc_localizacao_id) === Number(localizacao.id)
            )
          ).length
        };
      },

      async getNewModelApprovalValidation({ ocId }) {
        const ocExists = currentState.ocs.some((oc) => Number(oc.id) === Number(ocId));
        const productIds = currentState.ocProdutos
          .filter((produto) => Number(produto.oc_id) === Number(ocId))
          .map((produto) => Number(produto.id));
        const locations = currentState.ocLocalizacoes.filter((localizacao) =>
          productIds.includes(Number(localizacao.oc_produto_id))
        );

        return {
          oc_existe: ocExists,
          has_active_assignment: currentState.ocAssignments.some(
            (assignment) => Number(assignment.oc_id) === Number(ocId) && assignment.status === 'ativo'
          ),
          qtd_ativos: locations.length,
          qtd_contados: locations.filter((localizacao) =>
            currentState.counts.some((count) => {
              const assignment = currentState.ocAssignments.find(
                (item) => Number(item.id) === Number(count.assignment_id)
              );
              return Number(count.oc_localizacao_id) === Number(localizacao.id) &&
                assignment?.status === 'finalizado';
            })
          ).length
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

function listApproval({ currentState, empresaId, openStatus, waitingApprovalStatus }) {
  return currentState.ocs
    .filter((oc) => (oc.status || openStatus) === waitingApprovalStatus)
    .filter((oc) => Number(oc.empresa_id) === Number(empresaId))
    .map((oc) => {
      const gestor = currentState.users.find((user) => Number(user.id) === Number(oc.gestor_id));
      const lastAssignment = currentState.ocAssignments
        .filter((assignment) => Number(assignment.oc_id) === Number(oc.id))
        .sort((a, b) => Number(b.ciclo) - Number(a.ciclo) || Number(b.id) - Number(a.id))[0] || null;
      const firstAssignment = currentState.ocAssignments.find(
        (assignment) =>
          Number(assignment.oc_id) === Number(oc.id) &&
          Number(assignment.ciclo) === 1 &&
          assignment.fase === 'contagem'
      ) || null;
      const estoquista = currentState.users.find(
        (user) => Number(user.id) === Number(lastAssignment?.estoquista_id || oc.estoquista_id)
      );
      const ocItems = currentState.items.filter((item) => Number(item.oc_id) === Number(oc.id));
      const products = currentState.ocProdutos.filter((item) => Number(item.oc_id) === Number(oc.id));
      const movementDates = [
        oc.created_at,
        oc.updated_at,
        ...currentState.counts
          .filter((count) => Number(count.oc_id) === Number(oc.id))
          .map((count) => count.created_at),
        ...currentState.ocAssignments
          .filter((assignment) => Number(assignment.oc_id) === Number(oc.id))
          .flatMap((assignment) => [assignment.created_at, assignment.finalizado_em])
      ]
        .filter(Boolean)
        .sort((a, b) => new Date(a) - new Date(b));

      return {
        ...clone(oc),
        qtd: products.length > 0 ? products.length : ocItems.length,
        gestor_nome: gestor?.nome || null,
        estoquista_nome: estoquista?.nome || null,
        responsavel_atual_id: lastAssignment?.estoquista_id || oc.estoquista_id,
        primeira_contagem_estoquista_id: firstAssignment?.estoquista_id || null,
        ultima_movimentacao_em: movementDates.at(-1) || null
      };
    })
    .sort((a, b) => {
      const dateDiff = new Date(b.ultima_movimentacao_em || 0) - new Date(a.ultima_movimentacao_em || 0);
      return dateDiff || Number(b.id) - Number(a.id);
    });
}

module.exports = createInMemoryOcRepository;
module.exports.createInMemoryOcRepository = createInMemoryOcRepository;
