import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

const cardStyle = { 
  background: '#ffffff', 
  border: '1px solid #DCE7E2', 
  borderRadius: 14, 
  padding: 14, 
  marginBottom: 10 
}

function Chats({ session }) {
  const [istAdmin, setIstAdmin] = useState(false)
  const [teamChats, setTeamChats] = useState([])
  const [spielChats, setSpielChats] = useState([])
  const [ladend, setLadend] = useState(true)

  useEffect(() => {
    const laden = async () => {
      // 1. Admin-Status prüfen
      const { data: benutzerRow } = await supabase
        .from('benutzer')
        .select('ist_administrator')
        .eq('id', session.user.id)
        .single()
      
      setIstAdmin(benutzerRow?.ist_administrator || false)

      // 2. Teamchats laden und doppelte Zuordnungen (z.B. Spieler + Spielführer) herausfiltern
      const { data: zuordnungen } = await supabase
        .from('mannschaftszuordnungen')
        .select('mannschaft_id, mannschaften(name)')
        .eq('benutzer_id', session.user.id)

      const rawTeams = (zuordnungen || [])
        .map(z => ({ mannschaft_id: z.mannschaft_id, name: z.mannschaften?.name }))
        .filter(t => t.mannschaft_id && t.name)

      // Deduplizierung nach mannschaft_id
      const eindeutigeTeams = Array.from(
        new Map(rawTeams.map(t => [t.mannschaft_id, t])).values()
      )

      setTeamChats(eindeutigeTeams)

      // 3. Spielchats über aufstellung_spieler + aufstellungen laden
      const heute = new Date().toISOString().slice(0, 10)

      const { data: eintraege } = await supabase
        .from('aufstellung_spieler')
        .select('aufstellungen!inner(spiel_id, veroeffentlicht, spiele!inner(id, gegner, heim_oder_auswaerts, datum, mannschaften(name)))')
        .eq('benutzer_id', session.user.id)
        .eq('aufstellungen.veroeffentlicht', true)
        .gte('aufstellungen.spiele.datum', heute)

      const gefilterteSpiele = (eintraege || [])
        .map(e => e.aufstellungen?.spiele)
        .filter(Boolean)

      // Eindeutige Spiele herausfiltern
      const mehraufhebung = Array.from(new Map(gefilterteSpiele.map(s => [s.id, s])).values())
      mehraufhebung.sort((a, b) => new Date(a.datum) - new Date(b.datum))

      setSpielChats(mehraufhebung)
      setLadend(false)
    }

    laden()
  }, [session])

  if (ladend) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff' }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 20px 80px', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 20, margin: '8px 0 16px' }}>Chats</h1>

        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5B6D66', textTransform: 'uppercase', letterSpacing: '.04em', margin: '4px 0 8px' }}>
          Teamchats
        </div>
        {teamChats.map(t => (
          <Link key={t.mannschaft_id} to={`/chats/mannschaft/${t.mannschaft_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={cardStyle}>
              <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 14 }}>💬 {t.name}</span>
            </div>
          </Link>
        ))}
        {teamChats.length === 0 && <p style={{ fontSize: 13, color: '#5B6D66' }}>Keine Mannschaft zugeordnet.</p>}

        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5B6D66', textTransform: 'uppercase', letterSpacing: '.04em', margin: '16px 0 8px' }}>
          Spielchats
        </div>
        {spielChats.map(s => (
          <Link key={s.id} to={`/chats/spiel/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={cardStyle}>
              <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 14 }}>
                💬 {s.heim_oder_auswaerts === 'heim' ? `${s.mannschaften?.name} vs. ${s.gegner}` : `${s.gegner} vs. ${s.mannschaften?.name}`}
              </span>
              <div style={{ fontSize: 12, color: '#5B6D66', marginTop: 2 }}>{s.datum}</div>
            </div>
          </Link>
        ))}
        {spielChats.length === 0 && <p style={{ fontSize: 13, color: '#5B6D66' }}>Keine aktiven Spielchats (nur nach Veröffentlichung der Aufstellung sichtbar).</p>}
      </div>

      <BottomNav istAdmin={istAdmin} />
    </div>
  )
}

export default Chats
