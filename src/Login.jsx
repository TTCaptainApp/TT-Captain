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

function Login() {
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [fehler, setFehler] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFehler(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: passwort })
    if (error) setFehler(error.message)
  }

  return (
    <div style={pageStyle}>
      <h1>🏓 TT Captain</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
        <input type="email" placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="Passwort" value={passwort} onChange={e => setPasswort(e.target.value)} required />
        {fehler && <p style={{ color: '#c0392b' }}>{fehler}</p>}
        <button type="submit" style={buttonStyle}>Einloggen</button>
      </form>
    </div>
  )
}

export default Login
