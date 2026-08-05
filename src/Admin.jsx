import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

function Admin({ session }) {
  const navigate = useNavigate()
  const [benutzerListe, setBenutzerListe] = useState([])
  const [mannschaftenListe, setMannschaftenListe] = useState([])
  const [alleMannschaften, setAlleMannschaften] = useState([])
  const [zuordnungen, setZuordnungen] = useState([])
  const [loeschantraege, setLoeschantraege] = useState([])
  const [istAdmin, setIstAdmin] = useState(false)
  const [ladend, setLadend] = useState(true)
  const [meldung, setMeldung] = useState(null)

  // Formular-States
  const [selectedBenutzer, setSelectedBenutzer] = useState('')
  const [selectedMannschaft, setSelectedMannschaft] = useState('')
  const [selectedRolle, setSelectedRolle] = useState('spieler')

  // Mannschaft archivieren
  const [archivierenBestaetigen, setArchivierenBestaetigen] = useState(null) // { id, name, spieleAnzahl, mitgliederAnzahl }
  const [zeigeArchivierte, setZeigeArchivierte] = useState(false)
  const [archivierenLaeuft, setArchivierenLaeuft] = useState(false)

  const datenLaden = async () => {
    try {
      setLadend(true)
      
      // 1. Prüfen ob Admin
      const { data: prof } = await supabase
        .from('benutzer')
        .select('ist_administrator')
        .eq('id', session.user.id)
        .maybeSingle()

      const adminFlag = prof?.ist_administrator || false
      setIstAdmin(adminFlag)

      // 2. Zuordnungen des aktuellen Nutzers prüfen (für Spielführer-Rolle)
      const { data: meineZuordnungen } = await supabase
        .from('mannschaftszuordnungen')
        .select('mannschaft_id, rolle')
        .eq('benutzer_id', session.user.id)

      const gefuehrteTeamIds = meineZuordnungen
        ?.filter(z => z.rolle === 'spielfuehrer')
        .map(z => z.mannschaft_id) || []

      // Zugang verweigern, wenn weder Admin noch Spielführer
      if (!adminFlag && gefuehrteTeamIds.length === 0) {
        navigate('/')
        return
      }

      // 3. Alle Benutzer laden (für Auswahlliste)
      const { data: bData } = await supabase
        .from('benutzer')
        .select('id, vorname, nachname, email')
        .order('vorname')

      setBenutzerListe(bData || [])
      if (bData && bData.length > 0) setSelectedBenutzer(bData[0].id)

      // 4. Mannschaften laden (Admin = Alle nicht-archivierten, Spielführer = Nur eigene)
      let mQuery = supabase.from('mannschaften').select('id, name, archiviert').eq('archiviert', false).order('name')
      if (!adminFlag) {
        mQuery = mQuery.in('id', gefuehrteTeamIds)
      }
      const { data: mData } = await mQuery
      setMannschaftenListe(mData || [])
      if (mData && mData.length > 0) setSelectedMannschaft(mData[0].id)

      // 4b. Für Admin: ALLE Mannschaften (inkl. archiviert) für die Verwaltungs-Sektion laden
      if (adminFlag) {
        const { data: alleM } = await supabase
          .from('mannschaften')
          .select('id, name, archiviert, archiviert_am')
          .order('archiviert')
          .order('name')
        setAlleMannschaften(alleM || [])
      }

      // 5. Zuordnungen laden
      let zQuery = supabase
        .from('mannschaftszuordnungen')
        .select('id, benutzer_id, mannschaft_id, rolle, benutzer(id, vorname, nachname, email), mannschaften(id, name)')
      
      if (!adminFlag) {
        zQuery = zQuery.in('mannschaft_id', gefuehrteTeamIds)
      }
      const { data: zData } = await zQuery
      setZuordnungen(zData || [])

      // 6. Offene Löschanträge laden (nur für Administratoren)
      if (adminFlag) {
        const { data: lData } = await supabase
          .from('benutzer')
          .select('id, vorname, nachname, email, loeschung_beantragt_am')
          .eq('loeschung_beantragt', true)
          .order('loeschung_beantragt_am')
        setLoeschantraege(lData || [])
      }

    } catch (err) {
      console.error(err)
      setMeldung({ typ: 'error', text: 'Fehler beim Laden der Daten.' })
    } finally {
      setLadend(false)
    }
  }

  useEffect(() => {
    if (session) {
      datenLaden()
    }
  }, [session])

  const zuweisungSpeichern = async (e) => {
    e.preventDefault()
    setMeldung(null)

    if (!selectedBenutzer || !selectedMannschaft) {
      setMeldung({ typ: 'error', text: 'Bitte Benutzer und Mannschaft auswählen.' })
      return
    }

    try {
      const { error } = await supabase
        .from('mannschaftszuordnungen')
        .insert([
          { benutzer_id: selectedBenutzer, mannschaft_id: selectedMannschaft, rolle: selectedRolle }
        ])

      if (error) throw error

      setMeldung({ typ: 'success', text: 'Zuordnung erfolgreich gespeichert.' })
      datenLaden()
    } catch (err) {
      console.error(err)
      setMeldung({ typ: 'error', text: 'Fehler beim Speichern der Zuordnung.' })
    }
  }

  const zuordnungLoeschen = async (id) => {
    if (!confirm('Möchten Sie diese Zuordnung wirklich löschen?')) return
    try {
      const { error } = await supabase
        .from('mannschaftszuordnungen')
        .delete()
        .eq('id', id)

      if (error) throw error
      setMeldung({ typ: 'success', text: 'Zuordnung gelöscht.' })
      datenLaden()
    } catch (err) {
      console.error(err)
      setMeldung({ typ: 'error', text: 'Fehler beim Löschen der Zuordnung.' })
    }
  }

  const loeschantragBestaetigen = async (userId) => {
    if (!confirm('Möchten Sie diesen Benutzer endgültig löschen?')) return
    try {
      const { error } = await supabase
        .from('benutzer')
        .delete()
        .eq('id', userId)

      if (error) throw error
      setMeldung({ typ: 'success', text: 'Benutzer erfolgreich gelöscht.' })
      datenLaden()
    } catch (err) {
      console.error(err)
      setMeldung({ typ: 'error', text: 'Fehler beim Löschen des Benutzers.' })
    }
  }

  // Klick auf "Archivieren" -> lädt Betroffenheits-Zahlen und öffnet Sicherheitsabfrage
  const archivierenAnfragen = async (mannschaft) => {
    setMeldung(null)
    try {
      const { count: spieleAnzahl } = await supabase
        .from('spiele')
        .select('id', { count: 'exact', head: true })
        .eq('mannschaft_id', mannschaft.id)

      const { count: mitgliederAnzahl } = await supabase
        .from('mannschaftszuordnungen')
        .select('id', { count: 'exact', head: true })
        .eq('mannschaft_id', mannschaft.id)

      setArchivierenBestaetigen({
        id: mannschaft.id,
        name: mannschaft.name,
        spieleAnzahl: spieleAnzahl || 0,
        mitgliederAnzahl: mitgliederAnzahl || 0
      })
    } catch (err) {
      console.error(err)
      setMeldung({ typ: 'error', text: 'Fehler beim Prüfen der Mannschaftsdaten.' })
    }
  }

  const archivierenBestaetigt = async () => {
    if (!archivierenBestaetigen) return
    setArchivierenLaeuft(true)
    try {
      const { error } = await supabase
        .from('mannschaften')
        .update({ archiviert: true, archiviert_am: new Date().toISOString() })
        .eq('id', archivierenBestaetigen.id)

      if (error) throw error

      setMeldung({ typ: 'success', text: `Mannschaft "${archivierenBestaetigen.name}" wurde archiviert.` })
      setArchivierenBestaetigen(null)
      datenLaden()
    } catch (err) {
      console.error(err)
      setMeldung({ typ: 'error', text: 'Fehler beim Archivieren der Mannschaft.' })
    } finally {
      setArchivierenLaeuft(false)
    }
  }

  const reaktivieren = async (mannschaft) => {
    if (!confirm(`Mannschaft "${mannschaft.name}" wieder aktivieren?`)) return
    try {
      const { error } = await supabase
        .from('mannschaften')
        .update({ archiviert: false, archiviert_am: null })
        .eq('id', mannschaft.id)

      if (error) throw error
      setMeldung({ typ: 'success', text: `Mannschaft "${mannschaft.name}" wurde reaktiviert.` })
      datenLaden()
    } catch (err) {
      console.error(err)
      setMeldung({ typ: 'error', text: 'Fehler beim Reaktivieren.' })
    }
  }

  const getRolleLabel = (rolle) => {
    switch (rolle) {
      case 'spielfuehrer': return '📋 Spielführer'
      case 'stellvertreter': return '🎗️ Stellv. Spielführer'
      default: return '🏓 Spieler'
    }
  }

  if (ladend) {
    return (
      <div style={{ minHeight: '100vh', background: '#F6FAF8', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif', color: '#1C8A4E' }}>
        <div style={{ padding: '20px' }}>
          <Brand size={16} />
          <p style={{ marginTop: '16px', textAlign: 'center' }}>Lade Admin-Bereich...</p>
        </div>
      </div>
    )
  }

  const aktiveMannschaften = alleMannschaften.filter(m => !m.archiviert)
  const archivierteMannschaften = alleMannschaften.filter(m => m.archiviert)

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff' }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 20px 100px', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 20, margin: '8px 0 16px' }}>
          {istAdmin ? '⚙️ Administrator-Bereich' : '🎯 Spielführer-Verwaltung'}
        </h1>

        {/* Meldung */}
        {meldung && (
          <div style={{
            padding: '12px 14px',
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 500,
            background: meldung.typ === 'error' ? '#FEF2F2' : '#E8F5E9',
            color: meldung.typ === 'error' ? '#991B1B' : '#1C8A4E',
            border: `1px solid ${meldung.typ === 'error' ? '#F5A5A0' : '#BFFFAD'}`
          }}>
            {meldung.typ === 'error' ? '❌' : '✅'} {meldung.text}
          </div>
        )}

        {/* Neue Zuordnung */}
        <div style={{ background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, margin: '0 0 14px', color: '#1C8A4E' }}>
            ➕ Benutzer zu Mannschaft zuordnen
          </h2>
          <form onSubmit={zuweisungSpeichern} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5B6D66', marginBottom: 6 }}>
                👤 Benutzer
              </label>
              <select 
                value={selectedBenutzer} 
                onChange={(e) => setSelectedBenutzer(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #DCE7E2',
                  fontSize: 13,
                  fontFamily: 'Inter, sans-serif',
                  color: '#16261F',
                  background: '#F6FAF8',
                  cursor: 'pointer'
                }}
              >
                {benutzerListe.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.vorname} {b.nachname} ({b.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5B6D66', marginBottom: 6 }}>
                🏓 Mannschaft
              </label>
              <select 
                value={selectedMannschaft} 
                onChange={(e) => setSelectedMannschaft(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #DCE7E2',
                  fontSize: 13,
                  fontFamily: 'Inter, sans-serif',
                  color: '#16261F',
                  background: '#F6FAF8',
                  cursor: 'pointer'
                }}
              >
                {mannschaftenListe.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5B6D66', marginBottom: 6 }}>
                🎗️ Rolle
              </label>
              <select 
                value={selectedRolle} 
                onChange={(e) => setSelectedRolle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #DCE7E2',
                  fontSize: 13,
                  fontFamily: 'Inter, sans-serif',
                  color: '#16261F',
                  background: '#F6FAF8',
                  cursor: 'pointer'
                }}
              >
                <option value="spieler">🏓 Spieler</option>
                <option value="spielfuehrer">📋 Spielführer</option>
              </select>
            </div>

            <button 
              type="submit"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: 'none',
                background: '#1C8A4E',
                color: 'white',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                marginTop: 4
              }}
            >
              Zuordnung speichern
            </button>
          </form>
        </div>

        {/* MANNSCHAFTEN VERWALTEN (nur Admin) */}
        {istAdmin && (
          <div style={{ background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, margin: '0 0 14px', color: '#1C8A4E' }}>
              🏓 Mannschaften verwalten
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {aktiveMannschaften.map(m => {
                const zeigeBestaetigung = archivierenBestaetigen?.id === m.id
                return (
                  <div key={m.id}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 14px', background: '#F6FAF8', border: '1px solid #DCE7E2',
                      borderRadius: zeigeBestaetigung ? '10px 10px 0 0' : 10,
                      borderBottom: zeigeBestaetigung ? 'none' : '1px solid #DCE7E2'
                    }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</span>
                      <button
                        onClick={() => zeigeBestaetigung ? setArchivierenBestaetigen(null) : archivierenAnfragen(m)}
                        style={{
                          background: '#FEF9E7', color: '#8A6D1C', border: '1px solid #F5D76E',
                          borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        📦 Archivieren
                      </button>
                    </div>

                    {/* SICHERHEITSABFRAGE — direkt unter der jeweiligen Mannschaft */}
                    {zeigeBestaetigung && (
                      <div style={{
                        background: '#FEF9E7', border: '1px solid #F5D76E', borderTop: 'none',
                        borderRadius: '0 0 10px 10px', padding: '14px'
                      }}>
                        <p style={{ fontSize: 13, color: '#5B6D66', margin: '0 0 6px', fontWeight: 600 }}>
                          ⚠️ Wirklich archivieren?
                        </p>
                        <ul style={{ fontSize: 12.5, color: '#16261F', margin: '0 0 10px', paddingLeft: 18 }}>
                          <li>{archivierenBestaetigen.mitgliederAnzahl} Mitglieder-Zuordnung(en)</li>
                          <li>{archivierenBestaetigen.spieleAnzahl} Spiel(e)</li>
                        </ul>
                        <p style={{ fontSize: 11.5, color: '#5B6D66', margin: '0 0 12px' }}>
                          Alle Daten (Spiele, Chats, Zuordnungen) bleiben erhalten. Die Mannschaft verschwindet nur aus den aktiven Listen und kann jederzeit reaktiviert werden.
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={archivierenBestaetigt}
                            disabled={archivierenLaeuft}
                            style={{ background: '#8A6D1C', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                          >
                            {archivierenLaeuft ? '...' : 'Ja, archivieren'}
                          </button>
                          <button
                            onClick={() => setArchivierenBestaetigen(null)}
                            style={{ background: 'none', border: '1px solid #DCE7E2', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, cursor: 'pointer' }}
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {aktiveMannschaften.length === 0 && (
                <p style={{ fontSize: 13, color: '#5B6D66', margin: 0 }}>Keine aktiven Mannschaften vorhanden.</p>
              )}
            </div>

            {archivierteMannschaften.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #DCE7E2' }}>
                <button
                  onClick={() => setZeigeArchivierte(z => !z)}
                  style={{ background: 'none', border: 'none', color: '#5B6D66', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  {zeigeArchivierte ? '▲' : '▼'} Archivierte Mannschaften ({archivierteMannschaften.length})
                </button>

                {zeigeArchivierte && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                    {archivierteMannschaften.map(m => (
                      <div key={m.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 14px', background: '#F1F1F1', border: '1px solid #DCE7E2', borderRadius: 10
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#5B6D66' }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: '#9AAAA3' }}>
                            Archiviert am {new Date(m.archiviert_am).toLocaleDateString('de-DE')}
                          </div>
                        </div>
                        <button
                          onClick={() => reaktivieren(m)}
                          style={{
                            background: '#E8F5E9', color: '#1C8A4E', border: '1px solid #BFFFAD',
                            borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                          }}
                        >
                          ↩️ Reaktivieren
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Aktive Zuordnungen */}
        <div style={{ background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, margin: '0 0 14px', color: '#1C8A4E' }}>
            👥 Aktive Zuordnungen
          </h2>
          {zuordnungen.length === 0 ? (
            <p style={{ fontSize: 13, color: '#5B6D66', margin: 0 }}>Keine Zuordnungen vorhanden.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
              {zuordnungen.map(z => (
                <div key={z.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: '#F6FAF8',
                  border: '1px solid #DCE7E2',
                  borderRadius: 10,
                  gap: 12
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#16261F', marginBottom: 2 }}>
                      {z.benutzer?.vorname} {z.benutzer?.nachname}
                    </div>
                    <div style={{ fontSize: 12, color: '#5B6D66' }}>
                      {z.mannschaften?.name} • {getRolleLabel(z.rolle)}
                    </div>
                  </div>
                  <button 
                    onClick={() => zuordnungLoeschen(z.id)}
                    style={{
                      background: '#FEF2F2',
                      color: '#991B1B',
                      border: '1px solid #F5A5A0',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🗑️ Löschen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Offene Löschanträge (nur Admin) */}
        {istAdmin && loeschantraege.length > 0 && (
          <div style={{ background: '#ffffff', border: '1px dashed #F87171', borderRadius: 14, padding: 16, marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, margin: '0 0 14px', color: '#991B1B' }}>
              ⚠️ Offene Löschanträge ({loeschantraege.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
              {loeschantraege.map(l => (
                <div key={l.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: '#FEF2F2',
                  border: '1px solid #F5A5A0',
                  borderRadius: 10,
                  gap: 12
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#991B1B', marginBottom: 2 }}>
                      {l.vorname} {l.nachname}
                    </div>
                    <div style={{ fontSize: 12, color: '#9B5A5A' }}>
                      {l.email}
                    </div>
                  </div>
                  <button 
                    onClick={() => loeschantragBestaetigen(l.id)}
                    style={{
                      background: '#991B1B',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    ✓ Löschen
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {istAdmin && loeschantraege.length === 0 && (
          <div style={{
            padding: 12,
            borderRadius: 10,
            background: '#E8F5E9',
            color: '#1C8A4E',
            fontSize: 13,
            fontWeight: 500,
            border: '1px solid #BFFFAD',
            marginBottom: 20,
            textAlign: 'center'
          }}>
            ✅ Keine offenen Löschanträge
          </div>
        )}
      </div>

      <BottomNav session={session} />
    </div>
  )
}

export default Admin
