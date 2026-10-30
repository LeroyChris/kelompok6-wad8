import { useMemo, useState } from 'react'
import api from '@/services/api'
import { useApi, formatIDR, formatDate, errorMessage, initials } from '@/lib/util'

const TABS = ['Ringkasan', 'Anggota', 'Siklus', 'Undangan', 'Pembayaran']

export default function CircleDetailPage({ circleId, navigate, user }) {
  const [tab, setTab] = useState('Ringkasan')

  const { data, loading, error, reload } = useApi(async () => {
    const [detail, membersRes, cyclesRes] = await Promise.all([
      api.getCircle(circleId),
      api.listMembers(circleId),
      api.listCycles(circleId),
    ])
    const members = membersRes?.items || []
    const me = members.find((m) => m.user_id === user?.user_id)
    const privileged = me && (me.membership_role === 'OWNER' || me.membership_role === 'ADMIN')

    let invitations = []
    let matrix = []
    let proofs = []
    if (privileged) {
      const [inv, mx, pf] = await Promise.all([
        api.listInvitations(circleId).catch(() => ({ items: [] })),
        api.getPaymentMatrix(circleId).catch(() => ({ items: [] })),
        api.listPaymentProofs(circleId, 'PENDING').catch(() => ({ items: [] })),
      ])
      invitations = inv?.items || []
      matrix = mx?.items || []
      proofs = pf?.items || []
    }
    return { detail, members, cycles: cyclesRes?.items || [], myRole: me?.membership_role, privileged, invitations, matrix, proofs }
  }, [circleId, user?.user_id])

  if (loading) return <p className="muted">Memuat circle…</p>
  if (error) return <p className="alert error">{error}</p>

  const d = data.detail
  const isOwner = data.myRole === 'OWNER'
  const isMember = Boolean(data.myRole)

  return (
    <>
      <button type="button" className="back" onClick={() => navigate({ name: 'circles' })}>
        ← Semua circle
      </button>
      <div className="page-title">
        <div>
          <h2>{d.circle_name}</h2>
          <p className="muted">
            {d.track_type === 'RANDOM_DRAW' ? 'Random Draw' : 'SPSB'} · {d.active_member_count}/{d.member_limit} anggota · {d.period_type}
          </p>
        </div>
        <span className="badge green">{d.circle_status}</span>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Ringkasan' && (
        <SummaryTab
          d={d}
          data={data}
          circleId={circleId}
          isOwner={isOwner}
          isMember={isMember}
          navigate={navigate}
          reload={reload}
        />
      )}
      {tab === 'Anggota' && <MembersTab data={data} circleId={circleId} isOwner={isOwner} reload={reload} />}
      {tab === 'Siklus' && <CyclesTab data={data} circleId={circleId} isOwner={isOwner} navigate={navigate} reload={reload} />}
      {tab === 'Undangan' && <InvitationsTab data={data} circleId={circleId} reload={reload} />}
      {tab === 'Pembayaran' && <PaymentsTab data={data} reload={reload} />}
    </>
  )
}

function SummaryTab({ d, data, circleId, isOwner, isMember, navigate, reload }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [name, setName] = useState(d.circle_name)

  const act = async (fn, ok) => {
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      await fn()
      setMsg(ok)
      reload()
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="lower">
      <article className="panel">
        <h3>Informasi circle</h3>
        <dl className="kv mt">
          <dt>Status</dt>
          <dd>{d.circle_status}</dd>
          <dt>Iuran</dt>
          <dd>{formatIDR(d.contribution_amount)}</dd>
          <dt>Kuota</dt>
          <dd>
            {d.active_member_count}/{d.member_limit}
          </dd>
          <dt>Peran saya</dt>
          <dd>{data.myRole || 'Bukan anggota'}</dd>
          {d.track_type === 'SPSB' && (
            <>
              <dt>Bid floor</dt>
              <dd>{d.bid_floor_percent ?? '-'}%</dd>
              <dt>Bid ceiling</dt>
              <dd>{d.bid_ceiling_percent ?? '-'}%</dd>
            </>
          )}
          {d.invite_code && (
            <>
              <dt>Kode undangan aktif</dt>
              <dd>
                <span className="code">{d.invite_code}</span>
              </dd>
            </>
          )}
        </dl>
      </article>

      <article className="panel">
        <h3>Aksi</h3>
        {isOwner && (
          <div className="stack mt">
            <div className="inline-form">
              <div className="field grow">
                <label>Ubah nama</label>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <button
                type="button"
                className="btn ghost"
                disabled={busy || name === d.circle_name}
                onClick={() => act(() => api.updateCircle(circleId, name), 'Nama circle diperbarui.')}
              >
                Simpan
              </button>
            </div>
            {d.circle_status === 'RECRUITING' && (
              <button
                type="button"
                className="btn"
                disabled={busy || d.active_member_count < d.member_limit}
                onClick={() => act(() => api.lockCircle(circleId), 'Circle dikunci.')}
              >
                Kunci circle {d.active_member_count < d.member_limit ? `(butuh ${d.member_limit} anggota)` : ''}
              </button>
            )}
          </div>
        )}
        {isMember && !isOwner && (
          <button
            type="button"
            className="btn danger mt"
            disabled={busy}
            onClick={() => act(async () => {
              await api.leaveCircle(circleId)
              navigate({ name: 'circles' })
            }, 'Keluar dari circle.')}
          >
            Keluar dari circle
          </button>
        )}
        {msg && <p className="alert ok">{msg}</p>}
        {err && <p className="alert error">{err}</p>}
      </article>
    </section>
  )
}

function MembersTab({ data, circleId, isOwner, reload }) {
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  const patch = async (userId, body) => {
    setBusy(userId)
    setErr('')
    try {
      await api.updateMember(circleId, userId, body)
      reload()
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <article className="panel">
      <h3>Anggota ({data.members.length})</h3>
      {err && <p className="alert error">{err}</p>}
      <table className="data mt">
        <thead>
          <tr>
            <th>Nama</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            {isOwner && <th>Aksi</th>}
          </tr>
        </thead>
        <tbody>
          {data.members.map((m) => (
            <tr key={m.circle_membership_id}>
              <td>
                <div className="row" style={{ gap: 8 }}>
                  <span className="round">{initials(m.full_name)}</span>
                  {m.full_name}
                </div>
              </td>
              <td className="muted">{m.email}</td>
              <td>
                <span className="badge blue">{m.membership_role}</span>
              </td>
              <td>
                <span className={`badge ${m.membership_status === 'ACTIVE' ? 'green' : 'red'}`}>{m.membership_status}</span>
              </td>
              {isOwner && (
                <td>
                  {m.membership_role !== 'OWNER' && (
                    <div className="row" style={{ gap: 6 }}>
                      <button
                        type="button"
                        className="btn ghost small"
                        disabled={busy === m.user_id}
                        onClick={() => patch(m.user_id, { role: m.membership_role === 'ADMIN' ? 'MEMBER' : 'ADMIN' })}
                      >
                        {m.membership_role === 'ADMIN' ? 'Jadikan Member' : 'Jadikan Admin'}
                      </button>
                      <button
                        type="button"
                        className="btn danger small"
                        disabled={busy === m.user_id}
                        onClick={() => patch(m.user_id, { status: m.membership_status === 'ACTIVE' ? 'REMOVED' : 'ACTIVE' })}
                      >
                        {m.membership_status === 'ACTIVE' ? 'Keluarkan' : 'Aktifkan'}
                      </button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  )
}

function CyclesTab({ data, circleId, isOwner, navigate, reload }) {
  const nextNumber = useMemo(() => {
    const max = data.cycles.reduce((acc, c) => Math.max(acc, c.cycle_number || 0), 0)
    return max + 1
  }, [data.cycles])
  const [number, setNumber] = useState(nextNumber)
  const [dueAt, setDueAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const create = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api.createCycle(circleId, {
        cycle_number: Number(number),
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
      })
      reload()
    } catch (error) {
      setErr(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {isOwner && (
        <article className="panel">
          <h3>Buka siklus baru</h3>
          {data.detail.circle_status === 'LOCKED' || data.detail.circle_status === 'RUNNING' ? (
            <form className="inline-form mt" onSubmit={create}>
              <div className="field">
                <label>Nomor siklus</label>
                <input type="number" min="1" value={number} onChange={(e) => setNumber(e.target.value)} />
              </div>
              <div className="field">
                <label>Jatuh tempo</label>
                <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </div>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? 'Membuka…' : 'Buka siklus'}
              </button>
            </form>
          ) : (
            <p className="muted mt">Circle harus LOCKED sebelum siklus dapat dibuka.</p>
          )}
          {err && <p className="alert error">{err}</p>}
        </article>
      )}

      <article className="panel section">
        <h3>Siklus</h3>
        {data.cycles.length === 0 ? (
          <p className="empty">Belum ada siklus.</p>
        ) : (
          <div className="mt">
            {data.cycles.map((c) => (
              <div key={c.cycle_id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => navigate({ name: 'cycle', cycleId: c.cycle_id, circleId })}>
                <div>
                  <div className="activity-title">Siklus #{c.cycle_number}</div>
                  <div className="activity-sub">Jatuh tempo {formatDate(c.due_at)}</div>
                </div>
                <span className="badge gold">{c.cycle_status}</span>
              </div>
            ))}
          </div>
        )}
      </article>
    </>
  )
}

function InvitationsTab({ data, circleId, reload }) {
  const [days, setDays] = useState(14)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const create = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api.createInvitation(circleId, Number(days))
      reload()
    } catch (error) {
      setErr(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="panel">
      <div className="panel-head">
        <h3>Undangan</h3>
        <form className="inline-form" onSubmit={create}>
          <div className="field">
            <label>Berlaku (hari)</label>
            <input type="number" min="1" max="30" style={{ width: 90 }} value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <button type="submit" className="btn small" disabled={busy}>
            Buat kode
          </button>
        </form>
      </div>
      {err && <p className="alert error">{err}</p>}
      <table className="data mt">
        <thead>
          <tr>
            <th>Kode</th>
            <th>Status</th>
            <th>Kedaluwarsa</th>
          </tr>
        </thead>
        <tbody>
          {data.invitations.map((inv) => (
            <tr key={inv.invitation_id}>
              <td>
                <span className="code">{inv.invite_code}</span>
              </td>
              <td>
                <span className={`badge ${inv.invitation_status === 'ACTIVE' ? 'green' : 'gray'}`}>{inv.invitation_status}</span>
              </td>
              <td className="muted">{formatDate(inv.expires_at)}</td>
            </tr>
          ))}
          {data.invitations.length === 0 && (
            <tr>
              <td colSpan="3" className="empty">
                Belum ada undangan.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </article>
  )
}

function PaymentsTab({ data, reload }) {
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  const review = async (proofId, status) => {
    setBusy(proofId)
    setErr('')
    try {
      await api.reviewProof(proofId, status)
      reload()
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <article className="panel">
        <h3>Bukti transfer menunggu review</h3>
        {err && <p className="alert error">{err}</p>}
        {data.proofs.length === 0 ? (
          <p className="empty">Tidak ada bukti menunggu review.</p>
        ) : (
          data.proofs.map((p) => (
            <div key={p.payment_proof_id} className="list-item">
              <div>
                <div className="activity-title">
                  {p.full_name} · {formatIDR(p.amount)}
                </div>
                <a className="activity-sub" href={p.proof_url} target="_blank" rel="noreferrer">
                  {p.proof_url}
                </a>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button type="button" className="btn small" disabled={busy === p.payment_proof_id} onClick={() => review(p.payment_proof_id, 'APPROVED')}>
                  Approve
                </button>
                <button type="button" className="btn danger small" disabled={busy === p.payment_proof_id} onClick={() => review(p.payment_proof_id, 'REJECTED')}>
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </article>

      <article className="panel section">
        <h3>Matriks iuran</h3>
        <table className="data mt">
          <thead>
            <tr>
              <th>Anggota</th>
              <th>Siklus</th>
              <th>Nominal</th>
              <th>Status</th>
              <th>Metode</th>
            </tr>
          </thead>
          <tbody>
            {data.matrix.map((o) => (
              <tr key={o.obligation_id}>
                <td>{o.full_name}</td>
                <td>#{o.cycle_number}</td>
                <td>{formatIDR(o.amount_due)}</td>
                <td>
                  <span className={`badge ${o.obligation_status === 'PAID' ? 'green' : 'gold'}`}>{o.obligation_status}</span>
                </td>
                <td className="muted">{o.payment_method || '-'}</td>
              </tr>
            ))}
            {data.matrix.length === 0 && (
              <tr>
                <td colSpan="5" className="empty">
                  Belum ada tagihan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </>
  )
}
