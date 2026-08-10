const OC_REPOSITORY_METHODS = [
  'withTransaction',
  'getNextIdentity',
  'findOcById',
  'findUserById',
  'userHasEmpresaAccess',
  'createOc',
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
