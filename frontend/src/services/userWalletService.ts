import apiClient from './api';

export const userWalletService = {
  // Profil & Reputasi User
  getProfile: () => apiClient.get('/users/me'),
  updateProfile: (fullName: string) => apiClient.patch('/users/me', { full_name: fullName }),
  getReputation: () => apiClient.get('/users/me/reputation'),

  // Dompet Digital Internal
  getWalletBalance: () => apiClient.get('/wallet'),
  getTransactions: () => apiClient.get('/wallet/transactions'),
  topUpWallet: (amount: number) => apiClient.post('/wallet/topup', { amount }),

  // Rekening Bank
  getBankAccounts: () => apiClient.get('/bank-accounts'),
  addBankAccount: (data: { bank_name: string; account_number: string; account_holder: string; is_primary: boolean }) =>
    apiClient.post('/bank-accounts', data),
  deleteBankAccount: (id: string) => apiClient.delete(`/bank-accounts/${id}`),
};