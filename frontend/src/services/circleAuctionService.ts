import API from './api';

export const circleAuctionService = {
  // GET /api/v1/cycles/:id/participants?page=1&page_size=10
  getParticipants: (cycleId: string, page = 1, pageSize = 10) =>
    API.get(`/cycles/${cycleId}/participants`, {
      params: { page, page_size: pageSize },
    }),

  // POST /api/v1/cycles/:id/draw (Track B Spin Wheel)
  executeDraw: (cycleId: string) =>
    API.post(`/cycles/${cycleId}/draw`),

  // POST /api/v1/cycles/:id/bids (Track A Lelang SPSB)
  submitBid: (cycleId: string, bidRatePercent: number) =>
    API.post(`/cycles/${cycleId}/bids`, { bid_rate_percent: bidRatePercent }),
};

export default circleAuctionService;