import { useState } from 'react'
import api from '@/services/api'
import { useApi, useCursorList, formatIDR, formatDateTime, errorMessage } from '@/lib/util'

export default function WalletPage() {
  const [tab, setTab] = useState('Mutasi')
  const wallet = useApi(() => api.getWallet().catch(() => ({ balance: 0 })), [])
  const tx = useCursorList((cursor) => api.getWalletTransactions(cursor), [])

  return (
    <>
      <div className="page-title">
        <h2>Dompet</h2>
      </div>

      <section className="metrics">
        <article className="metric wallet">
          <div className="metric-head">
            <span>Saldo tersedia</span>
            <span className="metric-icon">▣</span>
          </div>
          <div className="metric-value">{formatIDR(wallet.data?.balance || 0)}</div>
          <div className="metric-sub">Wallet sandbox</div>
        </article>
        <article className="metric">
          <div className="metric-head">
            <span>Top-up demo</span>
            <span className="metric-icon">↗</span>
          </div>
          <TopUp onDone={wallet.reload} />
        </article>
      </section>

      <div className="tabs mt">
        {['Mutasi', 'Rekening bank'].map((t) => (
          <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Mutasi' ? <Transactions tx={tx} /> : <BankAccounts />}
    </>
  )
}

function TopUp({ onDone }) {
  const [amount, setAmount] = useState(500000)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const res = await api.topUp(Number(amount))
      setMsg(`Top-up berhasil. Saldo baru ${formatIDR(res.new_balance)}.`)
      onDone()
    } catch (e2) {
      setErr(errorMessage(e2))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt">
      <div className="inline-form">
        <div className="field grow">
          <label>Nominal (Rp)</label>
          <input type="number" min="1000" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <button type="submit" className="btn ghost small" disabled={busy}>
          Top-up
        </button>
      </div>
      {msg && <p className="alert ok">{msg}</p>}
      {err && <p className="alert error">{err}</p>}
    </form>
  )
}

function Transactions({ tx }) {
  return (
    <article className="panel">
      <h3>Riwayat transaksi</h3>
      {tx.loading && tx.items.length === 0 ? (
        <p className="empty">Memuat…</p>
      ) : tx.error ? (
        <p className="alert error">{tx.error}</p>
      ) : tx.items.length === 0 ? (
        <p className="empty">Belum ada transaksi.</p>
      ) : (
        <table className="data mt">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Jenis</th>
              <th>Keterangan</th>
              <th>Nominal</th>
            </tr>
          </thead>
          <tbody>
            {tx.items.map((t) => (
              <tr key={t.id}>
                <td className="muted">{formatDateTime(t.created_at)}</td>
                <td>
                  <span className={`badge ${t.mutation_type === 'CREDIT' ? 'green' : 'red'}`}>{t.transaction_type}</span>
                </td>
                <td>{t.description}</td>
                <td className={t.mutation_type === 'CREDIT' ? 'amount pos' : 'amount neg'}>
                  {t.mutation_type === 'CREDIT' ? '+' : '-'}
                  {formatIDR(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tx.hasMore && (
        <button type="button" className="btn ghost small mt" onClick={tx.loadMore} disabled={tx.loading}>
          {tx.loading ? 'Memuat…' : 'Muat lebih banyak'}
        </button>
      )}
    </article>
  )
}

function BankAccounts() {
  const { data, loading, error, reload } = useApi(() => api.getBankAccounts(), [])
  const [form, setForm] = useState({ bank_name: '', account_number: '', account_holder: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api.addBankAccount({ ...form, is_primary: false })
      setForm({ bank_name: '', account_number: '', account_holder: '' })
      reload()
    } catch (e2) {
      setErr(errorMessage(e2))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    setErr('')
    try {
      await api.deleteBankAccount(id)
      reload()
    } catch (e2) {
      setErr(errorMessage(e2))
    }
  }

  return (
    <>
      <article className="panel">
        <h3>Tambah rekening sandbox</h3>
        <form className="inline-form mt" onSubmit={add}>
          <div className="field">
            <label>Bank</label>
            <input required value={form.bank_name} onChange={set('bank_name')} placeholder="BCA" />
          </div>
          <div className="field">
            <label>Nomor rekening</label>
            <input required value={form.account_number} onChange={set('account_number')} placeholder="1234567890" />
          </div>
          <div className="field">
            <label>Nama pemilik</label>
            <input required value={form.account_holder} onChange={set('account_holder')} placeholder="Nama Anda" />
          </div>
          <button type="submit" className="btn" disabled={busy}>
            Tambah
          </button>
        </form>
      </article>

      <article className="panel section">
        <h3>Rekening tersimpan</h3>
        {err && <p className="alert error">{err}</p>}
        {loading ? (
          <p className="empty">Memuat…</p>
        ) : error ? (
          <p className="alert error">{error}</p>
        ) : (data || []).length === 0 ? (
          <p className="empty">Belum ada rekening.</p>
        ) : (
          <table className="data mt">
            <thead>
              <tr>
                <th>Bank</th>
                <th>Nomor</th>
                <th>Pemilik</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td>{a.bank_name}</td>
                  <td className="code">{a.account_number}</td>
                  <td>{a.account_holder}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn danger small" onClick={() => remove(a.id)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </>
  )
}
