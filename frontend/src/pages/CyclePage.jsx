import { useState } from 'react'
import api from '@/services/api'
import { useApi, formatIDR, formatDate, formatDateTime, errorMessage } from '@/lib/util'

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `key-${Date.now()}-${Math.random()}`)

export default function CyclePage({ cycleId, circleId, navigate, user }) {
  const [tab, setTab] = useState('Pembayaran')

  const { data, loading, error, reload } = useApi(async () => {
    const [cycle, circle, membersRes, obligationsRes] = await Promise.all([
      api.getCycle(cycleId),
      api.getCircle(circleId),
      api.listMembers(circleId),
      api.listObligations(cycleId),
    ])
    const members = membersRes?.items || []
    const me = members.find((m) => m.user_id === user?.user_id)
    const privileged = me && (me.membership_role === 'OWNER' || me.membership_role === 'ADMIN')

    const isSpsb = circle?.track_type === 'SPSB'
    const [award, proof, myBid] = await Promise.all([
      api.getAward(cycleId).catch(() => null),
      api.getDrawProof(cycleId).catch(() => null),
      isSpsb ? api.getMyBid(cycleId).catch(() => null) : Promise.resolve(null),
    ])

    return {
      cycle,
      circle,
      privileged,
      myRole: me?.membership_role,
      isSpsb,
      obligations: obligationsRes?.items || [],
      award,
      proof,
      myBid,
    }
  }, [cycleId, circleId, user?.user_id])

  if (loading) return <p className="muted">Memuat siklus…</p>
  if (error) return <p className="alert error">{error}</p>

  const c = data.cycle
  const myObligations = data.obligations.filter((o) => o.user_id === user?.user_id)
  const tabs = ['Pembayaran', ...(data.isSpsb ? ['Bidding'] : []), 'Hasil']

  return (
    <>
      <button type="button" className="back" onClick={() => navigate({ name: 'circle', circleId })}>
        ← {data.circle?.circle_name || 'Circle'}
      </button>
      <div className="page-title">
        <div>
          <h2>Siklus #{c.cycle_number}</h2>
          <p className="muted">
            {data.isSpsb ? 'SPSB' : 'Random Draw'} · jatuh tempo {formatDate(c.due_at)} · iuran {formatIDR(data.circle?.contribution_amount)}
          </p>
        </div>
        <span className="badge gold">{c.cycle_status}</span>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Pembayaran' && (
        <PaymentTab obligations={myObligations} reload={reload} isMember={Boolean(data.myRole)} />
      )}
      {tab === 'Bidding' && data.isSpsb && (
        <BiddingTab
          cycle={c}
          circle={data.circle}
          myBid={data.myBid}
          privileged={data.privileged}
          reload={reload}
        />
      )}
      {tab === 'Hasil' && (
        <ResultTab
          cycle={c}
          award={data.award}
          proof={data.proof}
          privileged={data.privileged}
          reload={reload}
        />
      )}
    </>
  )
}

function PaymentTab({ obligations, reload, isMember }) {
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [manualOrder, setManualOrder] = useState(null)
  const [proofUrl, setProofUrl] = useState('')

  const invalidate = () => {
    setMsg('')
    setErr('')
  }

  const payWallet = async (obligationId) => {
    invalidate()
    setBusy(obligationId)
    try {
      const res = await api.payWallet(obligationId, newKey())
      setMsg(`Pembayaran wallet berhasil. Sisa saldo ${formatIDR(res.remaining_balance)}.`)
      reload()
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy('')
    }
  }

  const startManual = async (obligationId) => {
    invalidate()
    setBusy(obligationId)
    try {
      const res = await api.payManual(obligationId, newKey())
      setManualOrder(res)
      setMsg('Pesanan transfer manual dibuat. Unggah bukti transfer di bawah.')
      reload()
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy('')
    }
  }

  const uploadProof = async (e) => {
    e.preventDefault()
    invalidate()
    setBusy('proof')
    try {
      await api.uploadProof(manualOrder.payment_order_id, proofUrl.trim())
      setMsg('Bukti transfer terkirim. Menunggu review owner/admin.')
      setManualOrder(null)
      setProofUrl('')
      reload()
    } catch (e2) {
      setErr(errorMessage(e2))
    } finally {
      setBusy('')
    }
  }

  return (
    <article className="panel">
      <h3>Kewajiban saya</h3>
      {msg && <p className="alert ok">{msg}</p>}
      {err && <p className="alert error">{err}</p>}

      {obligations.length === 0 ? (
        <p className="empty">Tidak ada kewajiban untuk Anda pada siklus ini.</p>
      ) : (
        obligations.map((o) => (
          <div key={o.obligation_id} className="list-item">
            <div>
              <div className="activity-title">{formatIDR(o.amount_due)}</div>
              <div className="activity-sub">Jatuh tempo {formatDate(o.due_at)}</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <span className={`badge ${o.status === 'PAID' ? 'green' : 'gold'}`}>{o.status}</span>
              {o.status !== 'PAID' && isMember && (
                <>
                  <button type="button" className="btn small" disabled={busy === o.obligation_id} onClick={() => payWallet(o.obligation_id)}>
                    {busy === o.obligation_id ? '…' : 'Bayar wallet'}
                  </button>
                  <button type="button" className="btn ghost small" disabled={busy === o.obligation_id} onClick={() => startManual(o.obligation_id)}>
                    Transfer manual
                  </button>
                </>
              )}
            </div>
          </div>
        ))
      )}

      {manualOrder && (
        <form className="inline-form mt" onSubmit={uploadProof}>
          <div className="field grow">
            <label>URL bukti transfer (order {manualOrder.payment_order_id.slice(0, 8)}…)</label>
            <input required placeholder="https://…" value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} />
          </div>
          <button type="submit" className="btn" disabled={busy === 'proof'}>
            Unggah bukti
          </button>
        </form>
      )}
    </article>
  )
}

function BiddingTab({ cycle, circle, myBid, privileged, reload }) {
  const [rate, setRate] = useState(circle?.bid_floor_percent ?? 1)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const open = cycle.cycle_status === 'BIDDING_OPEN'

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setMsg('')
    setBusy(true)
    try {
      await api.submitBid(cycle.cycle_id, Number(rate))
      setMsg('Bid terkirim.')
      reload()
    } catch (e2) {
      setErr(errorMessage(e2))
    } finally {
      setBusy(false)
    }
  }

  const close = async () => {
    setErr('')
    setMsg('')
    setBusy(true)
    try {
      await api.closeBidding(cycle.cycle_id)
      setMsg('Bidding ditutup.')
      reload()
    } catch (e2) {
      setErr(errorMessage(e2))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="panel">
      <h3>Penawaran (SPSB)</h3>
      <p className="muted mt">
        Rentang bid {circle?.bid_floor_percent ?? '-'}% – {circle?.bid_ceiling_percent ?? '-'}%. Pemenang = bid tertinggi; tarif dibayar = bid tertinggi kedua.
      </p>

      {myBid ? (
        <p className="alert ok">Bid Anda: {myBid.bid_rate_percent}%</p>
      ) : (
        <p className="muted">Belum ada bid dari Anda.</p>
      )}
      {err && <p className="alert error">{err}</p>}
      {msg && <p className="alert ok">{msg}</p>}

      <form className="inline-form mt" onSubmit={submit}>
        <div className="field">
          <label>Bid rate (%)</label>
          <input
            type="number"
            step="0.1"
            min={circle?.bid_floor_percent ?? 0}
            max={circle?.bid_ceiling_percent ?? 100}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            disabled={!open}
          />
        </div>
        <button type="submit" className="btn" disabled={busy || !open}>
          Kirim bid
        </button>
        {!open && <span className="tiny">Bidding belum dibuka / sudah ditutup.</span>}
      </form>

      {privileged && open && (
        <button type="button" className="btn ghost mt" disabled={busy} onClick={close}>
          Tutup bidding
        </button>
      )}
    </article>
  )
}

function ResultTab({ cycle, award, proof, privileged, reload }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const resolve = async () => {
    setErr('')
    setBusy(true)
    try {
      await api.resolveAward(cycle.cycle_id)
      reload()
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const canResolve = privileged && cycle.cycle_status === 'READY_FOR_DISBURSEMENT'

  return (
    <>
      <article className="panel">
        <h3>Pemenang siklus</h3>
        {err && <p className="alert error">{err}</p>}
        {award ? (
          <dl className="kv mt">
            <dt>Pemenang</dt>
            <dd>{award.winner_name}</dd>
            <dt>Metode</dt>
            <dd>{award.award_method}</dd>
            <dt>Gross</dt>
            <dd>{formatIDR(award.gross_amount)}</dd>
            {award.winning_bid_rate_percent != null && (
              <>
                <dt>Bid tertinggi</dt>
                <dd>{award.winning_bid_rate_percent}%</dd>
                <dt>Tarif dibayar</dt>
                <dd>{award.payable_bid_rate_percent}%</dd>
              </>
            )}
            <dt>Diputuskan</dt>
            <dd>{formatDateTime(award.decided_at)}</dd>
            <dt>Decision hash</dt>
            <dd>
              <span className="code">{award.decision_hash}</span>
            </dd>
          </dl>
        ) : (
          <p className="empty">Belum ada pemenang untuk siklus ini.</p>
        )}

        {privileged && (
          <button type="button" className="btn mt" disabled={busy || !canResolve} onClick={resolve}>
            {busy ? 'Memproses…' : 'Tentukan pemenang & cairkan'}
          </button>
        )}
        {privileged && !canResolve && !award && (
          <p className="tiny mt">Tombol aktif saat siklus berstatus READY_FOR_DISBURSEMENT.</p>
        )}
      </article>

      <article className="panel section">
        <h3>Bukti random draw</h3>
        {proof ? (
          <dl className="kv mt">
            <dt>Algoritma</dt>
            <dd>{proof.algorithm_version}</dd>
            <dt>Sumber acak</dt>
            <dd>{proof.random_source}</dd>
            <dt>Commitment</dt>
            <dd>
              <span className="code">{proof.random_seed_commitment}</span>
            </dd>
            {proof.random_seed_reveal && (
              <>
                <dt>Reveal</dt>
                <dd>
                  <span className="code">{proof.random_seed_reveal}</span>
                </dd>
              </>
            )}
            {proof.participant_snapshot_hash && (
              <>
                <dt>Snapshot hash</dt>
                <dd>
                  <span className="code">{proof.participant_snapshot_hash}</span>
                </dd>
              </>
            )}
            <dt>Jumlah peserta</dt>
            <dd>{proof.participant_count}</dd>
          </dl>
        ) : (
          <p className="empty">Bukti draw belum tersedia (hanya untuk Random Draw).</p>
        )}
      </article>
    </>
  )
}
