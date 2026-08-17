function createAuthService() {
  return {
    getProtectedSession(user) {
      return {
        message: 'Voce esta logado',
        user
      };
    },

    getCurrentUser(user) {
      return user;
    }
  };
}

module.exports = createAuthService();
module.exports.createAuthService = createAuthService;
