function createAuthService() {
  return {
    getProtectedSession(user) {
      return {
        message: 'Voce esta logado',
        user
      };
    }
  };
}

module.exports = createAuthService();
module.exports.createAuthService = createAuthService;
