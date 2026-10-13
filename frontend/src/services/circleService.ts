import API from './api';

export interface CreateCirclePayload {
  name: string;
  track_type: 'TRACK_A' | 'TRACK_B';
  monthly_dues: number;
}

export const circleService = {
  // POST /api/v1/circles - Membuat kelompok arisan baru
  createCircle: (payload: CreateCirclePayload) => 
    API.post('/circles', payload),

  // GET /api/v1/circles - Menampilkan daftar kelompok arisan milik pengguna
  getCircles: () => 
    API.get('/circles'),

  // POST /api/v1/circles/join - Bergabung via kode undangan
  joinCircle: (invite_code: string) => 
    API.post('/circles/join', { invite_code }),

  // GET /api/v1/circles/:id/payment-matrix - Menyuplai data matriks status pembayaran
  getPaymentMatrix: (circleId: string) => 
    API.get(`/circles/${circleId}/payment-matrix`),
};