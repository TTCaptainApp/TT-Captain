import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'

const cardStyle = { background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 16, marginBottom: 12 }
const inputStyle = { padding: '9px 10px', fontSize: 14, borderRadius: 8, border: '1px solid #DCE7E2', fontFamily: 'inherit', flex: 1 }
const buttonStyle = { background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const smallButtonStyle = { ...buttonStyle, padding: '6px 10px', fontSize: 12.5 }

function Mannschaften({ session }) {
  const [vereinId, setVereinId] = useState(null)
  const [mannschaften, setMannschaften] = useState([])
  const [neuerName, setNeuerName] = useState('')
  const [links, setLinks] = useState({}) // mannschaft_id -> [einladungslinks]
  const [fehler, setFehler] = useState(null)
  const [kopiert, setKopiert] = useState(null)

  const ladeMannschaften = async (vId) => {
    const { data } = await supabase.from('mannschaften').select('id, name').eq('verein_id', vId).order('name')
    setMannschaften(data || [])
  }

  const ladeLinks = async (mannschaftId) => {
    const { data } = await supabase.from('einladungslinks').select('id, code, aktiv').eq('mannschaft_id', mannschaftId).order('erstellt_am', { ascending: false })
    setLinks(prev => ({ ...prev, [mannschaftId]: data || [] }))
  }

  useEffect(() => {
    supabase.from('benutzer').select('verein_id').eq('id', session.user.id).single()
      .then(({ data }) => {
        if (data) {
          setVereinId(data.verein_id)
          ladeMannschaften(data.verein_id)
        }
      })
  }, [session])

  const neueMannschaftAnlegen = async (e) => {
    e.preventDefault()
    setFehler(null)
    if (!neuerName.trim()) return
    const { error } = await supabase.from('mannschaften').insert({ verein_id: vereinId, name: neuerName.trim() })
    if (error) {
      setFehler(error.message)
      return
    }
    setNeuerName('')
    ladeMannschaften(vereinId)
  }

  const einladungslinkErzeugen = async (mannschaftId) => {
    const code = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)
    const { error } = await supabase.from('einladungslinks').insert({ mannschaft_id: mannschaftId, code, aktiv: true })
    if (error) {
      setFehler(error.message)
      return
    }
    ladeLinks(mannschaftId)
  }

  const linkKopieren = (code) => {
    const url = `${window.location.origin}/?invite=${code}`
    navigator.clipboard.writeText(url)
    setKopiert(code)
    setTimeout(() => setKopiert(null), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Brand size={16} />
        <Link to="/" style={{ fontSize: 13, color: '#1C8A4E', fontWeight: 600, textDecoration: 'none' }}>← Zurück</Link>
      </div>

      <div style={{ padding: 20, maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 20, margin: '8px 0 16px' }}>Mannschaften</h1>

        <form onSubmit={neueMannschaftAnlegen} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input style={inputStyle} placeholder="Name neue Mannschaft (z.B. Herren 1)" value={neuerName} onChange={e => setNeuerName(e.target.value)} />
          <button type="submit" style={buttonStyle}>Anlegen</button>
        </form>
        {fehler && <p style={{ color: '#c0392b', fontSize: 13 }}>{fehler}</p>}

        {mannschaften.map(m => (
          <div key={m.id} style={cardStyle}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{m.name}</div>

            <button style={smallButtonStyle} onClick={() => einladungslinkErzeugen(m.id)}>+ Einladungslink erzeugen</button>

            {links[m.id] === undefined && (
              <button
                style={{ ...smallButtonStyle, background: 'transparent', color: '#1C8A4E', border: '1px solid #1C8A4E', marginLeft: 8 }}
                onClick={() => ladeLinks(m.id)}
              >
                Links anzeigen
              </button>
            )}

            {(links[m.id] || []).map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 13 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: l.aktiv ? '#16261F' : '#5B6D66' }}>
                  {l.code} {!l.aktiv && '(inaktiv)'}
                </span>
                <button
                  onClick={() => linkKopieren(l.code)}
                  style={{ background: 'none', border: 'none', color: '#1C8A4E', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}
                >
                  {kopiert === l.code ? '✅ kopiert' : '🔗 Link kopieren'}
                </button>
              </div>
            ))}
          </div>
        ))}

        {mannschaften.length === 0 && <p style={{ color: '#5B6D66', fontSize: 14 }}>Noch keine Mannschaften angelegt.</p>}
      </div>
    </div>
  )
}

export default Mannschaften
