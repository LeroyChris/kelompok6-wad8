import { useState } from 'react'
import api from '@/services/api'
import { useApi, formatIDR, formatDate, formatDateTime, errorMessage } from '@/lib/util'

export default function ProfilePage({ user, onUserUpdate }) {
  const { data, loading, error, reload } = useApi(async () => {
    const [profile, reputation, wins] = await Promise.all([
      api.getMe(),
      api.getReputation().catch(() => null),
      api.getWinHistory().catch(() => []),
    ])
    return { profile, reputation, wins: wins || [] }
  }, [])

  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    setErr('')
    try {
      const updated = await api.updateProfile((name || data.profile.full_name).trim())
      onUserUpdate?.({ ...user, full_name: updated.full_name })
      setMsg('Profil diperbarui.')
      reload()
    } catch (e2) {
      setErr(errorMessage(e2))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="muted">Memuat profil…</p>
  if (error) return <p className="alert error">{error}</p>

  const p = data.profile
  const rep = data.reputation

  return (
    <>
      <div className="page-title">
        <h2>Profil</h2>
      </div>

      <section className="lower">
        <article className="panel">
          <h3>Akun</h3>
          <form className="stack mt" onSubmit={save}>
            <div className="field">
              <label>Nama lengkap</label>
              <input defaultValue={p.full_name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>Email</label>
              <input value={p.email} disabled />
            </div>
            <div className="field">
              <label>Terdaftar sejak</label>
              <input value={formatDate(p.created_at)} disabled />
            </div>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan perubahan'}
            </button>
          </form>
          {msg && <p className="alert ok">{msg}</p>}
          {err && <p className="alert error">{err}</p>}
        </article>

        <article className="panel">
          <h3>Reputasi</h3>
          {rep ? (
            <dl className="kv mt">
              <dt>Status</dt>
              <dd>{rep.status}</dd>
              <dt>Reliability</dt>
              <dd>{rep.reliability_rate_percentage}%</dd>
              <dt>Skor</dt>
              <dd>{rep.reputation_score}</dd>
              <dt>Lunas</dt>
              <dd>{rep.total_paid_obligations}</dd>
              <dt>Terlambat</dt>
              <dd>{rep.total_late_obligations}</dd>
              <dt>Total menang</dt>
              <dd>
                {p.total_wins} · {formatIDR(p.total_win_amount)}
              </dd>
            </dl>
          ) : (
            <p className="empty">Data reputasi belum tersedia.</p>
          )}
        </article>
      </section>

      <article className="panel section">
        <h3>Riwayat kemenangan</h3>
        {data.wins.length === 0 ? (
          <p className="empty">Belum ada kemenangan.</p>
        ) : (
          <table className="data mt">
            <thead>
              <tr>
                <th>Circle</th>
                <th>Siklus</th>
                <th>Metode</th>
                <th>Nominal</th>
                <th>Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {data.wins.map((w) => (
                <tr key={w.award_id}>
                  <td>{w.circle_name}</td>
                  <td>#{w.round_number}</td>
                  <td>
                    <span className="badge blue">{w.award_method}</span>
                  </td>
                  <td className="amount pos">{formatIDR(w.awarded_amount)}</td>
                  <td className="muted">{formatDateTime(w.won_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </>
  )
}
