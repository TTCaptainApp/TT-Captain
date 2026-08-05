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
      const { data: zData } = await supabase
        .from('mannschaftszuordnungen')
        .select('id, benutzer_id, mannschaft_id, rolle, benutzer(id, vorname, nachname, email), mannschaften(id, name)')

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
    } finally {
      setLadend(false)
    }
  }

  useEffect(() => {
    datenLaden()
  }, [session])

  const zuweisungSpeichern = async (e) => {
    e.preventDefault()
    setMeldung(null)

    if (!selectedBenutzer || !selectedMannschaft) {
      setMeldung({ typ: 'error', text: 'Bitte Spieler und Mannschaft auswählen.' })
      return
    }

    const { error } = await supabase
      .from('mannschaftszuordnungen')
      .insert({
        benutzer_id: selectedBenutzer,
        mannschaft_id: selectedMannschaft,
        rolle: selectedRolle
      })

    if (error) {
      setMeldung({ typ: 'error', text: 'Fehler beim Speichern: ' + error.message })
    } else {
      setMeldung({ typ: 'success', text: 'Rolle erfolgreich zugewiesen!' })
      datenLaden()
    }
  }

  const rolleAendern = async (id, neueRolle) => {
    const { error } = await supabase
      .from('mannschaftszuordnungen')
      .update({ rolle: neueRolle })
      .eq('id', id)

    if (error) {
      setMeldung({ typ: 'error', text: error.message })
    } else {
      datenLaden()
    }
  }

  const zuordnungEntfernen = async (id) => {
    const { error } = await supabase
      .from('mannschaftszuordnungen')
      .delete()
      .eq('id', id)

    if (error) {
      setMeldung({ typ: 'error', text: error.message })
    } else {
      datenLaden()
    }
  }

  const loeschantragAblehnen = async (benutzerId) => {
    const { error } = await supabase
      .from('benutzer')
      .update({ loeschung_beantragt: false, loeschung_beantragt_am: null })
      .eq('id', benutzerId)

    if (error) {
      setMeldung({ typ: 'error', text: error.message })
    } else {
      setMeldung({ typ: 'success', text: 'Löschantrag abgelehnt.' })
      datenLaden()
    }
  }

  const kontoEndgueltigLoeschen = async (benutzerId, name) => {
    if (!window.confirm(`"${name}" wirklich endgültig löschen? Alle Mannschaftszuordnungen und Profildaten werden entfernt.`)) return

    await supabase.from('mannschaftszuordnungen').delete().eq('benutzer_id', benutzerId)
    const { error } = await supabase.from('benutzer').delete().eq('id', benutzerId)

    if (error) {
      setMeldung({ typ: 'error', text: error.message })
    } else {
      setMeldung({
        typ: 'success',
        text: 'Profil gelöscht. Der Login-Zugang (Auth-Konto) muss zusätzlich manuell im Supabase-Dashboard unter Authentication → Users entfernt werden.'
      })
      datenLaden()
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff' }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 20px 100px', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 20, margin: '8px 0 16px' }}>
          ⚙️ {istAdmin ? 'Adminbereich' : 'Teamverwaltung'}
        </h1>

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

        {ladend ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#5B6D66' }}>Laden...</div>
        ) : (
          <>
            {/* OFFENE LÖSCHANTRÄGE */}
            {istAdmin && loeschantraege.length > 0 && (
              <div style={{ background: '#FEF2F2', border: '1px solid #F87171', borderRadius: 14, padding: 16, marginBottom: 24 }}>
                <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, margin: '0 0 12px', color: '#991B1B' }}>
                  ⚠️ Offene Löschanträge ({loeschantraege.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {loeschantraege.map(l => (
                    <div key={l.id} style={{ background: '#ffffff', border: '1px solid #F87171', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{l.vorname} {l.nachname}</div>
                      <div style={{ fontSize: 12, color: '#5B6D66', marginBottom: 8 }}>
                        {l.email} · beantragt am {l.loeschung_beantragt_am ? new Date(l.loeschung_beantragt_am).toLocaleDateString('de-DE') : '–'}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => kontoEndgueltigLoeschen(l.id, `${l.vorname} ${l.nachname}`)}
                          style={{ background: '#991B1B', color: 'white', border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Endgültig löschen
                        </button>
                        <button
                          onClick={() => loeschantragAblehnen(l.id)}
                          style={{ background: 'none', border: '1px solid #DCE7E2', borderRadius: 7, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' }}
                        >
                          Ablehnen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MANNSCHAFT & ROLLE ZUWEISEN */}
            <div style={{ background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 16, marginBottom: 24 }}>
              <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, margin: '0 0 12px', color: '#1C8A4E' }}>
                ➕ Spieler zur Mannschaft hinzufügen
              </h3>
              
              <form onSubmit={zuweisungSpeichern} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#5B6D66' }}>Spieler</label>
                  <select 
                    value={selectedBenutzer} 
                    onChange={e => setSelectedBenutzer(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #DCE7E2', background: '#FFFFFF', fontSize: 14 }}
                  >
                    {benutzerListe.map(b => (
                      <option key={b.id} value={b.id}>{b.vorname} {b.nachname} ({b.email})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#5B6D66' }}>Mannschaft</label>
                  <select 
                    value={selectedMannschaft} 
                    onChange={e => setSelectedMannschaft(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #DCE7E2', background: '#FFFFFF', fontSize: 14 }}
                  >
                    {mannschaftenListe.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#5B6D66' }}>Rolle</label>
                  <select 
                    value={selectedRolle} 
                    onChange={e => setSelectedRolle(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #DCE7E2', background: '#FFFFFF', fontSize: 14 }}
                  >
                    <option value="spielfuehrer">📋 Spielführer</option>
                    <option value="stellvertreter">🎗️ Stellv. Spielführer</option>
                    <option value="spieler">🏓 Spieler</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  style={{ marginTop: 6, background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 8, padding: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                >
                  Speichern
                </button>
              </form>
            </div>

            {/* MANNSCHAFTSKADER */}
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 16, margin: '0 0 12px' }}>
              👥 Kaderverwalter
            </h2>

            {mannschaftenListe.map(m => {
              const teamMembers = zuordnungen.filter(z => z.mannschaft_id === m.id)
              return (
                <div key={m.id} style={{ background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #EFEFEF' }}>
                    <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, margin: 0, color: '#1C8A4E' }}>
                      🏓 {m.name}
                    </h3>
                    <span style={{ fontSize: 12, color: '#5B6D66', fontWeight: 500 }}>
                      {teamMembers.length} {teamMembers.length === 1 ? 'Mitglied' : 'Mitglieder'}
                    </span>
                  </div>

                  {teamMembers.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#5B6D66', margin: 0, fontStyle: 'italic' }}>Noch keine Spieler zugewiesen.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {teamMembers.map(z => (
                        <div key={z.id} style={{ background: '#F6FAF8', border: '1px solid #DCE7E2', borderRadius: 10, padding: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>
                              {z.benutzer?.vorname} {z.benutzer?.nachname}
                            </span>
                            <button 
                              onClick={() => zuordnungEntfernen(z.id)}
                              style={{ background: 'none', border: 'none', color: '#991B1B', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                            >
                              ✕ Entfernen
                            </button>
                          </div>
                          <select 
                            value={z.rolle} 
                            onChange={e => rolleAendern(z.id, e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #DCE7E2', background: '#FFFFFF', fontSize: 13 }}
                          >
                            <option value="spielfuehrer">📋 Spielführer</option>
                            <option value="stellvertreter">🎗️ Stellv. Spielführer</option>
                            <option value="spieler">🏓 Spieler</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

export default Admin
