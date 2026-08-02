import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'

const navLinkStyle = {
  fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600,
  color: '#1C8A4E', textDecoration: 'none'
}

function Dashboard({ session }) {
  const [vorname, setVorname] = useState('')
  const [istAdmin, setIstAdmin] = useState(false)

  useEffect(() => {
    supabase.from('benutzer').select('vorname, ist_administrator').eq('id', session.user.id).single()
      .then(({ data }) => {
        if (data) {
          setVorname(data.vorname)
          setIstAdmin(data.ist_administrator)
        }
      })
  }, [session])

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{
        padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
      }}>
        <Brand size={16} />
        <div style={{ display: 'flex', gap: 16 }}>
          <Link to="/spiele" style={navLinkStyle}>Spiele</Link>
          {istAdmin && <Link to="/mannschaften" style={navLinkStyle}>Mannschaften</Link>}
        </div>
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
            Los geht's
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            Schau unter <strong>Spiele</strong> vorbei, um die Spielübersicht deiner Mannschaft(en) zu sehen.
            {istAdmin && <> Als Admin verwaltest du unter <strong>Mannschaften</strong> Teams und Einladungslinks.</>}
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
