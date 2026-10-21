import apiClient from './api';

export const userWalletService = {
  getProfile: () => apiClient.get('/users/me'),
  updateProfile: (fullName: string) => apiClient.patch('/users/me', { full_name: fullName }),
  getReputation: () => apiClient.get('/users/me/reputation'),
  getWinHistory: () => apiClient.get('/users/me/win-history'),
  getWalletBalance: () => apiClient.get('/wallet'),
  getTransactions: () => apiClient.get('/wallet/transactions'),
  topUpWallet: (amount: number) => apiClient.post('/wallet/topups', { amount }),
  getBankAccounts: () => apiClient.get('/bank-accounts'),
  addBankAccount: (data: { provider: string; account_type: 'BANK' | 'E_WALLET'; account_number: string; account_name: string }) => apiClient.post('/bank-accounts', data),
  deleteBankAccount: (id: string) => apiClient.delete(`/bank-accounts/${id}`),
};
