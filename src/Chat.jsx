import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

function Chat({ session }) {
  const { chatId } = useParams()
  const navigate = useNavigate()

  const [nachrichten, setNachrichten] = useState([])
  const [neueNachricht, setNeueNachricht] = useState('')
  const [titel, setTitel] = useState('Chat')
  const [hatZugriff, setHatZugriff] = useState(false)
  const [istAdmin, setIstAdmin] = useState(false)
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

        const { data: adminData } = await supabase
          .from('benutzer')
          .select('ist_administrator')
          .eq('id', session.user.id)
          .single()
        
        const adminStatus = adminData?.ist_administrator || false
        setIstAdmin(adminStatus)
        if (adminStatus) zugriffErlaubt = true

        if (istTeamChat) {
          const { data: mData } = await supabase
            .from('mannschaften')
            .select('name')
            .eq('id', echteId)
            .single()

          if (mData) chatTitel = `Teamchat: ${mData.name}`

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

        const { data: msgData } = await supabase
          .from('nachrichten')
          .select('*, benutzer:benutzer_id(vorname, nachname)')
          .eq('chat_id', echteId)
          .order('gesendet_am', { ascending: true })

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

  const nachrichtSenden = async (e) => {
    e.preventDefault()
    if (!neueNachricht.trim() || speichert) return

    setSpeichert(true)
    const echteId = chatId.replace(/^(team_|spiel_)/, '')

    try {
      const payload = {
        text: neueNachricht,
        benutzer_id: session.user.id,
        chat_id: echteId,
        gesendet_am: new Date().toISOString()
      }

      const { error } = await supabase
        .from('nachrichten')
        .insert(payload)

      if (error) throw error

      setNeueNachricht('')
      
      const { data: msgData } = await supabase
        .from('nachrichten')
        .select('*, benutzer:benutzer_id(vorname, nachname)')
        .eq('chat_id', echteId)
        .order('gesendet_am', { ascending: true })

      setNachrichten(msgData || [])
      setTimeout(scrollToBottom, 100)
    } catch (err) {
      console.error('Fehler beim Senden:', err)
      alert('Fehler beim Senden: ' + (err.message || JSON.stringify(err)))
    } finally {
      setSpeichert(false)
    }
  }

  if (ladend) {
    return (
      <div style={{ height: '100vh', background: '#efeae2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
        Lade Chat...
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', background: '#efeae2', fontFamily: 'Inter, sans-serif', color: '#16261F', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden', position: 'relative' }}>
      
      {/* Fixierter Header oben */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 60, zIndex: 1000, padding: '0 16px', borderBottom: '1px solid #DCE7E2', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/chats')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', fontWeight: 700, color: '#1C8A4E', padding: 4, display: 'flex', alignItems: 'center' }}>
            ←
          </button>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1C8A4E', textTransform: 'uppercase', letterSpacing: '.04em' }}>Chat</div>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 14, fontWeight: 700, color: '#16261F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>{titel}</div>
          </div>
        </div>
        <Brand size={14} />
      </div>

      {/* Scrollbarer Nachrichtenbereich (eingepasst zwischen Header und Eingabezeile) */}
      <div style={{ position: 'absolute', top: 60, bottom: 128, left: 0, right: 0, width: '100%', maxWidth: 480, margin: '0 auto', overflowY: 'auto', padding: '16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        {!hatZugriff ? (
          <div style={{ background: '#FDF2F2', border: '1px solid #F5C6CB', borderRadius: 12, color: '#C0392B', textAlign: 'center', padding: 20, marginTop: 20 }}>
            🚫 Du hast keinen Zugriff auf diesen Chat oder die Aufstellung ist noch nicht veröffentlicht.
          </div>
        ) : (
          <>
            {nachrichten.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#667781', fontSize: 13, marginTop: 40, background: '#ffffff', padding: '12px 16px', borderRadius: 8, boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)', alignSelf: 'center' }}>
                Noch keine Nachrichten vorhanden. Schreib die erste Nachricht! 👇
              </div>
            ) : (
              nachrichten.map(msg => {
                const istEigen = msg.benutzer_id === session.user.id
                const zeit = msg.gesendet_am ? new Date(msg.gesendet_am).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                return (
                  <div key={msg.id || Math.random()} style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', alignItems: istEigen ? 'flex-end' : 'flex-start', width: '100%' }}>
                    {!istEigen && (
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#1C8A4E', marginBottom: 2, padding: '0 4px' }}>
                        {msg.benutzer?.vorname || 'Mitglied'} {msg.benutzer?.nachname || ''}
                      </div>
                    )}
                    <div style={{ 
                      background: istEigen ? '#E7FFDB' : '#ffffff', 
                      color: '#111b21',
                      padding: '8px 12px 6px 12px',
                      borderRadius: istEigen ? '7.5px 0 7.5px 7.5px' : '0 7.5px 7.5px 7.5px',
                      maxWidth: '80%',
                      fontSize: 14,
                      wordBreak: 'break-word',
                      boxShadow: '0 1px 0.5px rgba(11, 20, 26, 0.13)',
                      boxSizing: 'border-box',
                      position: 'relative'
                    }}>
                      <div style={{ paddingRight: 45, lineHeight: 1.4 }}>{msg.text}</div>
                      <div style={{ fontSize: 10, color: '#667781', float: 'right', marginTop: 2, marginLeft: 8, display: 'flex', alignItems: 'center', gap: 2 }}>
                        {zeit}
                        {istEigen && <span style={{ color: '#53bdeb', fontWeight: 'bold', fontSize: 11 }}>✓✓</span>}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* WhatsApp-Eingabefeld (fixiert direkt über der unteren Navigation) */}
      {hatZugriff && (
        <form onSubmit={nachrichtSenden} style={{ position: 'fixed', bottom: 64, left: 0, right: 0, height: 64, background: '#f0f2f5', borderTop: '1px solid #DCE7E2', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', maxWidth: 480, margin: '0 auto', zIndex: 1000, boxSizing: 'border-box' }}>
          <input
            type="text"
            placeholder="Nachricht"
            value={neueNachricht}
            onChange={e => setNeueNachricht(e.target.value)}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 24, border: 'none', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: '#ffffff', color: '#111b21', boxShadow: '0 1px 0.5px rgba(11, 20, 26, 0.13)' }}
          />
          <button type="button" title="Foto anhängen" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#54656f' }}>
            📷
          </button>
          <button type="button" title="Standort anhängen" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#54656f' }}>
            📍
          </button>
          <button type="submit" disabled={speichert || !neueNachricht.trim()} style={{ background: '#00a884', color: 'white', border: 'none', borderRadius: '50%', width: 42, height: 42, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: !neueNachricht.trim() ? 0.6 : 1 }}>
            ➤
          </button>
        </form>
      )}

      {/* Fixierte untere Navigation */}
      <BottomNav istAdmin={istAdmin} />

    </div>
  )
}

export default Chat
