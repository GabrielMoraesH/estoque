function createOcReassignmentService({
  repository,
  audit,
  assertAdministrativeApprovalRole,
  getOcOrFail,
  assertOcEmpresa,
  getUserOrFail,
  isAdmin,
  isGestor,
  assertUserHasEmpresaAccess,
  assertEstoquistaAvailableForAssignment,
  badRequest,
  conflict,
  forbidden,
  notFound
}) {
  async function reassignAssignment({ user, empresaId, ocId, assignmentId, novoEstoquistaId, auditContext }) {
    assertAdministrativeApprovalRole(user);
    const normalizedOcId = Number(ocId);
    const normalizedAssignmentId = Number(assignmentId);
    const normalizedNovoEstoquistaId = Number(novoEstoquistaId);
    const expectedAssignment = await repository.findActiveAssignmentByOc({ ocId: normalizedOcId });

    const result = await repository.withTransaction(async (tx, transactionClient) => {
      const oc = await getOcOrFail(normalizedOcId, tx, { forUpdate: true });
      assertOcEmpresa(oc, empresaId);

      const actor = await getUserOrFail(user.id, tx);
      if (actor.ativo === false || (!isAdmin(actor) && !isGestor(actor))) {
        throw forbidden('Voce nao tem permissao para operar esta OC');
      }
      await assertUserHasEmpresaAccess(actor.id, empresaId, tx);

      const assignment = await tx.findActiveAssignmentByOc(
        { ocId: normalizedOcId },
        { forUpdate: true }
      );
      if (!assignment || Number(assignment.id) !== normalizedAssignmentId) {
        throw notFound('Assignment ativo nao encontrado para esta OC');
      }

      const novoEstoquista = await assertEstoquistaAvailableForAssignment(normalizedNovoEstoquistaId, tx);
      await assertUserHasEmpresaAccess(novoEstoquista.id, empresaId, tx);
      const expectedLevel = assignment.fase === 'recontagem' ? 2 : 1;
      if (Number(novoEstoquista.nivel_estoquista) !== expectedLevel) {
        throw badRequest(
          assignment.fase === 'recontagem'
            ? 'A recontagem deve ser atribuida a um estoquista nivel 2'
            : 'A primeira contagem deve ser atribuida a um estoquista nivel 1'
        );
      }

      const products = await tx.listOperationalProducts({
        ocId: normalizedOcId,
        assignmentId: normalizedAssignmentId
      });
      const progress = products.reduce((summary, product) => ({
        total: summary.total + Number(product.total_localizacoes || 0),
        counted: summary.counted + Number(product.localizacoes_contadas || 0)
      }), { total: 0, counted: 0 });

      if (Number(assignment.estoquista_id) === normalizedNovoEstoquistaId) {
        return { assignment, previousEstoquistaId: normalizedNovoEstoquistaId, progress, changed: false };
      }

      const updated = await tx.reassignActiveAssignment({
        assignmentId: normalizedAssignmentId,
        ocId: normalizedOcId,
        previousEstoquistaId: expectedAssignment?.estoquista_id,
        novoEstoquistaId: normalizedNovoEstoquistaId
      });
      if (!updated) {
        throw conflict('Assignment foi alterado por outra operacao');
      }

      const result = { assignment: updated, previousEstoquistaId: assignment.estoquista_id, progress, changed: true };
      await audit.logAction({
        user,
        action: 'oc.assignment_reassigned',
        entityType: 'oc',
        entityId: normalizedOcId,
        metadata: {
          empresa_id: Number(empresaId), oc_id: normalizedOcId,
          assignment_id: normalizedAssignmentId, ciclo: Number(updated.ciclo), fase: updated.fase,
          estoquista_anterior_id: Number(assignment.estoquista_id),
          estoquista_novo_id: normalizedNovoEstoquistaId,
          progresso: `${progress.counted}/${progress.total}`
        },
        auditContext,
        transactionClient
      });
      return result;
    });

    return {
      message: result.changed ? 'Responsavel reatribuido com sucesso' : 'Responsavel ja estava atribuido',
      changed: result.changed,
      assignment: result.assignment,
      progresso: result.progress
    };
  }

  return { reassignAssignment };
}

module.exports = { createOcReassignmentService };
