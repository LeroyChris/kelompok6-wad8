import API from './api';

export interface CycleItem { cycle_id: string; cycle_number: number; cycle_status: string; due_at: string; }
export interface ObligationItem { obligation_id: string; full_name: string; amount_due: number; due_at: string; status: string; }

export const cycleService = {
  getCycles: (circleId: string) => API.get('/circles/' + circleId + '/cycles', { params: { limit: 20 } }),
  getObligations: (cycleId: string) => API.get('/cycles/' + cycleId + '/obligations', { params: { limit: 100 } }),
};
