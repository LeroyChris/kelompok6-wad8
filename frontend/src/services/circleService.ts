import API from './api';

export interface CreateCirclePayload {
  circle_name: string;
  track_type: 'SPSB' | 'RANDOM_DRAW';
  contribution_amount: number;
  member_limit: number;
  period_type: 'MONTHLY' | 'WEEKLY';
  bid_floor_percent?: number;
  bid_ceiling_percent?: number;
}

export const circleService = {
  // POST /api/v1/circles - Membuat kelompok arisan baru
  createCircle: (payload: CreateCirclePayload) => 
    API.post('/circles', payload),

  // GET /api/v1/circles - Menampilkan daftar kelompok arisan milik pengguna
  getCircles: (params?: { limit?: number; cursor?: string }) =>
    API.get('/circles', { params }),

  // POST /api/v1/circles/join - Bergabung via kode undangan
  joinCircle: (invite_code: string) => 
    API.post('/circles/join', { invite_code }),

  // GET /api/v1/circles/:id/payment-matrix - Menyuplai data matriks status pembayaran
  getPaymentMatrix: (circleId: string) => 
    API.get(`/circles/${circleId}/payment-matrix`),
};
