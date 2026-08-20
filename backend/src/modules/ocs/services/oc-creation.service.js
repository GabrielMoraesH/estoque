function createOcCreationService({
  repository,
  audit,
  isAdmin,
  isGestor,
  badRequest,
  conflict,
  forbidden,
  cleanText,
  assertUserHasEmpresaAccess,
  assertEstoquistaAvailableForFirstCount,
  ocStatus,
  itemStatus,
  assignmentStatus
}) {
  function normalizeNumber(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  function normalizeDateSnapshot(value) {
    const text = cleanText(value);

    if (!text) {
      return null;
    }

    const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDate) {
      const year = Number(isoDate[1]);
      const month = Number(isoDate[2]);
      const day = Number(isoDate[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
        return text;
      }
    }

    const monthYear = text.match(/^(\d{2})\/(\d{4})$/);
    if (monthYear) {
      const month = Number(monthYear[1]);
      if (month >= 1 && month <= 12) {
        return `${monthYear[2]}-${monthYear[1]}-01`;
      }
    }

    throw badRequest('Validade invalida. Use MM/AAAA ou AAAA-MM-DD');
  }

  function getProductIdentity(item) {
    const produtoExternoId = cleanText(item.produto_externo_id);
    if (produtoExternoId) {
      return { type: 'produto_externo_id', value: produtoExternoId };
    }

    const codigo = cleanText(item.codigo);
    if (codigo) {
      return { type: 'codigo', value: codigo };
    }

    const produto = cleanText(item.produto);
    if (produto) {
      return { type: 'produto_fallback', value: produto.toLowerCase() };
    }

    return null;
  }

  function getLocationIdentity(item) {
    const localizacaoExternaId = cleanText(item.localizacao_externa_id);
    if (localizacaoExternaId) {
      return { type: 'localizacao_externa_id', value: localizacaoExternaId };
    }

    const endereco = cleanText(item.endereco);
    if (endereco) {
      return { type: 'endereco', value: endereco };
    }

    return null;
  }

  function groupItemsByProduct(items) {
    const grouped = new Map();

    for (const item of items) {
      const produto = cleanText(item?.produto);
      const endereco = cleanText(item?.endereco);
      const productIdentity = getProductIdentity(item || {});
      const locationIdentity = getLocationIdentity(item || {});

      if (!produto) {
        throw badRequest('Produto invalido na OC');
      }

      if (!endereco) {
        throw badRequest('Produto sem localizacao nao pode gerar OC nesta fase');
      }

      if (!productIdentity) {
        throw badRequest('Produto sem identidade valida para gerar OC');
      }

      if (!locationIdentity) {
        throw badRequest('Localizacao sem identidade valida para gerar OC');
      }

      const productKey = `${productIdentity.type}:${productIdentity.value}`;
      const locationKey = `${locationIdentity.type}:${locationIdentity.value}`;

      if (!grouped.has(productKey)) {
        grouped.set(productKey, {
          produtoExternoId: productIdentity.type === 'produto_externo_id' ? productIdentity.value : null,
          codigo: cleanText(item.codigo),
          codigoBarras: cleanText(item.codigo_barras),
          descricaoSnapshot: produto,
          saldoSistemaSnapshot: 0,
          locations: [],
          locationKeys: new Set()
        });
      }

      const group = grouped.get(productKey);

      if (group.locationKeys.has(locationKey)) {
        throw conflict('Localizacao duplicada para o mesmo produto na OC');
      }

      group.saldoSistemaSnapshot += normalizeNumber(item.saldo_sistema);
      group.locations.push({
        localizacaoExternaId: locationIdentity.type === 'localizacao_externa_id'
          ? locationIdentity.value
          : null,
        enderecoSnapshot: endereco,
        codigoBarrasSnapshot: cleanText(item.codigo_barras),
        validadeSnapshot: normalizeDateSnapshot(item.validade)
      });
      group.locationKeys.add(locationKey);
    }

    return Array.from(grouped.values()).map(({ locationKeys, ...group }) => group);
  }

  function mapCreateModelError(err) {
    if (err?.code !== '23505') {
      return err;
    }

    if (String(err.constraint || '').includes('oc_produtos')) {
      return conflict('Produto duplicado na OC');
    }

    if (String(err.constraint || '').includes('oc_localizacoes')) {
      return conflict('Localizacao duplicada para o mesmo produto na OC');
    }

    if (String(err.constraint || '').includes('oc_assignment')) {
      return conflict('Produto duplicado no assignment da OC');
    }

    return conflict('Registro duplicado na criacao da OC');
  }

  async function createOcWithItems({ user, empresaId, payload, auditContext }) {
    if (!isAdmin(user) && !isGestor(user)) {
      throw forbidden('Voce nao tem permissao para gerar OC');
    }

    const { estoquista_id, items } = payload;

    if (!estoquista_id) {
      throw badRequest('Selecione um estoquista');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw badRequest('Selecione ao menos um produto para gerar a OC');
    }

    const groupedProducts = groupItemsByProduct(items);

    const oc = await repository.withTransaction(async (tx, transactionClient) => {
      await assertUserHasEmpresaAccess(user.id, empresaId, tx);
      await assertEstoquistaAvailableForFirstCount(estoquista_id, tx);
      await assertUserHasEmpresaAccess(estoquista_id, empresaId, tx);

      const { nextId, codigo } = await tx.getNextIdentity();
      const gestorId = Number(user.id);
      const createdOc = await tx.createOc({
        id: nextId,
        codigo,
        gestorId,
        estoquistaId: estoquista_id,
        empresaId,
        status: ocStatus.OPEN
      });

      try {
        const createdProductIds = [];

        for (const product of groupedProducts) {
          const createdProduct = await tx.createOcProduto({
            ocId: createdOc.id,
            produtoExternoId: product.produtoExternoId,
            codigo: product.codigo,
            codigoBarras: product.codigoBarras,
            descricaoSnapshot: product.descricaoSnapshot,
            saldoSistemaSnapshot: product.saldoSistemaSnapshot,
            status: itemStatus.PENDING
          });
          createdProductIds.push(createdProduct.id);

          for (const location of product.locations) {
            await tx.createOcLocalizacao({
              ocProdutoId: createdProduct.id,
              localizacaoExternaId: location.localizacaoExternaId,
              enderecoSnapshot: location.enderecoSnapshot,
              codigoBarrasSnapshot: location.codigoBarrasSnapshot,
              validadeSnapshot: location.validadeSnapshot,
              status: itemStatus.PENDING
            });
          }
        }

        const assignment = await tx.createOcAssignment({
          ocId: createdOc.id,
          ciclo: 1,
          fase: 'contagem',
          estoquistaId: estoquista_id,
          status: assignmentStatus.ACTIVE
        });

        await tx.createOcAssignmentProdutos({
          assignmentId: assignment.id,
          ocId: createdOc.id,
          ocProdutoIds: createdProductIds
        });
      } catch (err) {
        throw mapCreateModelError(err);
      }

      await audit.logAction({
        user,
        action: 'oc.created',
        entityType: 'oc',
        entityId: createdOc.id,
        metadata: {
          codigo: createdOc.codigo,
          empresa_id: empresaId,
          gestor_id: createdOc.gestor_id,
          estoquista_id: createdOc.estoquista_id,
          item_count: groupedProducts.length
        },
        auditContext,
        transactionClient
      });
      return createdOc;
    });

    return { ...oc, qtd: groupedProducts.length };
  }

  return { createOcWithItems };
}

module.exports = { createOcCreationService };
