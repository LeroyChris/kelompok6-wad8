import apiClient from './api';

export const circleService = {
  // Ambil daftar circle yang diikuti oleh user
  getUserCircles: async () => {
    return await apiClient.get('/circles');
  },

  // Detail circle spesifik
  getCircleDetail: async (circleId: string) => {
    return await apiClient.get(`/circles/${circleId}`);
  },

  // Matriks pembayaran circle
  getPaymentMatrix: async (circleId: string) => {
    return await apiClient.get(`/circles/${circleId}/payment-matrix`);
  },
  getPaymentProofs: (circleId: string) => apiClient.get(`/circles/${circleId}/payment-proofs`, { params: { status: 'PENDING' } }),
  reviewPaymentProof: (proofId: string, reviewStatus: 'APPROVED' | 'REJECTED') => apiClient.post(`/payment-proofs/${proofId}/review`, { review_status: reviewStatus }),

  // Buat circle baru (Ketua Circle)
  createCircle: async (data: {
    circle_name: string;
    track_type: string;
    contribution_amount: number;
    member_limit: number;
  }) => {
    return await apiClient.post('/circles', data);
  },

  // Gabung circle via kode undangan (Anggota)
  joinCircle: async (inviteCode: string) => {
    return await apiClient.post('/circles/join', { invite_code: inviteCode });
  },

  lockCircle: (circleId: string) => apiClient.post(`/circles/${circleId}/lock`),
  createCycle: (circleId: string, cycleNumber: number, dueAt: string) => apiClient.post(`/circles/${circleId}/cycles`, { cycle_number: cycleNumber, due_at: dueAt }),
};
