import API from './api';

export const drawService = {
  // Ambil kandidat untuk Roda Pengocokan (Track B)
  getParticipants: (cycleId: string) => 
    API.get(`/cycles/${cycleId}/participants`),

  // Eksekusi Roda Pengocokan (Track B)
  executeDraw: (cycleId: string) => 
    API.post(`/cycles/${cycleId}/draw`),

  // Kirim Penawaran Lelang (Track A)
  submitBid: (cycleId: string, bidRatePercent: number) => 
    API.post(`/cycles/${cycleId}/bids`, { bid_rate_percent: bidRatePercent }),
};