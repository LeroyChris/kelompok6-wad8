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

  // Daftar anggota circle
  getCircleMembers: async (circleId: string) => {
    return await apiClient.get(`/circles/${circleId}/members`);
  },

  // Matriks pembayaran circle
  getPaymentMatrix: async (circleId: string) => {
    return await apiClient.get(`/circles/${circleId}/payment-matrix`);
  },

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

  // Keluar dari Circle (Fitur Baru)
  leaveCircle: async (circleId: string) => {
    return await apiClient.post(`/circles/${circleId}/leave`);
  },
};
