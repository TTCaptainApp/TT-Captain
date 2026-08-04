import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

const buttonStyle = { background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const iconButtonStyle = { background: '#F0F4F2', border: '1px solid #DCE7E2', borderRadius: 8, padding: '8px 12px', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const inputStyle = { flex: 1, padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1px solid #DCE7E2', fontFamily: 'inherit' }

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

  // Bild auswählen
  const bildAuswaehlen = (e) => {
    const file = e.target.files[0]
    if (file) {
      setBildDatei(file)
      setBildVorschau(URL.createObjectURL(file))
    }
  }

  // Standort senden
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

  // Nachricht mit/ohne Bild senden
  const senden = async (e) => {
    e.preventDefault()
    if ((!text.trim() && !bildDatei) || !chatId || hochladend) return

    setHochladend(true)
    let medienUrl = null

    // Bild in Supabase Storage hochladen
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

    // Reset Formular
    setText('')
    setBildDatei(null)
    setBildVorschau(null)
    setHochladend(false)

    if (error) { setFehler(error.message) } 
    else { nachrichtenLaden(chatId) }
  }

  if (ladend) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff' }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '14px 20px', maxWidth: 480, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Link to="/chats" style={{ fontSize: 13, color: '#1C8A4E', fontWeight: 600, textDecoration: 'none' }}>← Zurück zu Chats</Link>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 18, margin: '10px 0 14px' }}>💬 {titel || 'Chat'}</h1>

        {fehler ? (
          <div style={{ padding: 14, background: '#FDF2F2', border: '1px solid #F87171', borderRadius: 10, color: '#991B1B', marginTop: 10, fontSize: 13, fontWeight: 500 }}>
            ⛔ {fehler}
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: bildVorschau ? 150 : 100 }}>
              {nachrichten.length === 0 && <p style={{ fontSize: 13, color: '#5B6D66' }}>Noch keine Nachrichten.</p>}
              {nachrichten.map(n => {
                const eigene = n.benutzer_id === session.user.id
                return (
                  <div key={n.id} style={{ display: 'flex', justifyContent: eigene ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                    <div style={{
                      maxWidth: '80%', background: eigene ? '#1C8A4E' : '#ffffff', color: eigene ? 'white' : '#16261F',
                      border: eigene ? 'none' : '1px solid #DCE7E2', borderRadius: 12, padding: '8px 12px'
                    }}>
                      {!eigene && <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2, color: '#1C8A4E' }}>{n.name}</div>}
                      
                      {/* BILD-ANZEIGE */}
                      {n.medien_url && (
                        <a href={n.medien_url} target="_blank" rel="noopener noreferrer">
                          <img src={n.medien_url} alt="Anhang" style={{ width: '100%', borderRadius: 8, marginTop: 4, marginBottom: 4, maxHeight: 220, objectFit: 'cover' }} />
                        </a>
                      )}

                      {/* STANDORT-ANZEIGE */}
                      {n.standort_lat && n.standort_lng && (
                        <div style={{ marginTop: 4, marginBottom: 4 }}>
                          <a
                            href={`https://www.google.com/maps?q=${n.standort_lat},${n.standort_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                              background: eigene ? 'rgba(255,255,255,0.2)' : '#F0F4F2', color: eigene ? 'white' : '#1C8A4E',
                              borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: 600
                            }}
                          >
                            📍 In Google Maps öffnen ↗
                          </a>
                        </div>
                      )}

                      {n.text && <div style={{ fontSize: 14, wordBreak: 'break-word' }}>{n.text}</div>}
                      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2, textAlign: 'right' }}>
                        {new Date(n.gesendet_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={listeEndeRef} />
            </div>

            {/* FORMULAR + TOOLBAR */}
            <form
              onSubmit={senden}
              style={{
                position: 'fixed', bottom: 60, left: 0, right: 0, background: '#ffffff',
                borderTop: '1px solid #DCE7E2', padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 8,
                maxWidth: 480, margin: '0 auto'
              }}
            >
              {/* VORSCHAU-BEREICH FÜR FOTO */}
              {bildVorschau && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F6FAF8', padding: 6, borderRadius: 8 }}>
                  <img src={bildVorschau} alt="Vorschau" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                  <span style={{ fontSize: 12, color: '#5B6D66', flex: 1 }}>Foto angehängt</span>
                  <button type="button" onClick={() => { setBildDatei(null); setBildVorschau(null) }} style={{ border: 'none', background: 'none', color: '#c0392b', fontSize: 16, cursor: 'pointer' }}>✕</button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* Unsichtbarer Input für Dateien */}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={bildAuswaehlen}
                />

                {/* Foto Button */}
                <button type="button" onClick={() => fileInputRef.current?.click()} style={iconButtonStyle} title="Foto anhängen">
                  📷
                </button>

                {/* Standort Button */}
                <button type="button" onClick={standortSenden} style={iconButtonStyle} title="Standort senden">
                  📍
                </button>

                {/* Text Input */}
                <input style={inputStyle} placeholder="Nachricht..." value={text} onChange={e => setText(e.target.value)} />
                
                {/* Senden Button */}
                <button type="submit" style={buttonStyle} disabled={hochladend}>
                  {hochladend ? '...' : 'Senden'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <BottomNav istAdmin={istAdmin} />
    </div>
  )
}

export default Chat
 
