import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'

const cardStyle = { 
  background: '#ffffff', 
  border: '1px solid #DCE7E2', 
  borderRadius: 14, 
  padding: 12, 
  marginBottom: 8 
}

const primaryButtonStyle = { 
  background: '#1C8A4E', 
  color: 'white', 
  border: 'none', 
  borderRadius: 10, 
  padding: '10px 16px', 
  fontSize: 14, 
  fontWeight: 600, 
  cursor: 'pointer',
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}

function Chat({ session }) {
  const { chatId } = useParams()
  const navigate = useNavigate()

  const [nachrichten, setNachrichten] = useState([])
  const [neueNachricht, setNeueNachricht] = useState('')
  const [titel, setTitel] = useState('Chat')
  const [hatZugriff, setHatZugriff] = useState(false)
  const [ladend, setLadend] = useState(true)
  const [speichert, setSpeichert] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    const ladeChat = async () => {
      if (!chatId || !session?.user?.id) return
      setLadend(true)

      try {
        const istTeamChat = chatId.startsWith('team_')
        const istSpielChat = chatId.startsWith('spiel_')
        const echteId = chatId.replace(/^(team_|spiel_)/, '')

        let zugriffErlaubt = false
        let chatTitel = 'Chat'

        // 1. Admin-Status prüfen (Admins haben immer Zugriff)
        const { data: adminData } = await supabase
          .from('benutzer')
          .select('ist_administrator')
          .eq('id', session.user.id)
          .single()
        
        const istAdmin = adminData?.ist_administrator || false
        if (istAdmin) zugriffErlaubt = true

        if (istTeamChat) {
          // Team-Namen laden
          const { data: mData } = await supabase
            .from('mannschaften')
            .select('name')
            .eq('id', echteId)
            .single()

          if (mData) chatTitel = `Teamchat: ${mData.name}`

          // Prüfen ob Benutzer Mitglied in der Mannschaft ist
          if (!zugriffErlaubt) {
            const { data: zuordnung } = await supabase
              .from('mannschaftszuordnungen')
              .select('id')
              .eq('benutzer_id', session.user.id)
              .eq('mannschaft_id', echteId)
              .maybeSingle()

            if (zuordnung) zugriffErlaubt = true
          }

        } else if (istSpielChat) {
          // Spiel-Details laden
          const { data: spielData } = await supabase
            .from('spiele')
            .select('*, mannschaften(name)')
            .eq('id', echteId)
            .single()

          if (spielData) {
            const teamName = spielData.mannschaften?.name || 'Team'
            const gegner = spielData.gegner || 'Gegner'
            chatTitel = spielData.heim_oder_auswaerts === 'heim' 
              ? `${teamName} vs. ${gegner}` 
              : `${gegner} vs. ${teamName}`

            // Prüfen ob Spielführer/Stellvertreter dieser Mannschaft
            if (!zugriffErlaubt && spielData.mannschaft_id) {
              const { data: zuord } = await supabase
                .from('mannschaftszuordnungen')
                .select('rolle')
                .eq('benutzer_id', session.user.id)
                .eq('mannschaft_id', spielData.mannschaft_id)
                .maybeSingle()

              if (zuord && (zuord.rolle === 'spielfuehrer' || zuord.rolle === 'stellvertreter')) {
                zugriffErlaubt = true
              }
            }
          }

          // Prüfen ob Aufstellung veröffentlicht ist und Benutzer darin ist
          if (!zugriffErlaubt) {
            const { data: aufstellungCheck } = await supabase
              .from('aufstellungen')
              .select('id, veroeffentlicht, aufstellung_spieler!inner(benutzer_id)')
              .eq('spiel_id', echteId)
              .eq('veroeffentlicht', true)
              .eq('aufstellung_spieler.benutzer_id', session.user.id)
              .maybeSingle()

            if (aufstellungCheck) {
              zugriffErlaubt = true
            }
          }
        }

        setTitel(chatTitel)
        setHatZugriff(zugriffErlaubt)

        // Nachrichten laden (Beispiel-Tabellenabfrage, an deine DB anpassen falls nötig)
        // Falls du eine gemeinsame Nachrichtentabelle hast:
        const spaltenFilter = istTeamChat ? { mannschaft_id: echteId } : { spiel_id: echteId }
        const { data: msgData } = await supabase
          .from('nachrichten')
          .select('*, benutzer:benutzer_id(vorname, nachname)')
          .match(spaltenFilter)
          .order('erstellt_am', { ascending: true })

        setNachrichten(msgData || [])

      } catch (err) {
        console.error('Fehler beim Laden:', err)
      } finally {
        setLadend(false)
        setTimeout(scrollToBottom, 100)
      }
    }

    ladeChat()
  }, [chatId, session])

  constnachrichtSenden = async (e) => {
    e.preventDefault()
    if (!neueNachricht.trim() || speichert) return

    setSpeichert(true)
    const istTeamChat = chatId.startsWith('team_')
    const echteId = chatId.replace(/^(team_|spiel_)/, '')

    try {
      const payload = {
        inhalt: neueNachricht,
        benutzer_id: session.user.id,
        [istTeamChat ? 'mannschaft_id' : 'spiel_id']: echteId
      }

      const { error } = await supabase
        .from('nachrichten')
        .insert(payload)

      if (error) throw error

      setNeueNachricht('')
      // Neu laden
      const { data: msgData } = await supabase
        .from('nachrichten')
        .select('*, benutzer:benutzer_id(vorname, nachname)')
        .match(istTeamChat ? { mannschaft_id: echteId } : { spiel_id: echteId })
        .order('erstellt_am', { ascending: true })

      setNachrichten(msgData || [])
      setTimeout(scrollToBottom, 100)
    } catch (err) {
      console.error('Fehler beim Senden:', err)
    } finally {
      setSpeichert(false)
    }
  }

  if (ladend) {
    return (
      <div style={{ minHeight: '100vh', background: '#F6FAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        Lade Chat...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #DCE7E2', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/chats')} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', fontWeight: 700 }}>
            ←
          </button>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1C8A4E', textTransform: 'uppercase' }}>Chat</div>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, fontWeight: 700 }}>{titel}</div>
          </div>
        </div>
        <Brand size={14} />
      </div>

      {/* Inhalt */}
      <div style={{ flex: 1, padding: '16px', maxWidth: 480, width: '100%', margin: '0 auto', paddingBottom: 90 }}>
        {!hatZugriff ? (
          <div style={{ ...cardStyle, background: '#FDF2F2', border: '1px solid #F5C6CB', color: '#C0392B', textAlign: 'center', padding: 20 }}>
            🚫 Du hast keinen Zugriff auf diesen Chat oder die Aufstellung ist noch nicht veröffentlicht.
          </div>
        ) : (
          <>
            {nachrichten.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#5B6D66', fontSize: 13, marginTop: 40 }}>
                Noch keine Nachrichten vorhanden. Schreib die erste Nachricht! 👇
              </div>
            ) : (
              nachrichten.map(msg => {
                const istEigen = msg.benutzer_id === session.user.id
                return (
                  <div key={msg.id || Math.random()} style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: istEigen ? 'flex-end' : 'flex-start' }}>
                    <div style={{ fontSize: 11, color: '#5B6D66', marginBottom: 2, padding: '0 4px' }}>
                      {istEigen ? 'Du' : `${msg.benutzer?.vorname || 'Mitglied'} ${msg.benutzer?.nachname || ''}`}
                    </div>
                    <div style={{ 
                      background: istEigen ? '#1C8A4E' : '#ffffff', 
                      color: istEigen ? '#ffffff' : '#16261F',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: istEigen ? 'none' : '1px solid #DCE7E2',
                      maxWidth: '85%',
                      fontSize: 14,
                      wordBreak: 'break-word',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}>
                      {msg.inhalt}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Eingabefeld (nur bei Zugriff) */}
      {hatZugriff && (
        <form onSubmit={nachrichtSenden} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#ffffff', borderTop: '1px solid #DCE7E2', padding: '10px 16px', display: 'flex', gap: 8, maxWidth: 480, margin: '0 auto', zIndex: 100 }}>
          <input
            type="text"
            placeholder="Nachricht schreiben..."
            value={neueNachricht}
            onChange={e => setNeueNachricht(e.target.value)}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #DCE7E2', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
          <button type="submit" disabled={speichert || !neueNachricht.trim()} style={{ ...primaryButtonStyle, width: 'auto', padding: '0 16px', opacity: !neueNachricht.trim() ? 0.5 : 1 }}>
            Senden
          </button>
        </form>
      )}

    </div>
  )
}

export default Chat
 
