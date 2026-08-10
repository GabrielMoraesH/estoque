const OC_REPOSITORY_METHODS = [
  'withTransaction',
  'getNextIdentity',
  'findOcById',
  'findUserById',
  'userHasEmpresaAccess',
  'createOc',
  'createOcProduto',
  'createOcLocalizacao',
  'createOcAssignment',
  'createOcAssignmentProdutos',
  'createItem',
  'listByGestor',
  'listByEstoquista',
  'listApprovalForAdmin',
  'listApprovalForGestor',
  'approveItems',
  'updateOcStatus',
  'updateOcAssignmentAndStatus',
  'findItemsByIdsForUpdate',
  'markItemsForRecount',
  'approveItemsExcept',
  'listItems',
  'findItemById',
  'ocHasNewModel',
  'findActiveAssignmentForUser',
  'listOperationalProducts',
  'listOperationalLocationsByProduct',
  'listAdminApprovalProducts',
  'findLocalizacaoContextById',
  'findAssignmentProduto',
  'findActiveFirstCountAssignment',
  'findFirstCountAssignment',
  'findActiveAssignmentByOc',
  'findOcProdutosByIdsForUpdate',
  'getNextAssignmentCycle',
  'hasActiveAssignment',
  'findCountByAssignmentAndLocation',
  'findLegacyItemForLocalizacao',
  'createNewModelCount',
  'updateLocalizacaoStatus',
  'updateProdutoStatusFromLocalizacoes',
  'getNewModelFinalizeValidation',
  'getNewModelApprovalValidation',
  'finalizeAssignment',
  'createCount',
  'updateItemCount',
  'getFinalizeValidation'
];

function assertOcRepository(repository) {
  if (!repository || typeof repository !== 'object') {
    throw new TypeError('IOcRepository implementation is required');
  }

  for (const method of OC_REPOSITORY_METHODS) {
    if (typeof repository[method] !== 'function') {
      throw new TypeError(`IOcRepository implementation must define ${method}()`);
    }
  }
}

module.exports = {
  OC_REPOSITORY_METHODS,
  assertOcRepository
};
