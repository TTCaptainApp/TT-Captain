import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

const buttonStyle = { background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const inputStyle = { flex: 1, padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1px solid #DCE7E2', fontFamily: 'inherit' }

function Chat({ session }) {
  const { mannschaftId, spielId } = useParams()
  const typ = mannschaftId ? 'mannschaft' : 'spiel'
  const [istAdmin, setIstAdmin] = useState(false)
  const [titel, setTitel] = useState('')
  const [chatId, setChatId] = useState(null)
  const [nachrichten, setNachrichten] = useState([])
  const [text, setText] = useState('')
  const [ladend, setLadend] = useState(true)
  const [fehler, setFehler] = useState(null)
  const listeEndeRef = useRef(null)

  const nachrichtenLaden = async (cId) => {
    const { data: namen } = await supabase.rpc('teamkollegen_namen')
    const lex = Object.fromEntries((namen || []).map(n => [n.id, `${n.vorname} ${n.nachname}`]))

    const { data } = await supabase
      .from('nachrichten')
      .select('id, benutzer_id, text, gesendet_am')
      .eq('chat_id', cId)
      .order('gesendet_am')

    setNachrichten((data || []).map(n => ({ ...n, name: lex[n.benutzer_id] || (n.benutzer_id === session.user.id ? 'Du' : '?') })))
  }

  const initialisieren = async () => {
    setLadend(true)

    const { data: benutzerRow } = await supabase.from('benutzer').select('ist_administrator').eq('id', session.user.id).single()
    setIstAdmin(benutzerRow?.ist_administrator || false)

    let bestehenderChat = null
    if (typ === 'mannschaft') {
      const { data: m } = await supabase.from('mannschaften').select('name').eq('id', mannschaftId).single()
      setTitel(m?.name || 'Teamchat')
      const { data } = await supabase.from('chats').select('id').eq('typ', 'mannschaft').eq('mannschaft_id', mannschaftId).maybeSingle()
      bestehenderChat = data
    } else {
      const { data: s } = await supabase.from('spiele').select('gegner, heim_oder_auswaerts, mannschaften(name)').eq('id', spielId).single()
      if (s) {
        setTitel(s.heim_oder_auswaerts === 'heim' ? `${s.mannschaften?.name} vs. ${s.gegner}` : `${s.gegner} vs. ${s.mannschaften?.name}`)
      }
      const { data } = await supabase.from('chats').select('id').eq('typ', 'spiel').eq('spiel_id', spielId).maybeSingle()
      bestehenderChat = data
    }

    let cId = bestehenderChat?.id
    if (!cId) {
      const insertPayload = typ === 'mannschaft'
        ? { typ: 'mannschaft', mannschaft_id: mannschaftId }
        : { typ: 'spiel', spiel_id: spielId }
      const { data, error } = await supabase.from('chats').insert(insertPayload).select().single()
      if (error) {
        // evtl. wurde der Chat gerade parallel von jemand anderem angelegt - nochmal versuchen zu laden
        const { data: nochmal } = typ === 'mannschaft'
          ? await supabase.from('chats').select('id').eq('typ', 'mannschaft').eq('mannschaft_id', mannschaftId).maybeSingle()
          : await supabase.from('chats').select('id').eq('typ', 'spiel').eq('spiel_id', spielId).maybeSingle()
        cId = nochmal?.id
        if (!cId) { setFehler(error.message); setLadend(false); return }
      } else {
        cId = data.id
      }
    }

    setChatId(cId)
    await nachrichtenLaden(cId)
    setLadend(false)
  }

  useEffect(() => { initialisieren() }, [mannschaftId, spielId, session])

  // leichtes Polling, damit neue Nachrichten von anderen auch ohne Neuladen ankommen
  useEffect(() => {
    if (!chatId) return
    const intervall = setInterval(() => nachrichtenLaden(chatId), 5000)
    return () => clearInterval(intervall)
  }, [chatId])

  useEffect(() => {
    listeEndeRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [nachrichten])

  const senden = async (e) => {
    e.preventDefault()
    if (!text.trim() || !chatId) return
    const inhalt = text.trim()
    setText('')
    const { error } = await supabase.from('nachrichten').insert({ chat_id: chatId, benutzer_id: session.user.id, text: inhalt })
    if (error) { setFehler(error.message); return }
    nachrichtenLaden(chatId)
  }

  if (ladend) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff' }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '14px 20px', maxWidth: 480, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Link to="/chats" style={{ fontSize: 13, color: '#1C8A4E', fontWeight: 600, textDecoration: 'none' }}>← Zurück zu Chats</Link>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 18, margin: '10px 0 14px' }}>💬 {titel}</h1>

        {fehler && <p style={{ color: '#c0392b', fontSize: 13 }}>{fehler}</p>}

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 90 }}>
          {nachrichten.length === 0 && <p style={{ fontSize: 13, color: '#5B6D66' }}>Noch keine Nachrichten.</p>}
          {nachrichten.map(n => {
            const eigene = n.benutzer_id === session.user.id
            return (
              <div key={n.id} style={{ display: 'flex', justifyContent: eigene ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                <div style={{
                  maxWidth: '75%', background: eigene ? '#1C8A4E' : '#ffffff', color: eigene ? 'white' : '#16261F',
                  border: eigene ? 'none' : '1px solid #DCE7E2', borderRadius: 12, padding: '8px 12px'
                }}>
                  {!eigene && <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2, color: '#1C8A4E' }}>{n.name}</div>}
                  <div style={{ fontSize: 14 }}>{n.text}</div>
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>
                    {new Date(n.gesendet_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={listeEndeRef} />
        </div>
      </div>

      <form
        onSubmit={senden}
        style={{
          position: 'fixed', bottom: 60, left: 0, right: 0, background: '#ffffff',
          borderTop: '1px solid #DCE7E2', padding: '10px 20px', display: 'flex', gap: 8,
          maxWidth: 480, margin: '0 auto'
        }}
      >
        <input style={inputStyle} placeholder="Nachricht..." value={text} onChange={e => setText(e.target.value)} />
        <button type="submit" style={buttonStyle}>Senden</button>
      </form>

      <BottomNav istAdmin={istAdmin} />
    </div>
  )
}

export default Chat
