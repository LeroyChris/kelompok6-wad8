import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: Otomatis lampirkan Token JWT dari LocalStorage ke Header
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const userWalletService = {
  // 1. Auth & OTP
  requestOTP: (phone_number: string) => 
    API.post('/auth/request-otp', { phone_number }),
  verifyOTP: (phone_number: string, otp_code: string) => 
    API.post('/auth/verify-otp', { phone_number, otp_code }),

  // 2. User Profile & Reputation
  getProfile: () => API.get('/users/me'),
  updateProfile: (fullName: string) => API.patch('/users/me', { full_name: fullName }),
  getReputation: () => API.get('/users/me/reputation'),

  // 3. Wallet
  getWalletBalance: () => API.get('/wallet'),
  getTransactions: () => API.get('/wallet/transactions'),
  topUpWallet: (amount: number) => API.post('/wallet/topup', { amount }),

  // 4. Bank Accounts (CRUD)
  getBankAccounts: () => API.get('/bank-accounts'),
  addBankAccount: (data: { bank_name: string; account_number: string; account_holder: string; is_primary: boolean }) =>
    API.post('/bank-accounts', data),
  deleteBankAccount: (id: string) => API.delete(`/bank-accounts/${id}`),
};