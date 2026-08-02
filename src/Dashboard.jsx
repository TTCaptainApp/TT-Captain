import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function Dashboard({ session }) {
  const [vorname, setVorname] = useState('')

  useEffect(() => {
    supabase.from('benutzer').select('vorname').eq('id', session.user.id).single()
      .then(({ data }) => { if (data) setVorname(data.vorname) })
  }, [session])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', fontFamily: 'sans-serif', background: '#F6FAF8',
      color: '#16261F', textAlign: 'center', padding: 20
    }}>
      <h1>Hallo {vorname || ''} 👋</h1>
      <p>Willkommen bei TT Captain.</p>
      <button onClick={() => supabase.auth.signOut()} style={{
        marginTop: 20, background: 'transparent', border: '1px solid #1C8A4E',
        color: '#1C8A4E', borderRadius: 8, padding: '8px 16px', cursor: 'pointer'
      }}>Abmelden</button>
    </div>
  )
}

export default Dashboard
