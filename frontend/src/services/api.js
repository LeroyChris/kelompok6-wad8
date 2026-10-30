/**
 * API client for the ArisanKita backend (Go/Gin, /api/v1).
 *
 * All calls use the real backend; there is no client-side mock. Sandbox OTP
 * (default 123456) is handled server-side and only when APP_ENV != production.
 */

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:8080'
).replace(/\/$/, '')

const TOKEN_KEY = 'arisankita_token'
const USER_KEY = 'arisankita_user'

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setStoredUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_KEY)
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/** Low-level request. Unwraps the { code, status, message, data } envelope. */
async function request(path, { method = 'GET', body, idempotencyKey } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  const payload = text ? JSON.parse(text) : null

  if (!res.ok) {
    const err = new Error(payload?.message || payload?.error?.message || `Permintaan gagal (${res.status})`)
    err.status = res.status
    err.code = payload?.error?.code
    throw err
  }
  return payload?.data
}

const qs = (params = {}) => {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v)
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  // ---- Auth & user ----
  requestOTP: (email) => request('/auth/otp/request', { method: 'POST', body: { email } }),
  async verifyOTP(email, otpCode) {
    const data = await request('/auth/otp/verify', {
      method: 'POST',
      body: { email, otp_code: otpCode },
    })
    const token = data?.token?.access || ''
    const user = data?.user || null
    setToken(token)
    setStoredUser(user)
    return { token, user }
  },
  getMe: () => request('/users/me'),
  updateProfile: (full_name) => request('/users/me', { method: 'PATCH', body: { full_name } }),
  getWinHistory: () => request('/users/me/win-history'),
  getReputation: () => request('/users/me/reputation'),

  // ---- Wallet & bank ----
  getWallet: () => request('/wallet'),
  getWalletTransactions: (cursor) => request(`/wallet/transactions${qs({ limit: 20, cursor })}`),
  topUp: (amount) => request('/wallet/topups', { method: 'POST', body: { amount } }),
  getBankAccounts: () => request('/bank-accounts'),
  addBankAccount: (payload) => request('/bank-accounts', { method: 'POST', body: payload }),
  deleteBankAccount: (id) => request(`/bank-accounts/${id}`, { method: 'DELETE' }),

  // ---- Circles & membership ----
  listCircles: (cursor) => request(`/circles${qs({ limit: 20, cursor })}`),
  createCircle: (payload) => request('/circles', { method: 'POST', body: payload }),
  getCircle: (id) => request(`/circles/${id}`),
  updateCircle: (id, circle_name) => request(`/circles/${id}`, { method: 'PATCH', body: { circle_name } }),
  lockCircle: (id) => request(`/circles/${id}/lock`, { method: 'POST' }),
  joinCircle: (invite_code) => request('/circles/join', { method: 'POST', body: { invite_code } }),
  leaveCircle: (id) => request(`/circles/${id}/leave`, { method: 'POST' }),
  listMembers: (id, cursor) => request(`/circles/${id}/members${qs({ limit: 50, cursor })}`),
  updateMember: (id, userId, patch) => request(`/circles/${id}/members/${userId}`, { method: 'PATCH', body: patch }),
  listInvitations: (id, cursor) => request(`/circles/${id}/invitations${qs({ limit: 20, cursor })}`),
  createInvitation: (id, expires_in_days) =>
    request(`/circles/${id}/invitations`, { method: 'POST', body: { expires_in_days } }),

  // ---- Cycles, obligations, payment ----
  listCycles: (circleId, cursor) => request(`/circles/${circleId}/cycles${qs({ limit: 20, cursor })}`),
  createCycle: (circleId, payload) => request(`/circles/${circleId}/cycles`, { method: 'POST', body: payload }),
  getCycle: (cycleId) => request(`/cycles/${cycleId}`),
  listObligations: (cycleId, cursor) => request(`/cycles/${cycleId}/obligations${qs({ limit: 100, cursor })}`),
  listParticipants: (cycleId, cursor) => request(`/cycles/${cycleId}/participants${qs({ limit: 100, cursor })}`),
  getPaymentMatrix: (circleId, cursor) => request(`/circles/${circleId}/payment-matrix${qs({ limit: 100, cursor })}`),
  payWallet: (obligationId, idempotencyKey) =>
    request(`/obligations/${obligationId}/payments/wallet`, { method: 'POST', idempotencyKey }),
  payManual: (obligationId, idempotencyKey) =>
    request(`/obligations/${obligationId}/payments/manual`, { method: 'POST', idempotencyKey }),
  getPayment: (paymentOrderId) => request(`/payments/${paymentOrderId}`),
  uploadProof: (paymentOrderId, proof_url) =>
    request(`/payments/${paymentOrderId}/proof`, { method: 'POST', body: { proof_url } }),
  listPaymentProofs: (circleId, status = 'PENDING', cursor) =>
    request(`/circles/${circleId}/payment-proofs${qs({ status, limit: 50, cursor })}`),
  reviewProof: (paymentProofId, review_status, review_note = '') =>
    request(`/payment-proofs/${paymentProofId}/review`, { method: 'POST', body: { review_status, review_note } }),

  // ---- Bidding, award, draw ----
  submitBid: (cycleId, bid_rate_percent) =>
    request(`/cycles/${cycleId}/bids`, { method: 'POST', body: { bid_rate_percent } }),
  getMyBid: (cycleId) => request(`/cycles/${cycleId}/bids/me`),
  closeBidding: (cycleId) => request(`/cycles/${cycleId}/bidding/close`, { method: 'POST' }),
  resolveAward: (cycleId) => request(`/cycles/${cycleId}/award/resolve`, { method: 'POST' }),
  getAward: (cycleId) => request(`/cycles/${cycleId}/award`),
  getDrawProof: (cycleId) => request(`/cycles/${cycleId}/draw-proof`),
}

export default api
