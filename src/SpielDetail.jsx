import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #DCE7E2',
  borderRadius: 14,
  padding: 16,
  marginBottom: 16
}

function SpielDetail({ session }) {
  const { spielId } = useParams()
  
  const [spiel, setSpiel] = useState(null)
  const [teamMitglieder, setTeamMitglieder] = useState([])
  const [aufstellung, setAufstellung] = useState([])
  const [eigeneRolle, setEigeneRolle] = useState(null)
  const [istAdmin, setIstAdmin] = useState(false)
  
  const [istFreigegeben, setIstFreigegeben] = useState(false)
  const [ladend, setLadend] = useState(true)
  const [speichernd, setSpeichernd] = useState(false)
  const [meldung, setMeldung] = useState(null)

  const datenLaden = async () => {
    setLadend(true)

    // 1. Admin-Status prüfen
    const { data: bRow } = await supabase
      .from('benutzer')
      .select('ist_administrator')
      .eq('id', session.user.id)
      .single()
    setIstAdmin(!!bRow?.ist_administrator)

    // 2. Spiel-Details laden
    const { data: spielData } = await supabase
      .from('spiele')
      .select('*, mannschaften(id, name)')
      .eq('id', spielId)
      .single()

    if (!spielData) {
      setLadend(false)
      return
    }

    setSpiel(spielData)
    setIstFreigegeben(spielData.aufstellung_freigegeben || false)

    // 3. Eigene Rolle in dieser Mannschaft prüfen
    const { data: zRow } = await supabase
      .from('mannschaftszuordnungen')
      .select('rolle')
      .eq('benutzer_id', session.user.id)
      .eq('mannschaft_id', spielData.mannschaft_id)
      .maybeSingle()

    setEigeneRolle(zRow?.rolle || null)

    // 4. Alle Mitglieder dieser Mannschaft laden
    const { data: mMitglieder } = await supabase
      .from('mannschaftszuordnungen')
      .select('benutzer_id, rolle, benutzer(id, vorname, nachname)')
      .eq('mannschaft_id', spielData.mannschaft_id)

    setTeamMitglieder(mMitglieder || [])

    // 5. Aktuelle Aufstellung für dieses Spiel laden
    const { data: aData } = await supabase
      .from('spiel_aufstellungen')
      .select('benutzer_id, position')
      .eq('spiel_id', spielId)
      .order('position')

    setAufstellung(aData ? aData.map(a => a.benutzer_id) : [])
    setLadend(false)
  }

  useEffect(() => {
    datenLaden()
  }, [spielId, session])

  // Recht um Aufstellung zu bearbeiten: Admin OR Spielführer OR Stellvertreter
  const darfBearbeiten = istAdmin || eigeneRolle === 'spielfuehrer' || eigeneRolle === 'stellvertreter'

  // Spieler zur Aufstellung hinzufügen / entfernen
  const toggleSpielerAufstellung = (userId) => {
    if (!darfBearbeiten) return

    if (aufstellung.includes(userId)) {
      setAufstellung(aufstellung.filter(id => id !== userId))
    } else {
      setAufstellung([...aufstellung, userId])
    }
  }

  // Aufstellung & Freigabe-Status in Supabase speichern
  const aufstellungSpeichern = async (neuerFreigabeStatus = istFreigegeben) => {
    setSpeichernd(true)
    setMeldung(null)

    // 1. Freigabe-Status beim Spiel aktualisieren
    const { error: sError } = await supabase
      .from('spiele')
      .update({ aufstellung_freigegeben: neuerFreigabeStatus })
      .eq('id', spielId)

    if (sError) {
      setMeldung({ typ: 'error', text: sError.message })
      setSpeichernd(false)
      return
    }

    // 2. Bisherige Aufstellungseinträge löschen
    await supabase
      .from('spiel_aufstellungen')
      .delete()
      .eq('spiel_id', spielId)

    // 3. Neue Aufstellung eintragen
    if (aufstellung.length > 0) {
      const eintrege = aufstellung.map((bId, idx) => ({
        spiel_id: spielId,
        benutzer_id: bId,
        position: idx + 1
      }))

      const { error: aError } = await supabase
        .from('spiel_aufstellungen')
        .insert(eintrege)

      if (aError) {
        setMeldung({ typ: 'error', text: aError.message })
        setSpeichernd(false)
        return
      }
    }

    setIstFreigegeben(neuerFreigabeStatus)
    setSpeichernd(false)
    setMeldung({ typ: 'success', text: 'Aufstellung erfolgreich gespeichert!' })
    setTimeout(() => setMeldung(null), 3000)
  }

  if (ladend) return null

  if (!spiel) {
    return (
      <div style={{ padding: 20, fontFamily: 'Inter, sans-serif' }}>
        <p>Spiel nicht gefunden.</p>
        <Link to="/" style={{ color: '#1C8A4E' }}>Zurück zur Übersicht</Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff' }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 20px 100px', maxWidth: 480, margin: '0 auto' }}>
        
        {/* HEADLINE & DETAILS */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1C8A4E', textTransform: 'uppercase', marginBottom: 4 }}>
            {spiel.mannschaften?.name}
          </div>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 18, margin: '0 0 8px' }}>
            vs. {spiel.gegner || 'Unbekannt'}
          </h1>
          <div style={{ fontSize: 13, color: '#5B6D66', display: 'flex', gap: 12 }}>
            <span>📅 {spiel.datum ? new Date(spiel.datum).toLocaleDateString('de-DE') : 'Termin offen'}</span>
            <span>📍 {spiel.is_heimspiel ? 'Heimspiel' : 'Auswärts'}</span>
          </div>
        </div>

        {meldung && (
          <div style={{
            padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500,
            background: meldung.typ === 'error' ? '#FDF2F2' : '#E8F5E9',
            color: meldung.typ === 'error' ? '#991B1B' : '#1B5E20',
            border: `1px solid ${meldung.typ === 'error' ? '#F87171' : '#81C784'}`
          }}>
            {meldung.text}
          </div>
        )}

        {/* AUFSTELLUNGS-BEREICH */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, margin: 0 }}>
              📋 Aufstellung ({aufstellung.length})
            </h3>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
              background: istFreigegeben ? '#E8F5E9' : '#FFF8E1',
              color: istFreigegeben ? '#1B5E20' : '#B78103'
            }}>
              {istFreigegeben ? 'Freigegeben' : 'Entwurf'}
            </span>
          </div>

          {/* Anzeige für normale Spieler, wenn Aufstellung noch nicht freigegeben ist */}
          {!darfBearbeiten && !istFreigegeben ? (
            <p style={{ fontSize: 13, color: '#5B6D66', fontStyle: 'italic', margin: 0 }}>
              Die Aufstellung für dieses Spiel wurde vom Spielführer noch nicht veröffentlicht.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {teamMitglieder.map(tm => {
                const b = tm.benutzer
                const istInAufstellung = aufstellung.includes(b.id)
                const posIndex = aufstellung.indexOf(b.id) + 1

                return (
                  <div
                    key={b.id}
                    onClick={() => darfBearbeiten && toggleSpielerAufstellung(b.id)}
                    style={{
                      padding: 10, borderRadius: 8, border: '1px solid',
                      borderColor: istInAufstellung ? '#1C8A4E' : '#DCE7E2',
                      background: istInAufstellung ? '#F0FDF4' : '#FFFFFF',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      cursor: darfBearbeiten ? 'pointer' : 'default'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: istInAufstellung ? '#1C8A4E' : '#EFEFEF',
                        color: istInAufstellung ? '#FFFFFF' : '#5B6D66'
                      }}>
                        {istInAufstellung ? posIndex : '-'}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: istInAufstellung ? 600 : 400 }}>
                        {b.vorname} {b.nachname}
                      </span>
                    </div>

                    {tm.rolle !== 'spieler' && (
                      <span style={{ fontSize: 11, color: '#5B6D66', background: '#F0F4F2', padding: '2px 6px', borderRadius: 4 }}>
                        {tm.rolle === 'spielfuehrer' ? 'Spielführer' : 'Stellv.'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* SPEICHERN & FREIGABE BUTTONS (NUR FÜR LEITUNG & ADMINS) */}
          {darfBearbeiten && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => aufstellungSpeichern(istFreigegeben)}
                disabled={speichernd}
                style={{
                  width: '100%', background: '#1C8A4E', color: 'white', border: 'none',
                  borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
              >
                💾 Aufstellung speichern
              </button>

              <button
                onClick={() => aufstellungSpeichern(!istFreigegeben)}
                disabled={speichernd}
                style={{
                  width: '100%', background: istFreigegeben ? '#FFF3E0' : '#E8F5E9',
                  color: istFreigegeben ? '#E65100' : '#1B5E20',
                  border: `1px solid ${istFreigegeben ? '#FFB74D' : '#81C784'}`,
                  borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
              >
                {istFreigegeben ? '🔒 Freigabe zurücknehmen' : '📢 Aufstellung freigeben & veröffentlichen'}
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
