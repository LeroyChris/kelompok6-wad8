import { useState } from 'react'
import api from '@/services/api'
import { errorMessage } from '@/lib/util'

const DEMO_EMAILS = ['tiara@arisankita.id', 'abda@arisankita.id', 'leroy@arisankita.id', 'nadia@arisankita.id']

const Brand = () => (
  <div className="brand">
    <div className="brand-mark">◎</div>
    <div>
      <div className="brand-name">ArisanKita</div>
      <div className="brand-sub">Shared savings</div>
    </div>
  </div>
)

export default function AuthPage({ onAuthenticated }) {
  const [step, setStep] = useState('email') // 'email' | 'code'
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const sendCode = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await api.requestOTP(email.trim())
      setStep('code')
      setNotice('Kode OTP dikirim. Untuk lingkungan sandbox gunakan 123456.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const verify = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { user } = await api.verifyOTP(email.trim(), otp.trim())
      onAuthenticated(user)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <section className="auth-hero">
        <Brand />
        <div className="hero-copy">
          <div className="eyebrow">Money works better together</div>
          <h1>Build a safer future, together.</h1>
          <p>A calmer way for families and friends to save, contribute, and reach goals together.</p>
        </div>
        <div className="hero-foot">
          <span>Trusted shared savings</span>
          <span>Protected by ArisanKita</span>
        </div>
      </section>

      <section className="auth-form">
        <div className="auth-box">
          <div style={{ marginBottom: '40px' }}>
            <Brand />
          </div>

          {step === 'email' ? (
            <form onSubmit={sendCode}>
              <div className="welcome">
                <div className="green-text">Welcome back</div>
                <h2>Sign in securely.</h2>
                <p>Masukkan email terdaftar untuk menerima kode verifikasi (OTP).</p>
              </div>
              <div className="fields">
                <div className="field">
                  <label>Email address</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button type="submit" className="primary" disabled={busy || !email}>
                  {busy ? 'Mengirim…' : 'Kirim kode'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={verify}>
              <div className="welcome">
                <div className="green-text">Verification</div>
                <h2>Enter your code.</h2>
                <p>
                  Kode dikirim ke <strong>{email}</strong>.
                </p>
              </div>
              <div className="fields">
                <div className="field">
                  <label>Verification code</label>
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <button type="submit" className="primary" disabled={busy || otp.length < 6}>
                  {busy ? 'Memverifikasi…' : 'Verify and continue'}
                </button>
                <button type="button" className="link" onClick={() => setStep('email')}>
                  Ganti email
                </button>
              </div>
            </form>
          )}

          {notice && <p className="alert ok">{notice}</p>}
          {error && <p className="alert error">{error}</p>}

          <div className="secure" style={{ marginTop: '24px' }}>
            <strong>Akun demo</strong>
            {DEMO_EMAILS.map((e) => (
              <button key={e} type="button" className="link" style={{ marginRight: '10px' }} onClick={() => setEmail(e)}>
                {e}
              </button>
            ))}
            <div style={{ marginTop: '6px' }}>OTP sandbox: 123456</div>
          </div>
        </div>
      </section>
    </div>
  )
}
