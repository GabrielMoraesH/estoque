import { getErrorMessage } from "../services/api";

export const feedbackMessages = {
  users: {
    loadError: "Não foi possível carregar os usuários.",
    createSuccess: "Usuário criado com sucesso.",
    createError: "Não foi possível criar o usuário.",
    updateSuccess: "Usuário atualizado com sucesso.",
    updateError: "Não foi possível atualizar o usuário.",
    deleteSuccess: "Usuário excluído com sucesso.",
    deleteError: "Não foi possível excluir o usuário.",
    deleteTitle: "Excluir usuário",
    deleteQuestionPrefix: "Tem certeza de que deseja excluir",
    deleteWarning: "Essa ação não poderá ser desfeita.",
    deleteButton: "Excluir usuário",
    deletingButton: "Excluindo..."
  },
  oc: {
    loadCreateDataError: "Não foi possível carregar os dados da OC.",
    loadListError: "Não foi possível carregar suas OCs.",
    loadGestorListError: "Não foi possível carregar as OCs.",
    loadItemsError: "Não foi possível carregar os itens da OC.",
    loadDetailsError: "Não foi possível carregar os detalhes da OC.",
    addDuplicateInfo: "Este produto já está na seleção.",
    addSuccess: "Produto adicionado à OC.",
    selectEstoquista: "Selecione um estoquista para continuar.",
    selectProduct: "Adicione pelo menos um produto para gerar a OC.",
    generateSuccess: "OC gerada com sucesso.",
    generateError: "Não foi possível gerar a OC.",
    finalizeSuccess: "OC enviada para aprovação com sucesso.",
    finalizeError: "Não foi possível finalizar a OC.",
    confirmFinalize: "Deseja finalizar esta OC e enviá-la para aprovação?"
  },
  count: {
    requiredFields: "Informe a quantidade e o lote para registrar a contagem.",
    saveSuccess: "Contagem registrada com sucesso.",
    saveError: "Não foi possível registrar a contagem."
  },
  approval: {
    loadError: "Não foi possível carregar as OCs para aprovação.",
    loadDetailsError: "Não foi possível carregar os itens da OC.",
    approveSuccess: "OC aprovada com sucesso.",
    approveError: "Não foi possível aprovar a OC.",
    selectRecountItems: "Selecione pelo menos um item para recontagem.",
    recountSuccess: "Itens enviados para recontagem com sucesso.",
    recountError: "Não foi possível enviar os itens para recontagem.",
    confirmApprove: "Deseja aprovar esta OC?",
    confirmRecount: "Deseja enviar os itens selecionados para recontagem?"
  },
  login: {
    success: "Login realizado com sucesso.",
    error: "Não foi possível fazer login."
  }
};

export function getFeedbackErrorMessage(error, fallbackMessage) {
  return getErrorMessage(error, fallbackMessage);
}
