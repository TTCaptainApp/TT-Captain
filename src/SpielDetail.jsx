import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

// Mobile-First Style Essentials
const cardStyle = { 
  background: '#ffffff', 
  border: '1px solid #DCE7E2', 
  borderRadius: 14, 
  padding: 16, 
  marginBottom: 14,
  boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
}

const primaryButtonStyle = { 
  background: '#1C8A4E', 
  color: 'white', 
  border: 'none', 
  borderRadius: 10, 
  padding: '12px 16px', 
  fontSize: 14, 
  fontWeight: 600, 
  cursor: 'pointer',
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%'
}

const secondaryButtonStyle = { 
  ...primaryButtonStyle, 
  background: 'transparent', 
  color: '#1C8A4E', 
  border: '1px solid #1C8A4E' 
}

const selectStyle = { 
  padding: '10px 12px', 
  fontSize: 14, 
  borderRadius: 8, 
  border: '1px solid #DCE7E2', 
  width: '100%', 
  fontFamily: 'inherit', 
  background: '#fff',
  minHeight: 44
}

function SpielDetail({ session }) {
  const { spielId } = useParams()
  const navigate = useNavigate()

  const [spiel, setSpiel] = useState(null)
  const [mannschaft, setMannschaft] = useState(null)
  const [verfuegbarkeiten, setVerfuegbarkeiten] = useState([])
  const [ersatzAnfragen, setErsatzAnfragen] = useState([])
  
  const [moeglicheErsatzspieler, setMoeglicheErsatzspieler] = useState([])
  const [ausgewaehlterErsatz, setAusgewaehlterErsatz] = useState('')

  const [aufstellung, setAufstellung] = useState(null)
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
    try {
      // 1. Spiel abrufen
      const { data: spielData, error: spielError } = await supabase
        .from('spiele')
        .select('*')
        .eq('id', spielId)
        .single()

      if (spielError || !spielData) {
        console.error('Spiel nicht gefunden:', spielError)
        setLadend(false)
        return
      }
      setSpiel(spielData)

      // 2. Mannschaft abrufen
      let mannschaftsData = null
      if (spielData.mannschaft_id) {
        const { data: mData } = await supabase
          .from('mannschaften')
          .select('*')
          .eq('id', spielData.mannschaft_id)
          .single()
        mannschaftsData = mData
        setMannschaft(mData)
      }

      const aktuelleReihenfolge = mannschaftsData?.reihenfolge || 1
      const spielDatum = spielData.datum

      // 3. Rechte prüfen
      if (session?.user?.id) {
        const { data: adminData } = await supabase
          .from('benutzer')
          .select('ist_administrator')
          .eq('id', session.user.id)
          .single()
        
        if (adminData?.ist_administrator) setIstAdmin(true)

        if (spielData.mannschaft_id) {
          const { data: zuordnung } = await supabase
            .from('mannschaftszuordnungen')
            .select('rolle')
            .eq('benutzer_id', session.user.id)
            .eq('mannschaft_id', spielData.mannschaft_id)
            .maybeSingle()

          if (zuordnung && (zuordnung.rolle === 'spielfuehrer' || zuordnung.rolle === 'stellvertreter')) {
            setIstSpielfuehrer(true)
          }
        }
      }

      // 4. Verfügbarkeiten & Benutzer laden
      const { data: verfData } = await supabase
        .from('verfuegbarkeiten')
        .select('*, benutzer:benutzer_id(id, vorname, nachname, qttr)')
        .eq('spiel_id', spielId)

      const aufbereitet = (verfData || []).map(v => ({
        status: v.status,
        ...(Array.isArray(v.benutzer) ? v.benutzer[0] : v.benutzer)
      }))
      setVerfuegbarkeiten(aufbereitet)

      // 5. Ersatz-Anfragen laden
      const { data: ersatzData } = await supabase
        .from('ersatz_anfragen')
        .select('*, benutzer:benutzer_id(id, vorname, nachname, qttr)')
        .eq('spiel_id', spielId)

      const aufbereiteteErsatz = (ersatzData || []).map(e => ({
        anfrageId: e.id,
        status: e.status,
        ...(Array.isArray(e.benutzer) ? e.benutzer[0] : e.benutzer)
      }))
      setErsatzAnfragen(aufbereiteteErsatz)

      // 6. Termin-Kollisionen am gleichen Tag
      let blockierteSpielerIds = new Set()
      if (spielDatum) {
        const { data: spieleAmTag } = await supabase
          .from('spiele')
          .select('id')
          .eq('datum', spielDatum)
          .neq('id', spielId)

        const spielIdsGleicherTag = (spieleAmTag || []).map(s => s.id)

        if (spielIdsGleicherTag.length > 0) {
          const { data: verfGleicherTag } = await supabase
            .from('verfuegbarkeiten')
            .select('benutzer_id')
            .in('spiel_id', spielIdsGleicherTag)
            .eq('status', 'zugesagt')

          const { data: ersatzGleicherTag } = await supabase
            .from('ersatz_anfragen')
            .select('benutzer_id')
            .in('spiel_id', spielIdsGleicherTag)
            .eq('status', 'zugesagt')

          ;(verfGleicherTag || []).forEach(v => blockierteSpielerIds.add(v.benutzer_id))
          ;(ersatzGleicherTag || []).forEach(e => blockierteSpielerIds.add(e.benutzer_id))
        }
      }

      // 7. Ersatzspieler aus tieferen Teams laden
      const { data: alleZuordnungen } = await supabase
        .from('mannschaftszuordnungen')
        .select('benutzer_id, mannschaft_id, mannschaften(id, name, reihenfolge), benutzer(id, vorname, nachname, qttr)')

      if (alleZuordnungen) {
        const gefiltert = alleZuordnungen
          .filter(z => {
            const team = Array.isArray(z.mannschaften) ? z.mannschaften[0] : z.mannschaften
            const player = Array.isArray(z.benutzer) ? z.benutzer[0] : z.benutzer
            
            if (!team || !player) return false

            const teamReihenfolge = team.reihenfolge || 99
            const istTieferesTeam = teamReihenfolge > aktuelleReihenfolge
            const istFreiAmSpieltag = !blockierteSpielerIds.has(player.id)

            return istTieferesTeam && istFreiAmSpieltag
          })
          .map(z => {
            const team = Array.isArray(z.mannschaften) ? z.mannschaften[0] : z.mannschaften
            const player = Array.isArray(z.benutzer) ? z.benutzer[0] : z.benutzer
            return {
              ...player,
              mannschaftsName: team?.name || 'Tieferes Team'
            }
          })
          .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
          .sort((a, b) => (b.qttr || 0) - (a.qttr || 0))

        setMoeglicheErsatzspieler(gefiltert)
      }

      // 8. Bisherige Aufstellung laden
      const { data: aufstellungsData } = await supabase
        .from('aufstellungen')
        .select('*, aufstellung_spieler(position, benutzer_id)')
        .eq('spiel_id', spielId)
        .maybeSingle()

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
    } catch (err) {
      console.error('Fehler beim Laden der Details:', err)
    } finally {
      setLadend(false)
    }
  }

  useEffect(() => {
    ladeDaten()
  }, [spielId])

  const kannBearbeiten = istAdmin || istSpielfuehrer

  // Zusagen
  const zusagenStamm = verfuegbarkeiten.filter(v => v.status === 'zugesagt')
  const zusagenErsatz = ersatzAnfragen.filter(e => e.status === 'zugesagt')
  const alleZusagen = [...zusagenStamm, ...zusagenErsatz].sort((a, b) => (b.qttr || 0) - (a.qttr || 0))

  // Spieler umschalten
  const spielerUmschalten = (spielerId) => {
    if (!kannBearbeiten) return

    if (aufstellungSpielerIds.includes(spielerId)) {
      setAufstellungSpielerIds(prev => prev.filter(id => id !== spielerId))
    } else {
      if (aufstellungSpielerIds.length >= 6) {
        setMeldung('⚠️ Maximum von 6 Spielern erreicht.')
        return
      }
      setAufstellungSpielerIds(prev => [...prev, spielerId])
      setMeldung(null)
    }
  }

  // Ersatzanfrage senden
  const ersatzAnfragenAbsenden = async () => {
    if (!ausgewaehlterErsatz) return
    setSpeichert(true)
    
    try {
      const { error } = await supabase
        .from('ersatz_anfragen')
        .insert({
          spiel_id: spielId,
          benutzer_id: ausgewaehlterErsatz,
          status: 'angefragt'
        })

      if (error) throw error

      setMeldung('✅ Ersatzspieler-Anfrage gesendet!')
      setAusgewaehlterErsatz('')
      ladeDaten()
    } catch (err) {
      console.error(err)
      setMeldung('❌ Fehler beim Anfragen: ' + err.message)
    } finally {
      setSpeichert(false)
    }
  }

  // Position verschieben
  const positionVerschieben = (index, richtung) => {
    const zielIndex = index + richtung
    if (zielIndex < 0 || zielIndex >= aufstellungSpielerIds.length) return

    const neu = [...aufstellungSpielerIds]
    const temp = neu[index]
    neu[index] = neu[zielIndex]
    neu[zielIndex] = temp
    setAufstellungSpielerIds(neu)
  }

  // Drag & Drop
  const handleDragStart = (index) => setDraggedIndex(index)
  const handleDragOver = (e) => e.preventDefault()
  const handleDrop = (targetIndex) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return
    const neu = [...aufstellungSpielerIds]
    const [moved] = neu.splice(draggedIndex, 1)
    neu.splice(targetIndex, 0, moved)
    setAufstellungSpielerIds(neu)
    setDraggedIndex(null)
  }

  // Aufstellung speichern
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
      setMeldung(veroeffentlichen ? '✅ Aufstellung veröffentlicht!' : '💾 Als Entwurf gespeichert!')
      ladeDaten()
    } catch (err) {
      console.error(err)
      setMeldung('❌ Fehler: ' + err.message)
    } finally {
      setSpeichert(false)
    }
  }

  if (ladend) {
    return (
      <div style={{ minHeight: '100vh', background: '#F6FAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        Lade Details...
      </div>
    )
  }

  const teamName = mannschaft?.name || 'Mannschaft'
  const gegnerName = spiel?.gegner || 'Gegner'
  const titel = spiel?.heim_oder_auswaerts === 'heim' 
    ? `${teamName} vs. ${gegnerName}` 
    : `${gegnerName} vs. ${teamName}`

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #DCE7E2', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Brand size={16} />
        <button onClick={() => navigate('/spiele')} style={{ ...secondaryButtonStyle, padding: '6px 12px', fontSize: 13, minHeight: 'auto', width: 'auto' }}>
          ← Zurück
        </button>
      </div>

      <div style={{ padding: '16px 16px 80px', maxWidth: 480, margin: '0 auto' }}>
        
        {/* Spiel Header */}
        <div style={cardStyle}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1C8A4E', textTransform: 'uppercase', marginBottom: 2 }}>
            {teamName}
          </div>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>
            {titel}
          </h1>
          <div style={{ fontSize: 13, color: '#5B6D66', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div>📅 {spiel?.datum || 'Kein Datum'} {spiel?.uhrzeit ? `· ⏰ ${spiel?.uhrzeit.slice(0, 5)} Uhr` : ''}</div>
            {spiel?.halle && <div>📍 {spiel?.halle}</div>}
          </div>
        </div>

        {/* Zusagen Übersicht */}
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>✅ Verfügbare Spieler ({alleZusagen.length})</span>
            {kannBearbeiten && <span style={{ fontSize: 11, color: '#1C8A4E', fontWeight: 600 }}>Tippen zum Wählen</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alleZusagen.length === 0 ? (
              <p style={{ fontSize: 13, color: '#5B6D66', margin: 0 }}>Noch keine Zusagen vorhanden.</p>
            ) : (
              alleZusagen.map(z => {
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
                      padding: '10px 12px',
                      background: imTeam ? '#E6F4EA' : '#F0F7F4',
                      border: imTeam ? '1.5px solid #1C8A4E' : '1px solid #DCE7E2',
                      borderRadius: 10,
                      cursor: kannBearbeiten ? 'pointer' : 'default'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600 }}>{z.vorname} {z.nachname}</span>
                      {z.status === 'zugesagt' && z.anfrageId && <span style={{ fontSize: 10, background: '#E3F2FD', color: '#1976D2', padding: '2px 5px', borderRadius: 4 }}>Ersatz</span>}
                      {z.qttr && <span style={{ fontSize: 11, color: '#5B6D66' }}>({z.qttr})</span>}
                    </div>

                    {kannBearbeiten && (
                      imTeam ? (
                        <span style={{ background: '#1C8A4E', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12 }}>
                          Pos {posInTeam} ✓
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#1C8A4E', fontWeight: 600 }}>+ Aufnehmen</span>
                      )
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ERSATZSPIELER ANFRAGEN (Nur für Kapitäne/Admins) */}
        {kannBearbeiten && (
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              🔄 Ersatzspieler anfragen
            </div>
            <div style={{ fontSize: 12, color: '#5B6D66', marginBottom: 10 }}>
              Zeigt verfügbare Spieler aus tieferen Teams ohne Spielüberschneidung an.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <select
                style={selectStyle}
                value={ausgewaehlterErsatz}
                onChange={e => setAusgewaehlterErsatz(e.target.value)}
              >
                <option value="">-- Ersatzspieler wählen --</option>
                {moeglicheErsatzspieler.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.vorname} {b.nachname} ({b.mannschaftsName} · {b.qttr ? `${b.qttr} QTTR` : 'Kein QTTR'})
                  </option>
                ))}
              </select>

              <button
                onClick={ersatzAnfragenAbsenden}
                disabled={!ausgewaehlterErsatz || speichert}
                style={{ ...secondaryButtonStyle, opacity: !ausgewaehlterErsatz ? 0.5 : 1 }}
              >
                📩 Ersatz-Anfrage senden
              </button>
            </div>

            {ersatzAnfragen.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #DCE7E2' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#5B6D66', marginBottom: 6 }}>
                  Angefragte Ersatzspieler:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ersatzAnfragen.map(e => (
                    <div key={e.anfrageId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{e.vorname} {e.nachname}</span>
                      <span style={{ 
                        fontWeight: 600, 
                        color: e.status === 'zugesagt' ? '#1C8A4E' : e.status === 'abgesagt' ? '#c0392b' : '#d35400' 
                      }}>
                        {e.status === 'zugesagt' ? '✅ Zugesagt' : e.status === 'abgesagt' ? '❌ Abgesagt' : '⏳ Ausstehend'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AUFSTELLUNG CARD */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 16, fontWeight: 700, margin: 0 }}>
              📋 Aufstellung {kannBearbeiten && `(${aufstellungSpielerIds.length}/6)`}
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

          {/* HINWEIS FÜR SPIELFÜHRER / ADMIN */}
          {kannBearbeiten && (
            <div style={{ 
              fontSize: 12, 
              padding: '8px 12px', 
              background: istVeroeffentlicht ? '#E6F4EA' : '#FFF8E1', 
              border: `1px solid ${istVeroeffentlicht ? '#B8E0C4' : '#FFE0B2'}`, 
              borderRadius: 8, 
              color: istVeroeffentlicht ? '#1C8A4E' : '#B7791F', 
              marginBottom: 12,
              fontWeight: 500
            }}>
              {istVeroeffentlicht 
                ? '👁️ Diese Aufstellung ist für alle Spieler sichtbar.' 
                : '🔒 Diese Aufstellung ist aktuell nur für dich sichtbar (Entwurf).'}
            </div>
          )}

          {meldung && (
            <p style={{ fontSize: 13, padding: '8px 10px', background: '#F0F7F4', borderRadius: 6, color: '#1C8A4E', margin: '0 0 12px' }}>
              {meldung}
            </p>
          )}

          {/* SPERRE: Normaler Spieler sieht keine unveröffentlichte Aufstellung */}
          {!istVeroeffentlicht && !kannBearbeiten ? (
            <div style={{ textAlign: 'center', padding: '20px 10px', color: '#5B6D66', fontSize: 13, border: '1px dashed #DCE7E2', borderRadius: 10, background: '#FAFCFB' }}>
              🔒 Die Aufstellung ist noch nicht veröffentlicht.
            </div>
          ) : (
            <>
              {aufstellungSpielerIds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', color: '#5B6D66', fontSize: 13, border: '1px dashed #DCE7E2', borderRadius: 8 }}>
                  {kannBearbeiten ? 'Wähle oben verfügbare Spieler aus.' : 'Noch keine Aufstellung vorhanden.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {aufstellungSpielerIds.map((bId, idx) => {
                    const s = [...verfuegbarkeiten, ...moeglicheErsatzspieler].find(b => b.id === bId)

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
                          justify: 'space-between',
                          padding: '10px 12px',
                          background: '#ffffff',
                          border: '1px solid #DCE7E2',
                          borderRadius: 10,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: '#1C8A4E', width: 20 }}>
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
                            <button
                              onClick={() => positionVerschieben(idx, -1)}
                              disabled={idx === 0}
                              style={{ border: 'none', background: '#F0F7F4', borderRadius: 6, width: 34, height: 34, cursor: 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
                            >
                              ⬆️
                            </button>
                            <button
                              onClick={() => positionVerschieben(idx, 1)}
                              disabled={idx === aufstellungSpielerIds.length - 1}
                              style={{ border: 'none', background: '#F0F7F4', borderRadius: 6, width: 34, height: 34, cursor: 'pointer', opacity: idx === aufstellungSpielerIds.length - 1 ? 0.3 : 1 }}
                            >
                              ⬇️
                            </button>
                            <button
                              onClick={() => spielerUmschalten(bId)}
                              style={{ border: 'none', background: '#FDF2F2', color: '#c0392b', borderRadius: 6, width: 34, height: 34, cursor: 'pointer', marginLeft: 2 }}
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
            </>
          )}

          {/* Speichern Buttons (Nur Admins/Spielführer) */}
          {kannBearbeiten && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => aufstellungSpeichern(true)}
                disabled={speichert || aufstellungSpielerIds.length === 0}
                style={{ ...primaryButtonStyle, opacity: aufstellungSpielerIds.length === 0 ? 0.5 : 1 }}
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
