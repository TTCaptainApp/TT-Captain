import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

const cardStyle = { background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 14, marginBottom: 10 }

function Chats({ session }) {
  const [istAdmin, setIstAdmin] = useState(false)
  const [teamChats, setTeamChats] = useState([])
  const [spielChats, setSpielChats] = useState([])
  const [ladend, setLadend] = useState(true)

  useEffect(() => {
    const laden = async () => {
      const { data: benutzerRow } = await supabase.from('benutzer').select('ist_administrator').eq('id', session.user.id).single()
      setIstAdmin(benutzerRow?.ist_administrator || false)

      const { data: zuordnungen } = await supabase
        .from('mannschaftszuordnungen')
        .select('mannschaft_id, mannschaften(name)')
        .eq('benutzer_id', session.user.id)
      const teams = (zuordnungen || []).map(z => ({ mannschaft_id: z.mannschaft_id, name: z.mannschaften?.name }))
      setTeamChats(teams)

      const mannschaftIds = teams.map(t => t.mannschaft_id)
      const heute = new Date().toISOString().slice(0, 10)

      let eigeneSpiele = []
      if (mannschaftIds.length > 0) {
        const { data } = await supabase
          .from('spiele')
          .select('id, gegner, heim_oder_auswaerts, datum, mannschaften(name)')
          .in('mannschaft_id', mannschaftIds)
          .gte('datum', heute)
          .order('datum')
        eigeneSpiele = data || []
      }

      const { data: ersatzSpiele } = await supabase
        .from('ersatzanfragen')
        .select('spiel_id, spiele(id, gegner, heim_oder_auswaerts, datum, mannschaften(name))')
        .eq('angefragter_benutzer_id', session.user.id)
        .eq('status', 'zugesagt')

      const ersatzListe = (ersatzSpiele || []).filter(e => e.spiele).map(e => e.spiele)
      const alleSpiele = [...eigeneSpiele, ...ersatzListe.filter(s => !eigeneSpiele.some(es => es.id === s.id))]
      setSpielChats(alleSpiele)
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
        {spielChats.length === 0 && <p style={{ fontSize: 13, color: '#5B6D66' }}>Keine anstehenden Spiele.</p>}
      </div>

      <BottomNav istAdmin={istAdmin} />
    </div>
  )
}

export default Chats 
