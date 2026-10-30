import api from '@/services/api'
import { useApi, formatIDR, formatDate } from '@/lib/util'

export default function OverviewPage({ navigate, user }) {
  const { data, loading, error, reload } = useApi(async () => {
    const [wallet, reputation, circles, tx] = await Promise.all([
      api.getWallet().catch(() => ({ balance: 0 })),
      api.getReputation().catch(() => null),
      api.listCircles(),
      api.getWalletTransactions().catch(() => ({ items: [] })),
    ])
    return {
      wallet,
      reputation,
      circles: circles?.items || [],
      tx: (tx?.items || []).slice(0, 5),
    }
  }, [])

  if (loading) return <p className="muted">Memuat ringkasan…</p>
  if (error) return <p className="alert error">{error}</p>

  const circles = data?.circles || []
  const balance = data?.wallet?.balance || 0
  const reliability = data?.reputation?.reliability_rate_percentage

  return (
    <>
      <div className="headline">
        <div>
          <h2>
            Selamat datang, {(user?.full_name || 'Anggota').split(' ')[0]}
            <span>.</span>
          </h2>
          <p>Ringkasan tabungan bersama Anda hari ini.</p>
        </div>
        <button type="button" className="btn" onClick={() => navigate({ name: 'circles' })}>
          + Buat / gabung circle
        </button>
      </div>

      <section className="metrics">
        <article className="metric wallet">
          <div className="metric-head">
            <span>Saldo dompet</span>
            <span className="metric-icon">▣</span>
          </div>
          <div className="metric-value">{formatIDR(balance)}</div>
          <button type="button" className="btn ghost small" style={{ marginTop: '18px' }} onClick={() => navigate({ name: 'wallet' })}>
            Buka dompet
          </button>
        </article>

        <article className="metric">
          <div className="metric-head">
            <span>Circle aktif</span>
            <span className="metric-icon">▦</span>
          </div>
          <div className="metric-value">{circles.length}</div>
          <div className="metric-sub">Terdaftar sebagai anggota</div>
        </article>

        <article className="metric">
          <div className="metric-head">
            <span>Reliability</span>
            <span className="metric-icon">✦</span>
          </div>
          <div className="metric-value">{reliability != null ? `${reliability}%` : '-'}</div>
          <div className="metric-sub">{data?.reputation?.status || 'Belum ada data'}</div>
          <div className="bar">
            <i style={{ width: `${Math.min(100, Number(reliability || 0))}%` }} />
          </div>
        </article>
      </section>

      <section className="lower">
        <article className="panel">
          <div className="panel-head">
            <h3>Circle Anda</h3>
            <button type="button" className="link" onClick={() => navigate({ name: 'circles' })}>
              Lihat semua
            </button>
          </div>
          {circles.length === 0 ? (
            <p className="empty">Belum ada circle. Buat atau gabung circle pertama Anda.</p>
          ) : (
            circles.slice(0, 4).map((c) => (
              <div
                key={c.circle_id}
                className="circle"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate({ name: 'circle', circleId: c.circle_id })}
              >
                <div className="circle-row">
                  <div>
                    <div className="circle-name">{c.circle_name}</div>
                    <div className="circle-type">
                      {c.track_type === 'RANDOM_DRAW' ? 'Random draw' : 'SPSB'} · {c.active_member_count}/{c.member_limit} anggota
                    </div>
                  </div>
                  <div className="circle-amount">
                    {formatIDR(c.contribution_amount)}
                    <div className="status">{c.circle_status}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </article>

        <article className="panel">
          <div className="panel-head">
            <h3>Aktivitas terakhir</h3>
            <button type="button" className="link" onClick={() => navigate({ name: 'wallet' })}>
              Dompet
            </button>
          </div>
          {(data?.tx || []).length === 0 ? (
            <p className="empty">Belum ada transaksi dompet.</p>
          ) : (
            data.tx.map((t) => (
              <div key={t.id} className="activity">
                <div className="activity-left">
                  <span className="activity-icon">{t.mutation_type === 'CREDIT' ? '↓' : '↑'}</span>
                  <div>
                    <div className="activity-title">{t.description || t.transaction_type}</div>
                    <div className="activity-sub">{formatDate(t.created_at)}</div>
                  </div>
                </div>
                <div className={t.mutation_type === 'CREDIT' ? 'amount pos' : 'amount neg'}>
                  {t.mutation_type === 'CREDIT' ? '+' : '-'}
                  {formatIDR(t.amount)}
                </div>
              </div>
            ))
          )}
          <button type="button" className="btn ghost small mt" onClick={reload}>
            Muat ulang
          </button>
        </article>
      </section>
    </>
  )
}
