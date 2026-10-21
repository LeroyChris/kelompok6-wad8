import API from './api';

export const cycleService = {
  getCycles: (circleId: string) => API.get(`/circles/${circleId}/cycles`, { params: { limit: 20 } }),
  getCycle: (cycleId: string) => API.get(`/cycles/${cycleId}`),
  getObligations: (cycleId: string) => API.get(`/cycles/${cycleId}/obligations`, { params: { limit: 100 } }),
  payWallet: (obligationId: string, key: string) => API.post(`/obligations/${obligationId}/payments/wallet`, {}, { headers: { 'Idempotency-Key': key } }),
  createManualPayment: (obligationId: string) => API.post(`/obligations/${obligationId}/payments/manual`),
  uploadProof: (paymentOrderId: string, proofUrl: string) => API.post(`/payments/${paymentOrderId}/proof`, { proof_url: proofUrl }),
  submitBid: (cycleId: string, bidRatePercent: number) => API.post(`/cycles/${cycleId}/bids`, { bid_rate_percent: bidRatePercent }),
  closeBidding: (cycleId: string) => API.post(`/cycles/${cycleId}/bidding/close`),
  resolveAward: (cycleId: string) => API.post(`/cycles/${cycleId}/award/resolve`),
  getAward: (cycleId: string) => API.get(`/cycles/${cycleId}/award`),
  getDrawProof: (cycleId: string) => API.get(`/cycles/${cycleId}/draw-proof`),
};
