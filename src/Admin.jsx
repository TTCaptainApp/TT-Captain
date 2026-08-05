import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

function Admin({ session }) {
  const navigate = useNavigate()
  const [benutzerListe, setBenutzerListe] = useState([])
  const [mannschaftenListe, setMannschaftenListe] = useState([])
  const [zuordnungen, setZuordnungen] = useState([])
  const [loeschantraege, setLoeschantraege] = useState([])
  const [istAdmin, setIstAdmin] = useState(false)
  const [ladend, setLadend] = useState(true)
  const [meldung, setMeldung] = useState(null)

  // Formular-States
  const [selectedBenutzer, setSelectedBenutzer] = useState('')
  const [selectedMannschaft, setSelectedMannschaft] = useState('')
  const [selectedRolle, setSelectedRolle] = useState('spieler')

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

      // 4. Mannschaften laden (Admin = Alle, Spielführer = Nur eigene)
      let mQuery = supabase.from('mannschaften').select('id, name').order('name')
      if (!adminFlag) {
        mQuery = mQuery.in('id', gefuehrteTeamIds)
      }
      const { data: mData } = await mQuery
      setMannschaftenListe(mData || [])
      if (mData && mData.length > 0) setSelectedMannschaft(mData[0].id)

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
                marginTop: 4,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#157A3E'}
              onMouseLeave={(e) => e.target.style.background = '#1C8A4E'}
            >
              Zuordnung speichern
            </button>
          </form>
        </div>

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
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#F5A5A0'
                      e.target.style.color = 'white'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#FEF2F2'
                      e.target.style.color = '#991B1B'
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
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#7A1515'}
                    onMouseLeave={(e) => e.target.style.background = '#991B1B'}
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
