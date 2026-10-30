import { useState } from 'react'
import api from '@/services/api'
import { useCursorList, formatIDR, errorMessage } from '@/lib/util'

const emptyForm = {
  circle_name: '',
  track_type: 'RANDOM_DRAW',
  contribution_amount: 100000,
  member_limit: 4,
  period_type: 'MONTHLY',
  bid_floor_percent: 1,
  bid_ceiling_percent: 25,
}

export default function CirclesPage({ navigate }) {
  const { items, loading, error, hasMore, loadMore, reload } = useCursorList((cursor) => api.listCircles(cursor), [])

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submitCreate = async (e) => {
    e.preventDefault()
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      const payload = {
        circle_name: form.circle_name,
        track_type: form.track_type,
        contribution_amount: Number(form.contribution_amount),
        member_limit: Number(form.member_limit),
        period_type: form.period_type,
      }
      if (form.track_type === 'SPSB') {
        payload.bid_floor_percent = Number(form.bid_floor_percent)
        payload.bid_ceiling_percent = Number(form.bid_ceiling_percent)
      }
      const created = await api.createCircle(payload)
      setNotice(`Circle "${created.circle_name}" dibuat. Kode undangan: ${created.invite_code}`)
      setShowCreate(false)
      setForm(emptyForm)
      reload()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const submitJoin = async (e) => {
    e.preventDefault()
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      const joined = await api.joinCircle(inviteCode.trim())
      setNotice(`Berhasil bergabung ke "${joined.circle_name}".`)
      setInviteCode('')
      reload()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-title">
        <h2>Circle saya</h2>
        <button type="button" className="btn" onClick={() => setShowCreate(true)}>
          + Buat circle
        </button>
      </div>

      <article className="panel">
        <h3>Gabung dengan kode undangan</h3>
        <form className="inline-form mt" onSubmit={submitJoin}>
          <div className="field">
            <label>Kode undangan</label>
            <input placeholder="ARK-XXXXXX" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} />
          </div>
          <button type="submit" className="btn ghost" disabled={busy || !inviteCode}>
            Join
          </button>
        </form>
      </article>

      {notice && <p className="alert ok">{notice}</p>}
      {actionError && <p className="alert error">{actionError}</p>}

      <article className="panel section">
        <div className="panel-head">
          <h3>Daftar circle</h3>
          <span className="tiny">{items.length} circle</span>
        </div>
        {loading && items.length === 0 ? (
          <p className="empty">Memuat…</p>
        ) : error ? (
          <p className="alert error">{error}</p>
        ) : items.length === 0 ? (
          <p className="empty">Belum ada circle.</p>
        ) : (
          items.map((c) => (
            <div key={c.circle_id} className="circle" style={{ cursor: 'pointer' }} onClick={() => navigate({ name: 'circle', circleId: c.circle_id })}>
              <div className="circle-row">
                <div>
                  <div className="circle-name">{c.circle_name}</div>
                  <div className="circle-type">
                    {c.track_type === 'RANDOM_DRAW' ? 'Random draw' : 'SPSB'} · {c.active_member_count}/{c.member_limit} anggota · {c.membership_role}
                  </div>
                </div>
                <div className="circle-amount">
                  {formatIDR(c.contribution_amount)}
                  <div className="status">{c.circle_status}</div>
                </div>
              </div>
              <div className="bar">
                <i style={{ width: `${Math.min(100, (c.active_member_count / c.member_limit) * 100)}%` }} />
              </div>
            </div>
          ))
        )}
        {hasMore && (
          <button type="button" className="btn ghost small mt" onClick={loadMore} disabled={loading}>
            {loading ? 'Memuat…' : 'Muat lebih banyak'}
          </button>
        )}
      </article>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submitCreate}>
            <h3>Buat circle baru</h3>
            <div className="stack">
              <div className="field">
                <label>Nama circle</label>
                <input required autoFocus value={form.circle_name} onChange={set('circle_name')} placeholder="Arisan Keluarga" />
              </div>
              <div className="field">
                <label>Jenis arisan</label>
                <select value={form.track_type} onChange={set('track_type')}>
                  <option value="RANDOM_DRAW">Random Draw</option>
                  <option value="SPSB">SPSB (Sealed-Bid)</option>
                </select>
              </div>
              <div className="row">
                <div className="field grow">
                  <label>Iuran (Rp)</label>
                  <input type="number" min="1000" required value={form.contribution_amount} onChange={set('contribution_amount')} />
                </div>
                <div className="field grow">
                  <label>Kuota anggota</label>
                  <input type="number" min="2" required value={form.member_limit} onChange={set('member_limit')} />
                </div>
              </div>
              {form.track_type === 'SPSB' && (
                <div className="row">
                  <div className="field grow">
                    <label>Bid floor (%)</label>
                    <input type="number" step="0.1" value={form.bid_floor_percent} onChange={set('bid_floor_percent')} />
                  </div>
                  <div className="field grow">
                    <label>Bid ceiling (%)</label>
                    <input type="number" step="0.1" value={form.bid_ceiling_percent} onChange={set('bid_ceiling_percent')} />
                  </div>
                </div>
              )}
              <div className="row">
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? 'Membuat…' : 'Buat circle'}
                </button>
                <button type="button" className="btn ghost" onClick={() => setShowCreate(false)}>
                  Batal
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
