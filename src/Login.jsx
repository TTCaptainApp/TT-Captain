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

function Login() {
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [fehler, setFehler] = useState(null)
  const [ladend, setLadend] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFehler(null)
    setLadend(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: passwort })
    setLadend(false)
    if (error) setFehler(error.message)
  }

  return (
    <div style={pageStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <Brand />
        <input style={inputStyle} type="email" placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} required />
        <input style={inputStyle} type="password" placeholder="Passwort" value={passwort} onChange={e => setPasswort(e.target.value)} required />
        {fehler && <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{fehler}</p>}
        <button type="submit" style={buttonStyle} disabled={ladend}>
          {ladend ? 'Einen Moment...' : 'Einloggen'}
        </button>
      </form>
    </div>
  )
}

export default Login
