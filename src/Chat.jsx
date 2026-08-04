import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import BottomNav from './BottomNav'

function Chat({ session }) {
  const { mannschaftId, spielId } = useParams()
  const typ = mannschaftId ? 'mannschaft' : 'spiel'
  const [istAdmin, setIstAdmin] = useState(false)
  const [titel, setTitel] = useState('')
  const [chatId, setChatId] = useState(null)
  const [nachrichten, setNachrichten] = useState([])
  const [text, setText] = useState('')
  const [bildDatei, setBildDatei] = useState(null)
  const [bildVorschau, setBildVorschau] = useState(null)
  const [hochladend, setHochladend] = useState(false)
  const [ladend, setLadend] = useState(true)
  const [fehler, setFehler] = useState(null)

  const listeEndeRef = useRef(null)
  const fileInputRef = useRef(null)

  const nachrichtenLaden = async (cId) => {
    const { data: namen } = await supabase.rpc('teamkollegen_namen')
    const lex = Object.fromEntries((namen || []).map(n => [n.id, `${n.vorname} ${n.nachname}`]))

    const { data } = await supabase
      .from('nachrichten')
      .select('id, benutzer_id, text, medien_url, standort_lat, standort_lng, gesendet_am')
      .eq('chat_id', cId)
      .order('gesendet_am')

    setNachrichten((data || []).map(n => ({ ...n, name: lex[n.benutzer_id] || (n.benutzer_id === session.user.id ? 'Du' : '?') })))
  }

  const initialisieren = async () => {
    setLadend(true)
    setFehler(null)

    const { data: benutzerRow } = await supabase.from('benutzer').select('ist_administrator').eq('id', session.user.id).single()
    const admin = benutzerRow?.ist_administrator || false
    setIstAdmin(admin)

    if (!admin) {
      if (typ === 'mannschaft') {
        const { data: z } = await supabase
          .from('mannschaftszuordnungen')
          .select('id')
          .eq('benutzer_id', session.user.id)
          .eq('mannschaft_id', mannschaftId)
          .maybeSingle()

        if (!z) { setFehler('Du hast keinen Zugriff auf diesen Mannschaftschat.'); setLadend(false); return }
      } else {
        const { data: a } = await supabase
          .from('aufstellung_spieler')
          .select('id, aufstellungen!inner(veroeffentlicht, spiel_id)')
          .eq('benutzer_id', session.user.id)
          .eq('aufstellungen.spiel_id', spielId)
          .eq('aufstellungen.veroeffentlicht', true)
          .maybeSingle()

        if (!a) { setFehler('Du hast keinen Zugriff auf diesen Spielchat oder die Aufstellung ist noch nicht veröffentlicht.'); setLadend(false); return }
      }
    }

    let bestehenderChat = null
    if (typ === 'mannschaft') {
      const { data: m } = await supabase.from('mannschaften').select('name').eq('id', mannschaftId).single()
      setTitel(m?.name || 'Teamchat')
      const { data } = await supabase.from('chats').select('id').eq('typ', 'mannschaft').eq('mannschaft_id', mannschaftId).maybeSingle()
      bestehenderChat = data
    } else {
      const { data: s } = await supabase.from('spiele').select('gegner, heim_oder_auswaerts, mannschaften(name)').eq('id', spielId).single()
      if (s) { setTitel(s.heim_oder_auswaerts === 'heim' ? `${s.mannschaften?.name} vs. ${s.gegner}` : `${s.gegner} vs. ${s.mannschaften?.name}`) }
      const { data } = await supabase.from('chats').select('id').eq('typ', 'spiel').eq('spiel_id', spielId).maybeSingle()
      bestehenderChat = data
    }

    let cId = bestehenderChat?.id
    if (!cId) {
      const insertPayload = typ === 'mannschaft' ? { typ: 'mannschaft', mannschaft_id: mannschaftId } : { typ: 'spiel', spiel_id: spielId }
      const { data, error } = await supabase.from('chats').insert(insertPayload).select().single()
      if (error) {
        const { data: nochmal } = typ === 'mannschaft'
          ? await supabase.from('chats').select('id').eq('typ', 'mannschaft').eq('mannschaft_id', mannschaftId).maybeSingle()
          : await supabase.from('chats').select('id').eq('typ', 'spiel').eq('spiel_id', spielId).maybeSingle()
        cId = nochmal?.id
        if (!cId) { setFehler(error.message); setLadend(false); return }
      } else { cId = data.id }
    }

    setChatId(cId)
    await nachrichtenLaden(cId)
    setLadend(false)
  }

  useEffect(() => { initialisieren() }, [mannschaftId, spielId, session])

  useEffect(() => {
    if (!chatId) return
    const intervall = setInterval(() => nachrichtenLaden(chatId), 5000)
    return () => clearInterval(intervall)
  }, [chatId])

  useEffect(() => {
    listeEndeRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [nachrichten, bildVorschau])

  const bildAuswaehlen = (e) => {
    const file = e.target.files[0]
    if (file) {
      setBildDatei(file)
      setBildVorschau(URL.createObjectURL(file))
    }
  }

  const standortSenden = () => {
    if (!navigator.geolocation) {
      alert('Geolokalisierung wird von deinem Browser nicht unterstützt.')
      return
    }

    setHochladend(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        const { error } = await supabase.from('nachrichten').insert({
          chat_id: chatId,
          benutzer_id: session.user.id,
          text: '📍 Standort freigegeben',
          standort_lat: latitude,
          standort_lng: longitude
        })
        setHochladend(false)
        if (error) setFehler(error.message)
        else nachrichtenLaden(chatId)
      },
      (error) => {
        setHochladend(false)
        alert('Standort konnte nicht ermittelt werden: ' + error.message)
      }
    )
  }

  const senden = async (e) => {
    e.preventDefault()
    if ((!text.trim() && !bildDatei) || !chatId || hochladend) return

    setHochladend(true)
    let medienUrl = null

    if (bildDatei) {
      const dateiEndung = bildDatei.name.split('.').pop()
      const dateiName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${dateiEndung}`

      const { error: uploadError } = await supabase.storage
        .from('chat-medien')
        .upload(dateiName, bildDatei)

      if (uploadError) {
        setFehler('Bild-Upload fehlgeschlagen: ' + uploadError.message)
        setHochladend(false)
        return
      }

      const { data: urlData } = supabase.storage.from('chat-medien').getPublicUrl(dateiName)
      medienUrl = urlData.publicUrl
    }

    const { error } = await supabase.from('nachrichten').insert({
      chat_id: chatId,
      benutzer_id: session.user.id,
      text: text.trim(),
      medien_url: medienUrl
    })

    setText('')
    setBildDatei(null)
    setBildVorschau(null)
    setHochladend(false)

    if (error) { setFehler(error.message) } 
    else { nachrichtenLaden(chatId) }
  }

  if (ladend) return null

  return (
    <div style={{ minHeight: '100vh', background: '#EFEAE2', fontFamily: 'Inter, system-ui, sans-serif', color: '#111B21', display: 'flex', flexDirection: 'column' }}>
      
      {/* WHATSAPP TOP BAR */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1C8A4E', color: 'white', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
        <Link to="/chats" style={{ color: 'white', textDecoration: 'none', fontSize: 22, fontWeight: 'bold', lineHeight: 1 }}>
          ←
        </Link>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {titel || 'Chat'}
          </div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>{typ === 'mannschaft' ? 'Teamchat' : 'Spielchat'}</div>
        </div>
      </div>

      <div style={{ padding: '14px 16px 120px', maxWidth: 480, margin: '0 auto', width: '100%', flex: 1, boxSizing: 'border-box' }}>
        {fehler ? (
          <div style={{ padding: 14, background: '#FDF2F2', border: '1px solid #F87171', borderRadius: 10, color: '#991B1B', marginTop: 10, fontSize: 13, fontWeight: 500 }}>
            ⛔ {fehler}
          </div>
        ) : (
          <div>
            {nachrichten.length === 0 && (
              <div style={{ textAlign: 'center', margin: '20px 0' }}>
                <span style={{ background: 'rgba(255,255,255,0.85)', padding: '6px 12px', borderRadius: 8, fontSize: 12, color: '#54656F', boxShadow: '0 1px 0.5px rgba(11,20,26,0.13)' }}>
                  🔒 Noch keine Nachrichten in diesem Chat.
                </span>
              </div>
            )}
            
            {nachrichten.map(n => {
              const eigene = n.benutzer_id === session.user.id
              return (
                <div key={n.id} style={{ display: 'flex', justifyContent: eigene ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                  <div style={{
                    maxWidth: '82%',
                    background: eigene ? '#D9FDD3' : '#FFFFFF',
                    color: '#111B21',
                    borderRadius: eigene ? '8px 8px 0px 8px' : '8px 8px 8px 0px',
                    padding: '6px 10px 4px',
                    boxShadow: '0 1px 0.5px rgba(11,20,26,0.13)',
                    position: 'relative'
                  }}>
                    {/* ABSENDERNAME (Nur bei fremden Nachrichten) */}
                    {!eigene && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1C8A4E', marginBottom: 2 }}>
                        {n.name}
                      </div>
                    )}
                    
                    {/* BILD-ANZEIGE */}
                    {n.medien_url && (
                      <a href={n.medien_url} target="_blank" rel="noopener noreferrer">
                        <img src={n.medien_url} alt="Anhang" style={{ width: '100%', borderRadius: 6, marginTop: 2, marginBottom: 4, maxHeight: 240, objectFit: 'cover' }} />
                      </a>
                    )}

                    {/* STANDORT-ANZEIGE */}
                    {n.standort_lat && n.standort_lng && (
                      <div style={{ marginTop: 2, marginBottom: 4 }}>
                        <a
                          href={`https://www.google.com/maps?q=${n.standort_lat},${n.standort_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                            background: eigene ? '#C8F8BF' : '#F0F2F5', color: '#1C8A4E',
                            borderRadius: 6, textDecoration: 'none', fontSize: 12, fontWeight: 600
                          }}
                        >
                          📍 Standort auf Karte öffnen ↗
                        </a>
                      </div>
                    )}

                    {/* NACHRICHTENTEXT */}
                    {n.text && (
                      <div style={{ fontSize: 14, lineHeight: '1.35', wordBreak: 'break-word', paddingRight: eigene ? 35 : 35 }}>
                        {n.text}
                      </div>
                    )}

                    {/* UHRZEIT (Unten rechts wie bei WhatsApp) */}
                    <div style={{
                      fontSize: 10,
                      color: '#667781',
                      textAlign: 'right',
                      marginTop: n.text ? -4 : 2,
                      float: 'right',
                      marginLeft: 12
                    }}>
                      {new Date(n.gesendet_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={listeEndeRef} />
          </div>
        )}
      </div>

      {/* WHATSAPP FOOTER INPUT */}
      <div style={{
        position: 'fixed', bottom: 60, left: 0, right: 0, background: '#F0F2F5',
        borderTop: '1px solid #E9EDEF', padding: '8px 12px',
        maxWidth: 480, margin: '0 auto', boxSizing: 'border-box', zIndex: 10
      }}>
        {/* VORSCHAU-BEREICH FÜR FOTO */}
        {bildVorschau && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FFFFFF', padding: '6px 10px', borderRadius: 8, marginBottom: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
            <img src={bildVorschau} alt="Vorschau" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} />
            <span style={{ fontSize: 12, color: '#54656F', flex: 1 }}>Foto ausgewählt</span>
            <button type="button" onClick={() => { setBildDatei(null); setBildVorschau(null) }} style={{ border: 'none', background: 'none', color: '#EA4335', fontSize: 16, cursor: 'pointer', padding: 4 }}>✕</button>
          </div>
        )}

        <form onSubmit={senden} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={bildAuswaehlen}
          />

          {/* EINGABEFELD & ICONS IN EINER KAPSEL */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#FFFFFF', borderRadius: 24, padding: '4px 12px', border: '1px solid #E9EDEF' }}>
            <input
              style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 4px', fontSize: 14, background: 'transparent', fontFamily: 'inherit' }}
              placeholder="Nachricht..."
              value={text}
              onChange={e => setText(e.target.value)}
            />
            
            {/* Foto Button */}
            <button type="button" onClick={() => fileInputRef.current?.click()} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', padding: '4px 6px', opacity: 0.7 }} title="Foto anhängen">
              📷
            </button>

            {/* Standort Button */}
            <button type="button" onClick={standortSenden} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', padding: '4px 6px', opacity: 0.7 }} title="Standort senden">
              📍
            </button>
          </div>

          {/* RUNDER SENDE-BUTTON */}
          <button
            type="submit"
            disabled={hochladend}
            style={{
              width: 42, height: 42, borderRadius: '50%', background: '#1C8A4E', color: 'white',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, cursor: 'pointer', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}
          >
            {hochladend ? '...' : '➤'}
          </button>
        </form>
      </div>

      <BottomNav istAdmin={istAdmin} />
    </div>
  )
}

export default Chat
