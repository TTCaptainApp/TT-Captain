import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Brand from './Brand'

function Dashboard({ session }) {
  const [vorname, setVorname] = useState('')

  useEffect(() => {
    supabase.from('benutzer').select('vorname').eq('id', session.user.id).single()
      .then(({ data }) => { if (data) setVorname(data.vorname) })
  }, [session])

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff' }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: 20, maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 22, margin: '12px 0 4px' }}>
          Hallo {vorname || ''} 👋
        </h1>
        <p style={{ color: '#5B6D66', fontSize: 14, marginBottom: 20 }}>
          Schön, dass du dabei bist.
        </p>

        <div style={{
          background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 16,
          padding: '20px 18px', marginBottom: 16
        }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
            letterSpacing: '.06em', textTransform: 'uppercase', color: '#23D2A0', marginBottom: 6
          }}>
            Demnächst
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            Mannschaften, Spiele, Aufstellungen und Chats kommen in den nächsten Sprints dazu.
            Dein Zugang ist schon startklar.
          </p>
        </div>

        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            background: 'transparent', border: '1px solid #1C8A4E', color: '#1C8A4E',
            borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600
          }}
        >
          Abmelden
        </button>
      </div>
    </div>
  )
}

export default Dashboard
