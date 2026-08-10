const USER_REPOSITORY_METHODS = [
  'create',
  'withTransaction',
  'findByLogin',
  'findSummaryById',
  'findActiveEmpresaIds',
  'listActiveEmpresasByUserId',
  'replaceUserEmpresas',
  'list',
  'update',
  'updateStatus',
  'deleteById',
  'listEstoquistas'
];

function assertUserRepository(repository) {
  if (!repository || typeof repository !== 'object') {
    throw new TypeError('IUserRepository implementation is required');
  }

  for (const method of USER_REPOSITORY_METHODS) {
    if (typeof repository[method] !== 'function') {
      throw new TypeError(`IUserRepository implementation must define ${method}()`);
    }
  }
}

module.exports = {
  USER_REPOSITORY_METHODS,
  assertUserRepository
};
