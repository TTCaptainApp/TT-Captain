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
  const [telefonnummer, setTelefonnummer] = useState('')
  const [passwort, setPasswort] = useState('')
  const [datenschutz, setDatenschutz] = useState(false)
  const [nutzungsbedingungen, setNutzungsbedingungen] = useState(false)
  const [status, setStatus] = useState(null)
  const [fehler, setFehler] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFehler(null)

    if (!datenschutz || !nutzungsbedingungen) {
      setFehler('Bitte Datenschutz und Nutzungsbedingungen akzeptieren.')
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password: passwort,
      options: {
        data: { vorname, nachname, telefonnummer, invite_code: inviteCode }
      }
    })

    if (error) {
      setFehler(error.message)
      return
    }
    setStatus('Fast geschafft! Bitte bestätige deine E-Mail über den Link, den wir dir gerade geschickt haben.')
  }

  if (status) {
    return <div style={pageStyle}><h2>📧 {status}</h2></div>
  }

  return (
    <div style={pageStyle}>
      <h1>Willkommen bei TT Captain</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 340 }}>
        <input placeholder="Vorname" value={vorname} onChange={e => setVorname(e.target.value)} required />
        <input placeholder="Nachname" value={nachname} onChange={e => setNachname(e.target.value)} required />
        <input type="email" placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} required />
        <input placeholder="Telefonnummer (optional)" value={telefonnummer} onChange={e => setTelefonnummer(e.target.value)} />
        <input type="password" placeholder="Passwort" value={passwort} onChange={e => setPasswort(e.target.value)} required minLength={6} />
        <label style={{ fontSize: 13, textAlign: 'left' }}>
          <input type="checkbox" checked={datenschutz} onChange={e => setDatenschutz(e.target.checked)} />{' '}
          Ich akzeptiere die <a href="/datenschutz.html" target="_blank" rel="noreferrer">Datenschutzerklärung</a>
        </label>
        <label style={{ fontSize: 13, textAlign: 'left' }}>
          <input type="checkbox" checked={nutzungsbedingungen} onChange={e => setNutzungsbedingungen(e.target.checked)} />{' '}
          Ich akzeptiere die <a href="/nutzungsbedingungen.html" target="_blank" rel="noreferrer">Nutzungsbedingungen</a>
        </label>
        {fehler && <p style={{ color: '#c0392b' }}>{fehler}</p>}
        <button type="submit" style={buttonStyle}>Registrieren</button>
      </form>
    </div>
  )
}

export default Registrierung
