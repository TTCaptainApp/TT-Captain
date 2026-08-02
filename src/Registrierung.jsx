import { useState } from 'react'
import { supabase } from './supabaseClient'

const pageStyle = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', fontFamily: 'sans-serif', background: '#F6FAF8',
  color: '#16261F', padding: '20px', textAlign: 'center'
}
const buttonStyle = {
  background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 8,
  padding: '10px 0', fontSize: 15, cursor: 'pointer'
}

function Registrierung({ inviteCode }) {
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [email, setEmail] = useState('')
  const [emailWiederholung, setEmailWiederholung] = useState('')
  const [telefonnummer, setTelefonnummer] = useState('')
  const [passwort, setPasswort] = useState('')
  const [passwortWiederholung, setPasswortWiederholung] = useState('')
  const [datenschutz, setDatenschutz] = useState(false)
  const [nutzungsbedingungen, setNutzungsbedingungen] = useState(false)
  const [fehler, setFehler] = useState(null)
  const [ladend, setLadend] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFehler(null)

    if (!datenschutz || !nutzungsbedingungen) {
      setFehler('Bitte Datenschutz und Nutzungsbedingungen akzeptieren.')
      return
    }

    if (email.trim().toLowerCase() !== emailWiederholung.trim().toLowerCase()) {
      setFehler('Die beiden E-Mail-Adressen stimmen nicht überein.')
      return
    }

    if (passwort !== passwortWiederholung) {
      setFehler('Die beiden Passwörter stimmen nicht überein.')
      return
    }

    setLadend(true)
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: passwort,
      options: {
        data: { vorname, nachname, telefonnummer, invite_code: inviteCode }
      }
    })
    setLadend(false)

    if (error) {
      setFehler(error.message)
      return
    }
    // Kein Bestätigungs-Schritt nötig - App.jsx erkennt die neue Sitzung automatisch
    // und zeigt das Dashboard.
  }

  return (
    <div style={pageStyle}>
      <h1>Willkommen bei TT Captain</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 340 }}>
        <input placeholder="Vorname" value={vorname} onChange={e => setVorname(e.target.value)} required />
        <input placeholder="Nachname" value={nachname} onChange={e => setNachname(e.target.value)} required />
        <input type="email" placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="email" placeholder="E-Mail wiederholen" value={emailWiederholung} onChange={e => setEmailWiederholung(e.target.value)} required />
        <input placeholder="Telefonnummer (optional)" value={telefonnummer} onChange={e => setTelefonnummer(e.target.value)} />
        <input type="password" placeholder="Passwort" value={passwort} onChange={e => setPasswort(e.target.value)} required minLength={6} />
        <input type="password" placeholder="Passwort wiederholen" value={passwortWiederholung} onChange={e => setPasswortWiederholung(e.target.value)} required minLength={6} />
        <label style={{ fontSize: 13, textAlign: 'left' }}>
          <input type="checkbox" checked={datenschutz} onChange={e => setDatenschutz(e.target.checked)} />{' '}
          Ich akzeptiere die <a href="/datenschutz.html" target="_blank" rel="noreferrer">Datenschutzerklärung</a>
        </label>
        <label style={{ fontSize: 13, textAlign: 'left' }}>
          <input type="checkbox" checked={nutzungsbedingungen} onChange={e => setNutzungsbedingungen(e.target.checked)} />{' '}
          Ich akzeptiere die <a href="/nutzungsbedingungen.html" target="_blank" rel="noreferrer">Nutzungsbedingungen</a>
        </label>
        {fehler && <p style={{ color: '#c0392b' }}>{fehler}</p>}
        <button type="submit" style={buttonStyle} disabled={ladend}>
          {ladend ? 'Einen Moment...' : 'Registrieren'}
        </button>
      </form>
    </div>
  )
}

export default Registrierung 
