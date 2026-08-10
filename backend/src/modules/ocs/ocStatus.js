const OC_STATUS = {
  OPEN: 'aberta',
  WAITING_APPROVAL: 'aguardando_aprovacao',
  FINALIZED: 'finalizada'
};

const ITEM_STATUS = {
  PENDING: 'pendente',
  COUNTED: 'contado',
  APPROVED: 'aprovado',
  RECOUNT: 'recontar'
};

function getOcStatus(oc) {
  return oc?.status || OC_STATUS.OPEN;
}

function assertOcStatus(oc, allowedStatuses) {
  return allowedStatuses.includes(getOcStatus(oc));
}

function assertItemStatus(item, allowedStatuses) {
  return allowedStatuses.includes(item?.status);
}

module.exports = {
  OC_STATUS,
  ITEM_STATUS,
  getOcStatus,
  assertOcStatus,
  assertItemStatus
};
