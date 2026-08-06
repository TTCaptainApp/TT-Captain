import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

// ── Design-Tokens (konsistent mit Spiele.jsx / Dashboard.jsx) ───
const C = {
  courtGreen: '#1C8A4E',
  mint: '#EAF6F0',
  bg: '#F6FAF8',
  ink: '#16261F',
  inkMuted: '#5B6D66',
  border: '#DCE7E2',
  white: '#FFFFFF',
  mintAccent: '#23D2A0'
}
const fontDisplay = 'Sora, sans-serif'
const fontBody = 'Inter, sans-serif'
const fontMono = "'JetBrains Mono', monospace"

const chatCardStyle = {
  background: C.white, border: `1px solid ${C.border}`, borderRadius: 14,
  padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12,
  minHeight: 56, boxShadow: '0 1px 2px rgba(22,38,31,0.03)'
}

const sectionLabel = { fontFamily: fontMono, fontSize: 11.5, fontWeight: 700, color: C.inkMuted, textTransform: 'uppercase', letterSpacing: '.05em', margin: '18px 0 8px' }

function Chats({ session }) {
  const [istAdmin, setIstAdmin] = useState(false)
  const [istSpielfuehrer, setIstSpielfuehrer] = useState(false)
  const [teamChats, setTeamChats] = useState([])
  const [spielChats, setSpielChats] = useState([])
  const [ladend, setLadend] = useState(true)

  useEffect(() => {
    const laden = async () => {
      const { data: benutzerRow } = await supabase.from('benutzer').select('ist_administrator').eq('id', session.user.id).single()
      setIstAdmin(benutzerRow?.ist_administrator || false)

      const { data: zuordnungen } = await supabase
        .from('mannschaftszuordnungen')
        .select('mannschaft_id, rolle, mannschaften(name, archiviert)')
        .eq('benutzer_id', session.user.id)
      const teams = (zuordnungen || [])
        .filter(z => z.mannschaften && !z.mannschaften.archiviert)
        .map(z => ({ mannschaft_id: z.mannschaft_id, name: z.mannschaften?.name }))
      setTeamChats(teams)
      setIstSpielfuehrer((zuordnungen || []).some(z => z.rolle === 'spielfuehrer' || z.rolle === 'stellvertreter'))

      const { data: teilnahmen } = await supabase
        .from('aufstellung_spieler')
        .select('aufstellung_id')
        .eq('benutzer_id', session.user.id)

      const aufstellungIds = (teilnahmen || []).map(t => t.aufstellung_id)

      let spielChatsListe = []
      if (aufstellungIds.length > 0) {
        const { data: veroeffentlichte } = await supabase
          .from('aufstellungen')
          .select('spiel_id, spiele(id, gegner, heim_oder_auswaerts, datum, mannschaften(name, archiviert))')
          .in('id', aufstellungIds)
          .eq('veroeffentlicht', true)
        spielChatsListe = (veroeffentlichte || [])
          .map(a => a.spiele)
          .filter(s => s && !s.mannschaften?.archiviert)
      }
      setSpielChats(spielChatsListe)
      setLadend(false)

      supabase.from('benachrichtigungen')
        .update({ gelesen: true })
        .eq('benutzer_id', session.user.id)
        .eq('typ', 'chat')
        .eq('gelesen', false)
        .then(() => {})
    }
    laden()
  }, [session])

  if (ladend) return null

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: fontBody, color: C.ink }}>
      <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, background: C.white }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 16px 88px', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 21, margin: '8px 0 4px' }}>Chats</h1>

        {istSpielfuehrer && (
          <>
            <div style={sectionLabel}>Spielführer</div>
            <Link to="/chats/spielfuehrer" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ ...chatCardStyle, border: `1.5px solid ${C.mintAccent}` }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: C.mint,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0
                }}>🏅</div>
                <span style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 14.5 }}>Spielführer-Chat</span>
              </div>
            </Link>
          </>
        )}

        <div style={sectionLabel}>Teamchats</div>
        {teamChats.map(t => (
          <Link key={t.mannschaft_id} to={`/chats/mannschaft/${t.mannschaft_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={chatCardStyle}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, background: C.mint,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0
              }}>💬</div>
              <span style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 14.5 }}>{t.name}</span>
            </div>
          </Link>
        ))}
        {teamChats.length === 0 && <p style={{ fontSize: 13, color: C.inkMuted }}>Keine Mannschaft zugeordnet.</p>}

        <div style={sectionLabel}>Spielchats</div>
        {spielChats.map(s => (
          <Link key={s.id} to={`/chats/spiel/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={chatCardStyle}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, background: C.mint,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0
              }}>💬</div>
              <div>
                <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 14.5 }}>
                  {s.heim_oder_auswaerts === 'heim' ? `${s.mannschaften?.name} vs. ${s.gegner}` : `${s.gegner} vs. ${s.mannschaften?.name}`}
                </div>
                <div style={{ fontFamily: fontMono, fontSize: 11.5, color: C.inkMuted, marginTop: 2 }}>{s.datum}</div>
              </div>
            </div>
          </Link>
        ))}
        {spielChats.length === 0 && <p style={{ fontSize: 13, color: C.inkMuted }}>Keine anstehenden Spiele.</p>}
      </div>

      <BottomNav istAdmin={istAdmin} session={session} />
    </div>
  )
}

export default Chats
 
