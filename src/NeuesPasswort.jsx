import { useState, useEffect } from 'react'
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

function NeuesPasswort() {
  const [bereit, setBereit] = useState(false)
  const [passwort, setPasswort] = useState('')
  const [passwortWiederholt, setPasswortWiederholt] = useState('')
  const [passwortSichtbar, setPasswortSichtbar] = useState(false)
  const [fehler, setFehler] = useState(null)
  const [erfolg, setErfolg] = useState(false)
  const [ladend, setLadend] = useState(false)

  // Supabase setzt beim Klick auf den Reset-Link automatisch eine Session
  // (PASSWORD_RECOVERY-Event). Erst wenn diese Session da ist, darf das
  // Formular zur Passwort-Änderung angezeigt werden.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setBereit(true)
      }
    })
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setBereit(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFehler(null)
    if (passwort !== passwortWiederholt) {
      setFehler('Die Passwörter stimmen nicht überein.')
      return
    }
    if (passwort.length < 6) {
      setFehler('Das Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }
    setLadend(true)
    const { error } = await supabase.auth.updateUser({ password: passwort })
    setLadend(false)
    if (error) {
      setFehler(error.message)
    } else {
      setErfolg(true)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <Brand />
        {!bereit && !erfolg && (
          <p style={{ fontSize: 14, color: '#5B6F65', margin: 0 }}>
            Link wird geprüft...
          </p>
        )}
        {bereit && !erfolg && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 14, color: '#5B6F65', margin: 0 }}>
              Neues Passwort festlegen:
            </p>
            <div style={passwortWrapperStyle}>
              <input
                style={{ ...inputStyle, width: '100%', paddingRight: 36 }}
                type={passwortSichtbar ? 'text' : 'password'}
                placeholder="Neues Passwort"
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
            <input
              style={inputStyle}
              type={passwortSichtbar ? 'text' : 'password'}
              placeholder="Neues Passwort wiederholen"
              value={passwortWiederholt}
              onChange={e => setPasswortWiederholt(e.target.value)}
              required
            />
            {fehler && <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{fehler}</p>}
            <button type="submit" style={buttonStyle} disabled={ladend}>
              {ladend ? 'Einen Moment...' : 'Passwort speichern'}
            </button>
          </form>
        )}
        {erfolg && (
          <>
            <p style={{ color: '#1C8A4E', fontSize: 14, margin: 0 }}>
              Dein Passwort wurde geändert. Du kannst dich jetzt einloggen.
            </p>
            <a href="/" style={{ ...buttonStyle, textDecoration: 'none', textAlign: 'center', display: 'block' }}>
              Zum Login
            </a>
          </>
        )}
      </div>
    </div>
  )
}

export default NeuesPasswort
