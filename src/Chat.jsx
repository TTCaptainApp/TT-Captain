import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

const EMOJIS = ['😀','😂','👍','🙏','🏓','🔥','😉','😢','🎉','❤️','👏','🤔','😴','⏰','📍']

function Chat({ session }) {
  const { mannschaftId, spielId } = useParams()
  const typ = mannschaftId ? 'mannschaft' : spielId ? 'spiel' : 'spielfuehrer'
  const [istAdmin, setIstAdmin] = useState(false)
  const [titel, setTitel] = useState('')
  const [chatId, setChatId] = useState(null)
  const [nachrichten, setNachrichten] = useState([])
  const [text, setText] = useState('')
  const [ladend, setLadend] = useState(true)
  const [fehler, setFehler] = useState(null)
  const [keinZugriff, setKeinZugriff] = useState(false)
  const [zeigeEmojis, setZeigeEmojis] = useState(false)
  const [zeigeAnhangMenu, setZeigeAnhangMenu] = useState(false)
  const [medienHochladend, setMedienHochladend] = useState(false)
  const [namenLexikon, setNamenLexikon] = useState({})
  const [teilnehmerIds, setTeilnehmerIds] = useState([])
  const [gelesenMap, setGelesenMap] = useState({})
  const [infoNachrichtId, setInfoNachrichtId] = useState(null)
  const [scrollZuNachrichtId, setScrollZuNachrichtId] = useState(null)
  const [zeigeMentionDropdown, setZeigeMentionDropdown] = useState(false)
  const [mentionSuchbegriff, setMentionSuchbegriff] = useState('')
  const [mentionStartPos, setMentionStartPos] = useState(null)
  const listeEndeRef = useRef(null)
  const scrollZielRef = useRef(null)
  const textInputRef = useRef(null)
  const namenLexikonRef = useRef({})

  const renderNachrichtText = (text) => {
    const parts = []
    let lastIdx = 0
    
    const regex = /@([\w\sÄÖÜäöüß]+?)(?=\s|$|[.,!?:;])/g
    let match
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.substring(lastIdx, match.index))
      }
      
      const erwaehnterName = match[1].trim()
      const istGueltigeMention = Object.values(namenLexikon).some(name =>
        name.toLowerCase().includes(erwaehnterName.toLowerCase())
      )
      
      parts.push(
        <span key={`mention-${match.index}`} style={{
          color: istGueltigeMention ? '#1C8A4E' : '#667781',
          fontWeight: istGueltigeMention ? 600 : 'normal',
          backgroundColor: istGueltigeMention ? 'rgba(28, 138, 78, 0.15)' : 'transparent',
          borderRadius: istGueltigeMention ? 4 : 0,
          padding: istGueltigeMention ? '0 2px' : 0
        }}>
          @{erwaehnterName}
        </span>
      )
      
      lastIdx = regex.lastIndex
    }
    
    if (lastIdx < text.length) {
      parts.push(text.substring(lastIdx))
    }
    
    return parts.length > 0 ? parts : text
  }

  const initialLaden = async (cId) => {
    const namenQuery = typ === 'spielfuehrer' ? supabase.rpc('spielfuehrer_namen') : supabase.rpc('teamkollegen_namen')

    const [{ data: namen }, { data: nachrichtenData }] = await Promise.all([
      namenQuery,
      supabase
        .from('nachrichten')
        .select('id, benutzer_id, text, gesendet_am, medien_url, standort_lat, standort_lng')
        .eq('chat_id', cId)
        .order('gesendet_am')
    ])

    const lex = Object.fromEntries((namen || []).map(n => [n.id, `${n.vorname} ${n.nachname}`]))
    setNamenLexikon(lex)
    namenLexikonRef.current = lex

    const data = nachrichtenData || []
    setNachrichten(data.map(n => ({ ...n, name: lex[n.benutzer_id] || (n.benutzer_id === session.user.id ? 'Du' : '?') })))

    const alleIds = data.map(n => n.id)
    if (alleIds.length === 0) { setLadend(false); return }

    const { data: gelesenRows } = await supabase
      .from('nachrichten_gelesen')
      .select('nachricht_id, benutzer_id, gelesen_am')
      .in('nachricht_id', alleIds)

    const gelesenSet = new Set(
      (gelesenRows || []).filter(g => g.benutzer_id === session.user.id).map(g => g.nachricht_id)
    )

    const empfangeneIds = data.filter(n => n.benutzer_id !== session.user.id).map(n => n.id)
    const ersteUngelesene = data.find(n => n.benutzer_id !== session.user.id && !gelesenSet.has(n.id))
    setScrollZuNachrichtId(ersteUngelesene ? ersteUngelesene.id : null)

    const map = {}
    ;(gelesenRows || []).forEach(g => {
      if (!map[g.nachricht_id]) map[g.nachricht_id] = []
      map[g.nachricht_id].push(g)
    })
    setGelesenMap(map)

    const nochNichtGelesen = empfangeneIds.filter(id => !gelesenSet.has(id))
    if (nochNichtGelesen.length > 0) {
      await supabase.from('nachrichten_gelesen')
        .upsert(
          nochNichtGelesen.map(nachricht_id => ({ nachricht_id, benutzer_id: session.user.id })),
          { onConflict: 'nachricht_id,benutzer_id', ignoreDuplicates: true }
        )
    }
  }

  const initialisieren = async () => {
    setLadend(true)

    const { data: benutzerRow } = await supabase.from('benutzer').select('ist_administrator, verein_id').eq('id', session.user.id).single()
    setIstAdmin(benutzerRow?.ist_administrator || false)

    let bestehenderChat = null

    if (typ === 'mannschaft') {
      const { data: m } = await supabase.from('mannschaften').select('name').eq('id', mannschaftId).single()
      setTitel(m?.name || 'Teamchat')
      const { data: mitglieder } = await supabase.from('mannschaftszuordnungen').select('benutzer_id').eq('mannschaft_id', mannschaftId)
      setTeilnehmerIds((mitglieder || []).map(z => z.benutzer_id).filter(id => id !== session.user.id))
      const { data } = await supabase.from('chats').select('id').eq('typ', 'mannschaft').eq('mannschaft_id', mannschaftId).maybeSingle()
      bestehenderChat = data

    } else if (typ === 'spiel') {
      const { data: s } = await supabase.from('spiele').select('gegner, heim_oder_auswaerts, mannschaften(name)').eq('id', spielId).single()
      if (s) {
        setTitel(s.heim_oder_auswaerts === 'heim' ? `${s.mannschaften?.name} vs. ${s.gegner}` : `${s.gegner} vs. ${s.mannschaften?.name}`)
      }

      const { data: aufstellungCheck } = await supabase
        .from('aufstellungen')
        .select('id, aufstellung_spieler(benutzer_id)')
        .eq('spiel_id', spielId)
        .eq('veroeffentlicht', true)
        .maybeSingle()
      const berechtigt = aufstellungCheck?.aufstellung_spieler?.some(a => a.benutzer_id === session.user.id)
      if (!berechtigt) {
        setKeinZugriff(true)
        setLadend(false)
        return
      }
      setTeilnehmerIds((aufstellungCheck.aufstellung_spieler || []).map(a => a.benutzer_id).filter(id => id !== session.user.id))

      const { data } = await supabase.from('chats').select('id').eq('typ', 'spiel').eq('spiel_id', spielId).maybeSingle()
      bestehenderChat = data

    } else {
      // Vereinsweiter Spielführer-Chat
      setTitel('Spielführer-Chat')

      const { data: eigeneRolle } = await supabase
        .from('mannschaftszuordnungen')
        .select('rolle')
        .eq('benutzer_id', session.user.id)
        .in('rolle', ['spielführer', 'stellv_spielführer'])
        .limit(1)

      if (!eigeneRolle || eigeneRolle.length === 0) {
        setKeinZugriff(true)
        setLadend(false)
        return
      }

      const vereinId = benutzerRow?.verein_id
      const { data } = await supabase.from('chats').select('id').eq('typ', 'spielfuehrer').eq('verein_id', vereinId).maybeSingle()
      bestehenderChat = data

      if (!bestehenderChat) {
        const { data: neu, error } = await supabase.from('chats').insert({ typ: 'spielfuehrer', verein_id: vereinId }).select().single()
        if (error) {
          const { data: nochmal } = await supabase.from('chats').select('id').eq('typ', 'spielfuehrer').eq('verein_id', vereinId).maybeSingle()
          bestehenderChat = nochmal
          if (!bestehenderChat) { setFehler(error.message); setLadend(false); return }
        } else {
          bestehenderChat = neu
        }
      }
    }

    let cId = bestehenderChat?.id
    if (!cId && typ !== 'spielfuehrer') {
      const insertPayload = typ === 'mannschaft'
        ? { typ: 'mannschaft', mannschaft_id: mannschaftId }
        : { typ: 'spiel', spiel_id: spielId }
      const { data, error } = await supabase.from('chats').insert(insertPayload).select().single()
      if (error) {
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
    await initialLaden(cId)
    setLadend(false)
  }

  useEffect(() => { initialisieren() }, [mannschaftId, spielId, session])

  useEffect(() => {
    if (!chatId) return

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'nachrichten', filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const neue = payload.new
          const name = neue.benutzer_id === session.user.id ? 'Du' : (namenLexikonRef.current[neue.benutzer_id] || '?')

          setNachrichten(prev => prev.some(n => n.id === neue.id) ? prev : [...prev, { ...neue, name }])
          setScrollZuNachrichtId(null)

          if (neue.benutzer_id !== session.user.id) {
            await supabase.from('nachrichten_gelesen').upsert(
              { nachricht_id: neue.id, benutzer_id: session.user.id },
              { onConflict: 'nachricht_id,benutzer_id', ignoreDuplicates: true }
            )
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'nachrichten_gelesen' },
        (payload) => {
          const g = payload.new
          setGelesenMap(prev => {
            const bestehend = prev[g.nachricht_id] || []
            if (bestehend.some(e => e.benutzer_id === g.benutzer_id)) return prev
            return { ...prev, [g.nachricht_id]: [...bestehend, g] }
          })
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [chatId, session.user.id])

  useEffect(() => {
    if (ladend) return
    if (scrollZuNachrichtId && scrollZielRef.current) {
      setTimeout(() => {
        scrollZielRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    } else if (!scrollZuNachrichtId) {
      listeEndeRef.current?.scrollIntoView({ behavior: 'auto' })
    }
  }, [nachrichten, scrollZuNachrichtId, ladend])

  const senden = async (e) => {
    e.preventDefault()
    if (!text.trim() || !chatId) return
    const inhalt = text.trim()
    setText('')
    const { error } = await supabase.from('nachrichten').insert({ chat_id: chatId, benutzer_id: session.user.id, text: inhalt })
    if (error) setFehler(error.message)
  }

  const emojiEinfuegen = (emoji) => {
    setText(prev => prev + emoji)
    setZeigeEmojis(false)
  }

  const textEingabeAendern = (e) => {
    const neuerText = e.target.value
    const cursorPos = e.target.selectionStart
    setText(neuerText)

    const textVorCursor = neuerText.substring(0, cursorPos)
    const atMatch = textVorCursor.match(/@([\wÄÖÜäöüß]*)$/)

    if (atMatch) {
      setMentionSuchbegriff(atMatch[1])
      setMentionStartPos(cursorPos - atMatch[0].length)
      setZeigeMentionDropdown(true)
    } else {
      setZeigeMentionDropdown(false)
    }
  }

  const mentionAuswaehlen = (name) => {
    const vorMention = text.substring(0, mentionStartPos)
    const nachCursorPos = mentionStartPos + 1 + mentionSuchbegriff.length
    const nachMention = text.substring(nachCursorPos)
    const neuerText = `${vorMention}@${name} ${nachMention}`
    setText(neuerText)
    setZeigeMentionDropdown(false)
    textInputRef.current?.focus()
  }

  const gefilterteMentionNamen = Object.values(namenLexikon).filter(name =>
    name.toLowerCase().includes(mentionSuchbegriff.toLowerCase())
  )

  const fotoSenden = async (e) => {
    const datei = e.target.files[0]
    if (!datei || !chatId) return
    setZeigeAnhangMenu(false)
    setMedienHochladend(true)
    const dateiPfad = `${chatId}/${Date.now()}_${datei.name}`
    const { error: uploadError } = await supabase.storage.from('chat-medien').upload(dateiPfad, datei)
    if (uploadError) { setFehler(uploadError.message); setMedienHochladend(false); return }
    const { data: urlData } = supabase.storage.from('chat-medien').getPublicUrl(dateiPfad)
    await supabase.from('nachrichten').insert({ chat_id: chatId, benutzer_id: session.user.id, text: '📷 Foto', medien_url: urlData.publicUrl })
    setMedienHochladend(false)
  }

  const standortSenden = () => {
    if (!chatId || !navigator.geolocation) return
    setZeigeAnhangMenu(false)
    navigator.geolocation.getCurrentPosition(async (pos) => {
      await supabase.from('nachrichten').insert({
        chat_id: chatId, benutzer_id: session.user.id, text: '📍 Standort',
        standort_lat: pos.coords.latitude, standort_lng: pos.coords.longitude
      })
    }, () => setFehler('Standort konnte nicht ermittelt werden.'))
  }

  if (ladend) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#efeae2', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
        Lade Chat...
      </div>
    )
  }

  if (keinZugriff) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#efeae2', fontFamily: 'Inter, sans-serif', color: '#16261F', padding: 24, textAlign: 'center', gap: 12 }}>
        <p>{typ === 'spielfuehrer' ? 'Dieser Chat ist nur für Spielführer und stellvertretende Spielführer sichtbar.' : 'Dieser Spielchat ist nur für die aufgestellten Spieler sichtbar.'}</p>
        <Link to="/chats" style={{ color: '#1C8A4E', fontWeight: 600 }}>← Zurück zu Chats</Link>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', background: '#efeae2', fontFamily: 'Inter, sans-serif', color: '#16261F', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden', position: 'relative' }}>

      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 60, zIndex: 1000, padding: '0 16px', borderBottom: '1px solid #DCE7E2', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/chats" style={{ background: 'none', border: 'none', fontSize: 20, fontWeight: 700, color: '#1C8A4E', textDecoration: 'none' }}>←</Link>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1C8A4E', textTransform: 'uppercase', letterSpacing: '.04em' }}>Chat</div>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>{titel}</div>
          </div>
        </div>
        <Brand size={14} />
      </div>

      <div style={{ position: 'absolute', top: 60, bottom: 128, left: 0, right: 0, width: '100%', maxWidth: 480, margin: '0 auto', overflowY: 'auto', padding: 16, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        {fehler && <p style={{ color: '#c0392b', fontSize: 13 }}>{fehler}</p>}

        {nachrichten.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#667781', fontSize: 13, marginTop: 40, background: '#ffffff', padding: '12px 16px', borderRadius: 8, alignSelf: 'center' }}>
            Noch keine Nachrichten. Schreib die erste! 👇
          </div>
        ) : (
          nachrichten.map(n => {
            const eigene = n.benutzer_id === session.user.id
            const zeit = new Date(n.gesendet_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
            const gelesenVon = eigene ? (gelesenMap[n.id] || []) : []
            const gelesenNamen = gelesenVon.map(g => namenLexikon[g.benutzer_id] || '?')
            const istScrollZiel = scrollZuNachrichtId === n.id
            
            return (
              <div key={n.id} ref={istScrollZiel ? scrollZielRef : null} style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', alignItems: eigene ? 'flex-end' : 'flex-start' }}>
                {!eigene && <div style={{ fontSize: 11, fontWeight: 600, color: '#1C8A4E', marginBottom: 2, padding: '0 4px' }}>{n.name}</div>}
                <div style={{
                  background: eigene ? '#E7FFDB' : '#ffffff', 
                  color: '#111b21', 
                  maxWidth: '80%',
                  padding: '8px 12px 6px', 
                  borderRadius: eigene ? '7.5px 0 7.5px 7.5px' : '0 7.5px 7.5px 7.5px',
                  fontSize: 14, 
                  wordBreak: 'break-word', 
                  boxShadow: '0 1px 0.5px rgba(11,20,26,.13)',
                  border: istScrollZiel ? '2px solid #1C8A4E' : 'none'
                }}>
                  {n.medien_url && (
                    <img src={n.medien_url} alt="Foto" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 4, display: 'block' }} />
                  )}
                  {n.standort_lat && (
                    <a href={`https://www.google.com/maps?q=${n.standort_lat},${n.standort_lng}`} target="_blank" rel="noreferrer" style={{ color: '#1C8A4E', fontWeight: 600, fontSize: 13 }}>
                      📍 Standort öffnen
                    </a>
                  )}
                  {!n.medien_url && !n.standort_lat && (
                    <div style={{ paddingRight: 40, lineHeight: 1.4 }}>
                      {renderNachrichtText(n.text)}
                    </div>
                  )}
                  <div
                    style={{ fontSize: 10, color: '#667781', textAlign: 'right', marginTop: 2, cursor: eigene ? 'pointer' : 'default' }}
                    onClick={() => eigene && setInfoNachrichtId(id => id === n.id ? null : n.id)}
                  >
                    {zeit}
                    {eigene && (
                      <span style={{ color: gelesenVon.length > 0 ? '#53bdeb' : '#8696a0', fontWeight: 'bold', marginLeft: 4 }}>
                        {gelesenVon.length > 0 ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                  {eigene && infoNachrichtId === n.id && (
                    <div style={{ fontSize: 11, color: '#5B6D66', marginTop: 4, textAlign: 'right' }}>
                      {gelesenNamen.length > 0 ? `Gelesen von: ${gelesenNamen.join(', ')}` : 'Noch von niemandem gelesen'}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={listeEndeRef} />
      </div>

      {zeigeEmojis && (
        <div style={{
          position: 'fixed', bottom: 128, left: 0, right: 0, maxWidth: 480, margin: '0 auto',
          background: '#ffffff', borderTop: '1px solid #DCE7E2', padding: 10, display: 'flex',
          flexWrap: 'wrap', gap: 6, zIndex: 1000, boxSizing: 'border-box'
        }}>
          {EMOJIS.map(e => (
            <button key={e} type="button" onClick={() => emojiEinfuegen(e)} style={{ fontSize: 20, border: 'none', background: 'none', cursor: 'pointer' }}>{e}</button>
          ))}
        </div>
      )}

      {zeigeMentionDropdown && gefilterteMentionNamen.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 128, left: 0, right: 0, maxWidth: 480, margin: '0 auto',
          background: '#ffffff', borderTop: '1px solid #DCE7E2', borderRadius: '12px 12px 0 0',
          padding: 6, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 1000,
          boxSizing: 'border-box', maxHeight: 180, overflowY: 'auto',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.08)'
        }}>
          {gefilterteMentionNamen.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => mentionAuswaehlen(name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none',
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                fontSize: 14, fontFamily: 'inherit', color: '#16261F', width: '100%'
              }}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={(e) => e.currentTarget.style.background = '#F6FAF8'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: '#1C8A4E', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                fontWeight: 700, flexShrink: 0
              }}>
                {name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <span style={{ fontWeight: 600 }}>{name}</span>
            </button>
          ))}
        </div>
      )}

      {zeigeAnhangMenu && (
        <div style={{
          position: 'fixed', bottom: 128, left: 0, right: 0, maxWidth: 480, margin: '0 auto',
          background: '#ffffff', borderTop: '1px solid #DCE7E2', padding: '14px 20px', display: 'flex',
          gap: 28, zIndex: 1000, boxSizing: 'border-box'
        }}>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <div style={{
              width: 46, height: 46, borderRadius: '50%', background: '#7C5CE0', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
            }}>
              📷
            </div>
            <span style={{ fontSize: 11.5, color: '#5B6D66' }}>Foto</span>
            <input type="file" accept="image/*" onChange={fotoSenden} style={{ display: 'none' }} disabled={medienHochladend} />
          </label>

          <button
            type="button"
            onClick={standortSenden}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: '50%', background: '#1C8A4E', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
            }}>
              📍
            </div>
            <span style={{ fontSize: 11.5, color: '#5B6D66' }}>Standort</span>
          </button>
        </div>
      )}

      <form
        onSubmit={senden}
        style={{
          position: 'fixed', bottom: 64, left: 0, right: 0, minHeight: 64, background: '#f0f2f5',
          borderTop: '1px solid #DCE7E2', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center',
          maxWidth: 480, margin: '0 auto', zIndex: 1000, boxSizing: 'border-box'
        }}
      >
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff',
          borderRadius: 24, padding: '4px 6px 4px 12px', boxShadow: '0 1px 0.5px rgba(11,20,26,.13)'
        }}>
          <button
            type="button"
            onClick={() => { setZeigeEmojis(z => !z); setZeigeAnhangMenu(false) }}
            style={{ background: 'none', border: 'none', fontSize: 19, cursor: 'pointer', flexShrink: 0, lineHeight: 1, padding: 2 }}
          >
            😀
          </button>
          <input
            ref={textInputRef}
            type="text"
            placeholder="Nachricht..."
            value={text}
            onChange={textEingabeAendern}
            style={{ flex: 1, padding: '8px 2px', border: 'none', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'transparent', minWidth: 0 }}
          />
          <button
            type="button"
            onClick={() => { setZeigeAnhangMenu(m => !m); setZeigeEmojis(false) }}
            style={{ background: 'none', border: 'none', fontSize: 19, cursor: 'pointer', flexShrink: 0, lineHeight: 1, padding: 2, transform: 'rotate(45deg)', color: '#5B6D66' }}
          >
            📎
          </button>
        </div>

        <button
          type="submit"
          disabled={!text.trim()}
          style={{ background: '#00a884', color: 'white', border: 'none', borderRadius: '50%', width: 42, height: 42, fontSize: 16, cursor: 'pointer', flexShrink: 0, opacity: !text.trim() ? 0.6 : 1 }}
        >
          ➤
        </button>
      </form>

      <BottomNav istAdmin={istAdmin} session={session} />
    </div>
  )
}

export default Chat
