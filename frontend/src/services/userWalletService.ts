import apiClient from './api';

export const userWalletService = {
  getProfile: () => apiClient.get('/users/me'),
  getWalletBalance: () => apiClient.get('/wallet'),
  getTransactions: () => apiClient.get('/wallet/transactions'),
  topUpWallet: (amount: number) => apiClient.post('/wallet/topups', { amount }),
};
