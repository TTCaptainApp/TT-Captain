import { useState } from 'react'
import { supabase } from './supabaseClient'
import Brand from './Brand'

const pageStyle = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F', padding: 20
}
const cardStyle = {
  background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 16,
  padding: '28px 24px', width: '100%', maxWidth: 320,
  display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch'
}
const inputStyle = { padding: '10px 12px', fontSize: 15, borderRadius: 8, border: '1px solid #DCE7E2', fontFamily: 'inherit' }
const buttonStyle = {
  background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 8,
  padding: '11px 0', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4
}
const linkButtonStyle = {
  background: 'none', border: 'none', color: '#1C8A4E', fontSize: 13,
  cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit'
}
const passwortWrapperStyle = { position: 'relative', display: 'flex', alignItems: 'center' }
const augeButtonStyle = {
  position: 'absolute', right: 8, background: 'none', border: 'none',
  cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#5B6F65'
}

function AugeIcon({ offen }) {
  return offen ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-7-11-7a21.6 21.6 0 015.06-6.06M9.9 4.24A10.4 10.4 0 0112 4c7 0 11 7 11 7a21.6 21.6 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [passwortSichtbar, setPasswortSichtbar] = useState(false)
  const [fehler, setFehler] = useState(null)
  const [ladend, setLadend] = useState(false)

  const [zeigeReset, setZeigeReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetNachricht, setResetNachricht] = useState(null)
  const [resetFehler, setResetFehler] = useState(null)
  const [resetLadend, setResetLadend] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFehler(null)
    setLadend(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: passwort })
    setLadend(false)
    if (error) setFehler(error.message)
  }

  const handleResetSubmit = async (e) => {
    e.preventDefault()
    setResetFehler(null)
    setResetNachricht(null)
    setResetLadend(true)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/neues-passwort`
    })
    setResetLadend(false)
    if (error) {
      setResetFehler(error.message)
    } else {
      setResetNachricht('Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen verschickt.')
    }
  }

  if (zeigeReset) {
    return (
      <div style={pageStyle}>
        <form onSubmit={handleResetSubmit} style={cardStyle}>
          <Brand />
          <p style={{ fontSize: 14, margin: '0 0 4px 0', color: '#5B6F65' }}>
            Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link zum Zurücksetzen deines Passworts.
          </p>
          <input
            style={inputStyle}
            type="email"
            placeholder="E-Mail"
            value={resetEmail}
            onChange={e => setResetEmail(e.target.value)}
            required
          />
          {resetFehler && <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{resetFehler}</p>}
          {resetNachricht && <p style={{ color: '#1C8A4E', fontSize: 13, margin: 0 }}>{resetNachricht}</p>}
          <button type="submit" style={buttonStyle} disabled={resetLadend}>
            {resetLadend ? 'Einen Moment...' : 'Link zusenden'}
          </button>
          <button
            type="button"
            style={linkButtonStyle}
            onClick={() => { setZeigeReset(false); setResetFehler(null); setResetNachricht(null) }}
          >
            Zurück zum Login
          </button>
        </form>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <Brand />
        <input style={inputStyle} type="email" placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} required />
        <div style={passwortWrapperStyle}>
          <input
            style={{ ...inputStyle, width: '100%', paddingRight: 36 }}
            type={passwortSichtbar ? 'text' : 'password'}
            placeholder="Passwort"
            value={passwort}
            onChange={e => setPasswort(e.target.value)}
            required
          />
          <button
            type="button"
            style={augeButtonStyle}
            onClick={() => setPasswortSichtbar(v => !v)}
            aria-label={passwortSichtbar ? 'Passwort verbergen' : 'Passwort anzeigen'}
          >
            <AugeIcon offen={passwortSichtbar} />
          </button>
        </div>
        {fehler && <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{fehler}</p>}
        <button type="submit" style={buttonStyle} disabled={ladend}>
          {ladend ? 'Einen Moment...' : 'Einloggen'}
        </button>
        <button
          type="button"
          style={linkButtonStyle}
          onClick={() => setZeigeReset(true)}
        >
          Passwort vergessen?
        </button>
      </form>
    </div>
  )
}

export default Login 
