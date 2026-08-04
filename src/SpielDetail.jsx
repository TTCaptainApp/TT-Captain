import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

const cardStyle = { background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 16, marginBottom: 14 }
const buttonStyle = { background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const secondaryButtonStyle = { ...buttonStyle, background: 'transparent', color: '#1C8A4E', border: '1px solid #1C8A4E' }

function SpielDetail({ session }) {
  const { spielId } = useParams()
  const navigate = useNavigate()

  const [spiel, setSpiel] = useState(null)
  const [verfuegbarkeiten, setVerfuegbarkeiten] = useState([])
  const [aufstellung, setAufstellung] = useState(null)
  
  // Array von Spieler-IDs in der genauen Reihenfolge (Index 0 = Pos 1, Index 1 = Pos 2, ...)
  const [aufstellungSpielerIds, setAufstellungSpielerIds] = useState([])
  
  const [istVeroeffentlicht, setIstVeroeffentlicht] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState(null)

  const [istAdmin, setIstAdmin] = useState(false)
  const [istSpielfuehrer, setIstSpielfuehrer] = useState(false)
  const [ladend, setLadend] = useState(true)
  const [speichert, setSpeichert] = useState(false)
  const [meldung, setMeldung] = useState(null)

  const ladeDaten = async () => {
    setLadend(true)
    
    // 1. Spiel laden
    const { data: spielData, error: spielError } = await supabase
      .from('spiele')
      .select('*, mannschaften(name)')
      .eq('id', spielId)
      .single()

    if (spielError || !spielData) {
      console.error('Spiel nicht gefunden:', spielError)
      setLadend(false)
      return
    }
    setSpiel(spielData)

    // 2. Rechte prüfen
    const { data: adminData } = await supabase
      .from('benutzer')
      .select('ist_administrator')
      .eq('id', session.user.id)
      .single()
    
    if (adminData?.ist_administrator) setIstAdmin(true)

    const { data: zuordnung } = await supabase
      .from('mannschaftszuordnungen')
      .select('rolle')
      .eq('benutzer_id', session.user.id)
      .eq('mannschaft_id', spielData.mannschaft_id)
      .single()

    if (zuordnung && (zuordnung.rolle === 'spielfuehrer' || zuordnung.rolle === 'stellvertreter')) {
      setIstSpielfuehrer(true)
    }

    // 3. Zusagen/Absagen laden
    const { data: verfData } = await supabase
      .from('verfuegbarkeiten')
      .select(`
        status,
        benutzer:benutzer_id (
          id,
          vorname,
          nachname,
          qttr
        )
      `)
      .eq('spiel_id', spielId)

    const aufbereitet = (verfData || []).map(v => ({
      status: v.status,
      ...(Array.isArray(v.benutzer) ? v.benutzer[0] : v.benutzer)
    }))
    setVerfuegbarkeiten(aufbereitet)

    // 4. Bisherige Aufstellung laden
    const { data: aufstellungsData } = await supabase
      .from('aufstellungen')
      .select(`
        id,
        veroeffentlicht,
        aufstellung_spieler (
          position,
          benutzer_id
        )
      `)
      .eq('spiel_id', spielId)
      .single()

    if (aufstellungsData) {
      setAufstellung(aufstellungsData)
      setIstVeroeffentlicht(aufstellungsData.veroeffentlicht || false)

      if (aufstellungsData.aufstellung_spieler) {
        const sortiert = [...aufstellungsData.aufstellung_spieler]
          .sort((a, b) => a.position - b.position)
          .map(sp => sp.benutzer_id)
        setAufstellungSpielerIds(sortiert)
      }
    }

    setLadend(false)
  }

  useEffect(() => {
    ladeDaten()
  }, [spielId])

  // Zusagen geordnet nach QTTR
  const zusagen = verfuegbarkeiten
    .filter(v => v.status === 'zugesagt')
    .sort((a, b) => (b.qttr || 0) - (a.qttr || 0))

  const kannBearbeiten = istAdmin || istSpielfuehrer

  // Klick auf Spieler in der Zusagen-Liste (Hinzufügen oder Entfernen)
  const spielerUmschalten = (spielerId) => {
    if (!kannBearbeiten) return

    if (aufstellungSpielerIds.includes(spielerId)) {
      // Entfernen
      setAufstellungSpielerIds(prev => prev.filter(id => id !== spielerId))
    } else {
      // Hinzufügen (Max. 6 Spieler)
      if (aufstellungSpielerIds.length >= 6) {
        setMeldung('⚠️ Die Aufstellung hat bereits 6 Spieler.')
        return
      }
      setAufstellungSpielerIds(prev => [...prev, spielerId])
      setMeldung(null)
    }
  }

  // Verschieben per Buttons (Up/Down)
  const positionVerschieben = (index, richtung) => {
    const zielIndex = index + richtung
    if (zielIndex < 0 || zielIndex >= aufstellungSpielerIds.length) return

    const neu = [...aufstellungSpielerIds]
    const temp = neu[index]
    neu[index] = neu[zielIndex]
    neu[zielIndex] = temp
    setAufstellungSpielerIds(neu)
  }

  // Drag & Drop Handler
  const handleDragStart = (index) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (targetIndex) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return
    const neu = [...aufstellungSpielerIds]
    const [moved] = neu.splice(draggedIndex, 1)
    neu.splice(targetIndex, 0, moved)
    setAufstellungSpielerIds(neu)
    setDraggedIndex(null)
  }

  // Speichern in Supabase
  const aufstellungSpeichern = async (veroeffentlichen = false) => {
    setSpeichert(true)
    setMeldung(null)

    try {
      let aufstellungId = aufstellung?.id

      if (!aufstellungId) {
        const { data: neueAufstellung, error: createErr } = await supabase
          .from('aufstellungen')
          .insert({ spiel_id: spielId, veroeffentlicht: veroeffentlichen })
          .select()
          .single()

        if (createErr) throw createErr
        aufstellungId = neueAufstellung.id
      } else {
        await supabase
          .from('aufstellungen')
          .update({ veroeffentlicht: veroeffentlichen })
          .eq('id', aufstellungId)
      }

      // Zuordnungen löschen und neu schreiben
      await supabase.from('aufstellung_spieler').delete().eq('aufstellung_id', aufstellungId)

      const eintraege = aufstellungSpielerIds.map((bId, idx) => ({
        aufstellung_id: aufstellungId,
        benutzer_id: bId,
        position: idx + 1
      }))

      if (eintraege.length > 0) {
        const { error: insertErr } = await supabase.from('aufstellung_spieler').insert(eintraege)
        if (insertErr) throw insertErr
      }

      setIstVeroeffentlicht(veroeffentlichen)
      setMeldung(veroeffentlichen ? '✅ Aufstellung veröffentlicht!' : '💾 Aufstellung als Entwurf gespeichert!')
      ladeDaten()
    } catch (err) {
      console.error(err)
      setMeldung('❌ Fehler beim Speichern: ' + err.message)
    } finally {
      setSpeichert(false)
    }
  }

  if (ladend) {
    return (
      <div style={{ minHeight: '100vh', background: '#F6FAF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Lade Spiel-Details...
      </div>
    )
  }

  if (!spiel) {
    return (
      <div style={{ padding: 20 }}>
        <p>Spiel nicht gefunden.</p>
        <button style={buttonStyle} onClick={() => navigate('/spiele')}>Zurück zur Übersicht</button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Brand size={16} />
        <button onClick={() => navigate('/spiele')} style={{ ...secondaryButtonStyle, padding: '5px 10px', fontSize: 13 }}>
          ← Zurück
        </button>
      </div>

      <div style={{ padding: '20px 20px 80px', maxWidth: 480, margin: '0 auto' }}>
        
        {/* Spiel Header */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1C8A4E', textTransform: 'uppercase', marginBottom: 4 }}>
            {spiel.mannschaften?.name}
          </div>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
            {spiel.heim_oder_auswaerts === 'heim' ? `${spiel.mannschaften?.name} vs. ${spiel.gegner}` : `${spiel.gegner} vs. ${spiel.mannschaften?.name}`}
          </h1>
          <div style={{ fontSize: 13.5, color: '#5B6D66', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div>📅 {spiel.datum} {spiel.uhrzeit ? `· ⏰ ${spiel.uhrzeit.slice(0, 5)} Uhr` : ''}</div>
            {spiel.halle && <div>📍 {spiel.halle}</div>}
            <div>🏠 {spiel.heim_oder_auswaerts === 'heim' ? 'Heimspiel' : 'Auswärtsspiel'}</div>
          </div>
        </div>

        {/* Verfügbare Spieler / Zusagen */}
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span>✅ Zusagen ({zusagen.length})</span>
            {kannBearbeiten && <span style={{ fontSize: 12, color: '#1C8A4E', fontWeight: 600 }}>Tippen zum Auswählen</span>}
          </div>

          {zusagen.length === 0 ? (
            <p style={{ fontSize: 13, color: '#5B6D66', margin: 0 }}>Noch keine Zusagen vorhanden.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {zusagen.map(z => {
                const imTeam = aufstellungSpielerIds.includes(z.id)
                const posInTeam = aufstellungSpielerIds.indexOf(z.id) + 1

                return (
                  <div
                    key={z.id}
                    onClick={() => spielerUmschalten(z.id)}
                    style={{
                      display: 'flex',
                      justify: 'space-between',
                      alignItems: 'center',
                      fontSize: 13,
                      padding: '8px 12px',
                      background: imTeam ? '#E6F4EA' : '#F0F7F4',
                      border: imTeam ? '1.5px solid #1C8A4E' : '1px solid #DCE7E2',
                      borderRadius: 8,
                      cursor: kannBearbeiten ? 'pointer' : 'default',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{z.vorname} {z.nachname}</span>
                      {z.qttr && <span style={{ fontSize: 11.5, color: '#5B6D66' }}>({z.qttr} QTTR)</span>}
                    </div>

                    {imTeam ? (
                      <span style={{ background: '#1C8A4E', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                        Pos {posInTeam} ✓
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#1C8A4E', fontWeight: 600 }}>+ Hinzufügen</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Aktuelle Aufstellung (Drag & Drop + Pfeil-Steuerung) */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 16, fontWeight: 700, margin: 0 }}>
              📋 Aufstellung ({aufstellungSpielerIds.length}/6)
            </h2>
            {istVeroeffentlicht ? (
              <span style={{ background: '#E6F4EA', color: '#1C8A4E', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12 }}>
                ÖFFENTLICH
              </span>
            ) : (
              <span style={{ background: '#F1F3F4', color: '#5B6D66', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12 }}>
                ENTWURF
              </span>
            )}
          </div>

          {meldung && (
            <p style={{ fontSize: 13, padding: '8px 10px', background: '#F0F7F4', borderRadius: 6, color: '#1C8A4E', margin: '0 0 12px' }}>
              {meldung}
            </p>
          )}

          {aufstellungSpielerIds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#5B6D66', fontSize: 13, border: '1px dashed #DCE7E2', borderRadius: 8 }}>
              Klicke oben auf die Zusagen, um Spieler in die Aufstellung aufzunehmen.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aufstellungSpielerIds.map((bId, idx) => {
                const s = verfuegbarkeiten.find(v => v.id === bId)

                return (
                  <div
                    key={bId}
                    draggable={kannBearbeiten}
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: '#ffffff',
                      border: '1px solid #DCE7E2',
                      borderRadius: 8,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      cursor: kannBearbeiten ? 'grab' : 'default'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: '#1C8A4E', width: 22 }}>
                        {idx + 1}.
                      </span>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                          {s ? `${s.vorname} ${s.nachname}` : 'Spieler'}
                        </div>
                        {s?.qttr && <div style={{ fontSize: 11, color: '#5B6D66' }}>{s.qttr} QTTR</div>}
                      </div>
                    </div>

                    {kannBearbeiten && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {/* Reihenfolge ändern Buttons */}
                        <button
                          onClick={() => positionVerschieben(idx, -1)}
                          disabled={idx === 0}
                          style={{ border: 'none', background: '#F0F7F4', borderRadius: 4, padding: '4px 7px', cursor: 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
                        >
                          ⬆️
                        </button>
                        <button
                          onClick={() => positionVerschieben(idx, 1)}
                          disabled={idx === aufstellungSpielerIds.length - 1}
                          style={{ border: 'none', background: '#F0F7F4', borderRadius: 4, padding: '4px 7px', cursor: 'pointer', opacity: idx === aufstellungSpielerIds.length - 1 ? 0.3 : 1 }}
                        >
                          ⬇️
                        </button>

                        {/* Entfernen Button */}
                        <button
                          onClick={() => spielerUmschalten(bId)}
                          style={{ border: 'none', background: '#FDF2F2', color: '#c0392b', borderRadius: 4, padding: '4px 7px', cursor: 'pointer', marginLeft: 4 }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Speichern Buttons */}
          {kannBearbeiten && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => aufstellungSpeichern(true)}
                disabled={speichert || aufstellungSpielerIds.length === 0}
                style={{ ...buttonStyle, opacity: aufstellungSpielerIds.length === 0 ? 0.5 : 1 }}
              >
                🚀 Aufstellung veröffentlichen
              </button>
              <button
                onClick={() => aufstellungSpeichern(false)}
                disabled={speichert}
                style={secondaryButtonStyle}
              >
                💾 Als Entwurf speichern
              </button>
            </div>
          )}
        </div>

      </div>

      <BottomNav istAdmin={istAdmin} />
    </div>
  )
}

export default SpielDetail
 
