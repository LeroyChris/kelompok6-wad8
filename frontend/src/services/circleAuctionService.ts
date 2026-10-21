import { cycleService } from './cycleService';

export const circleAuctionService = {
  getParticipants: cycleService.getParticipants,
  executeDraw: cycleService.resolveAward,
  submitBid: cycleService.submitBid,
};
