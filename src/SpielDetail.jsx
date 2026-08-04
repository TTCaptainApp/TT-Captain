import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

const cardStyle = { background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 16, marginBottom: 14 }
const buttonStyle = { background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const secondaryButtonStyle = { ...buttonStyle, background: 'transparent', color: '#1C8A4E', border: '1px solid #1C8A4E' }
const selectStyle = { padding: '8px 10px', fontSize: 14, borderRadius: 8, border: '1px solid #DCE7E2', width: '100%', fontFamily: 'inherit', background: '#fff' }

function SpielDetail({ session }) {
  const { spielId } = useParams()
  const navigate = useNavigate()

  const [spiel, setSpiel] = useState(null)
  const [verfuegbarkeiten, setVerfuegbarkeiten] = useState([])
  const [aufstellung, setAufstellung] = useState(null)
  const [ausgewaehlteSpieler, setAusgewaehlteSpieler] = useState({ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' })
  const [istVeroeffentlicht, setIstVeroeffentlicht] = useState(false)
  
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

    // 2. Rechte prüfen (Admin oder Spielführer der Mannschaft)
    const { data: adminData } = await supabase
      .from('benutzer')
      .select('ist_administrator')
      .eq('id', session.user.id)
      .single()
    
    if (adminData?.ist_administrator) {
      setIstAdmin(true)
    }

    const { data: zuordnung } = await supabase
      .from('mannschaftszuordnungen')
      .select('rolle')
      .eq('benutzer_id', session.user.id)
      .eq('mannschaft_id', spielData.mannschaft_id)
      .single()

    if (zuordnung && (zuordnung.rolle === 'spielfuehrer' || zuordnung.rolle === 'stellvertreter')) {
      setIstSpielfuehrer(true)
    }

    // 3. Zusagen/Absagen für dieses Spiel laden (inkl. Benutzerdetails)
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

    const aufbereiteteVerfuegbarkeiten = (verfData || []).map(v => ({
      status: v.status,
      ... (Array.isArray(v.benutzer) ? v.benutzer[0] : v.benutzer)
    }))

    setVerfuegbarkeiten(aufbereiteteVerfuegbarkeiten)

    // 4. Bisherige Aufstellung laden
    const { data: aufstellungsData } = await supabase
      .from('aufstellungen')
      .select(`
        id,
        veroeffentlicht,
        aufstellung_spieler (
          position,
          benutzer_id,
          benutzer:benutzer_id (
            vorname,
            nachname,
            qttr
          )
        )
      `)
      .eq('spiel_id', spielId)
      .single()

    if (aufstellungsData) {
      setAufstellung(aufstellungsData)
      setIstVeroeffentlicht(aufstellungsData.veroeffentlicht || false)

      const posMap = { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' }
      if (aufstellungsData.aufstellung_spieler) {
        aufstellungsData.aufstellung_spieler.forEach(sp => {
          posMap[sp.position] = sp.benutzer_id
        })
      }
      setAusgewaehlteSpieler(posMap)
    }

    setLadend(false)
  }

  useEffect(() => {
    ladeDaten()
  }, [spielId])

  // Zusagen filtern und nach QTTR absteigend sortieren
  const zusagen = verfuegbarkeiten
    .filter(v => v.status === 'zugesagt')
    .sort((a, b) => (b.qttr || 0) - (a.qttr || 0))

  const absagen = verfuegbarkeiten.filter(v => v.status === 'abgesagt')

  const kannBearbeiten = istAdmin || istSpielfuehrer

  const positionAendern = (position, benutzerId) => {
    setAusgewaehlteSpieler(prev => ({
      ...prev,
      [position]: benutzerId
    }))
  }

  const aufstellungSpeichern = async (veroeffentlichen = false) => {
    setSpeichert(true)
    setMeldung(null)

    try {
      let aufstellungId = aufstellung?.id

      // 1. Aufstellung-Eintrag anlegen oder aktualisieren
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

      // 2. Bisherige Spieler-Zuordnungen der Aufstellung löschen
      await supabase
        .from('aufstellung_spieler')
        .delete()
        .eq('aufstellung_id', aufstellungId)

      // 3. Neue Zuordnungen einfügen
      const eintraege = Object.entries(ausgewaehlteSpieler)
        .filter(([_, bId]) => bId !== '')
        .map(([pos, bId]) => ({
          aufstellung_id: aufstellungId,
          benutzer_id: bId,
          position: parseInt(pos, 10)
        }))

      if (eintraege.length > 0) {
        const { error: insertErr } = await supabase
          .from('aufstellung_spieler')
          .insert(eintraege)

        if (insertErr) throw insertErr
      }

      setIstVeroeffentlicht(veroeffentlichen)
      setMeldung(veroeffentlichen ? '✅ Aufstellung veröffentlicht!' : '💾 Aufstellung gespeichert!')
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

        {/* Zusagen Übersicht */}
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>✅ Zusagen ({zusagen.length})</span>
            <span style={{ fontSize: 12, color: '#5B6D66', fontWeight: 400 }}>geordnet nach QTTR</span>
          </div>

          {zusagen.length === 0 ? (
            <p style={{ fontSize: 13, color: '#5B6D66', margin: 0 }}>Noch keine Zusagen vorhanden.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {zusagen.map(z => (
                <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 8px', background: '#F0F7F4', borderRadius: 6 }}>
                  <span>{z.vorname} {z.nachname}</span>
                  {z.qttr && <span style={{ fontWeight: 600, color: '#1C8A4E' }}>{z.qttr} QTTR</span>}
                </div>
              ))}
            </div>
          )}

          {absagen.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #DCE7E2' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#c0392b', marginBottom: 4 }}>
                ❌ Absagen ({absagen.length}):
              </div>
              <div style={{ fontSize: 12, color: '#5B6D66' }}>
                {absagen.map(a => `${a.vorname} ${a.nachname}`).join(', ')}
              </div>
            </div>
          )}
        </div>

        {/* Aufstellung Bereich */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 16, fontWeight: 700, margin: 0 }}>
              📋 Aufstellung
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

          {/* Aufstellungs-Formular (Nur für Admin / Spielführer) */}
          {kannBearbeiten ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3, 4, 5, 6].map(pos => (
                <div key={pos} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 24, fontWeight: 700, fontSize: 13, color: '#1C8A4E' }}>Pos {pos}:</span>
                  <select
                    style={selectStyle}
                    value={ausgewaehlteSpieler[pos] || ''}
                    onChange={e => positionAendern(pos, e.target.value)}
                  >
                    <option value="">-- Nicht besetzt --</option>
                    
                    <optgroup label="✅ Aus den Zusagen wählen">
                      {zusagen.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.vorname} {s.nachname} {s.qttr ? `(${s.qttr} QTTR)` : ''}
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="👥 Alle anderen Spieler">
                      {verfuegbarkeiten
                        .filter(v => v.status !== 'zugesagt')
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            {s.vorname} {s.nachname} ({s.status === 'abgesagt' ? '❌ Absage' : '❓ Offen'})
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>
              ))}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                <button
                  onClick={() => aufstellungSpeichern(true)}
                  disabled={speichert}
                  style={buttonStyle}
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
            </div>
          ) : (
            /* Lesemodus für normale Spieler */
            <div>
              {istVeroeffentlicht ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(ausgewaehlteSpieler)
                    .filter(([_, bId]) => bId !== '')
                    .map(([pos, bId]) => {
                      const s = verfuegbarkeiten.find(v => v.id === bId)
                      return (
                        <div key={pos} style={{ fontSize: 13.5, padding: '6px 0', borderBottom: '1px dashed #DCE7E2' }}>
                          <strong>Pos {pos}:</strong> {s ? `${s.vorname} ${s.nachname}` : 'Unbekannt'} {s?.qttr ? `(${s.qttr} QTTR)` : ''}
                        </div>
                      )
                    })}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#5B6D66', margin: 0 }}>
                  Die Aufstellung wurde vom Mannschaftsführer noch nicht veröffentlicht.
                </p>
              )}
            </div>
          )}
        </div>

      </div>

      <BottomNav istAdmin={istAdmin} />
    </div>
  )
}

export default SpielDetail
 
