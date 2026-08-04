import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  borderRadius: 8,
  border: '1px solid #DCE7E2',
  background: '#ffffff',
  boxSizing: 'border-box',
  fontFamily: 'inherit'
}

const buttonStyle = {
  background: '#1C8A4E',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  padding: '10px 16px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer'
}

function Admin({ session }) {
  const [istAdmin, setIstAdmin] = useState(false)
  const [benutzerListe, setBenutzerListe] = useState([])
  const [mannschaften, setMannschaften] = useState([])
  const [zuordnungen, setZuordnungen] = useState([])

  // Formulardaten für neue Zuordnung
  const [selBenutzer, setSelBenutzer] = useState('')
  const [selMannschaft, setSelMannschaft] = useState('')
  const [selRolle, setSelRolle] = useState('spieler')

  const [ladend, setLadend] = useState(true)
  const [meldung, setMeldung] = useState(null)

  const datenLaden = async () => {
    setLadend(true)

    // 1. Admin-Prüfung
    const { data: bRow } = await supabase.from('benutzer').select('ist_administrator').eq('id', session.user.id).single()
    if (!bRow?.ist_administrator) {
      setIstAdmin(false)
      setLadend(false)
      return
    }
    setIstAdmin(true)

    // 2. Alle Benutzer laden
    const { data: bData } = await supabase.from('benutzer').select('id, vorname, nachname, email, ist_administrator').order('vorname')
    setBenutzerListe(bData || [])

    // 3. Alle Mannschaften laden
    const { data: mData } = await supabase.from('mannschaften').select('id, name').order('name')
    setMannschaften(mData || [])

    // 4. Alle Zuordnungen laden
    const { data: zData } = await supabase
      .from('mannschaftszuordnungen')
      .select('id, benutzer_id, mannschaft_id, rolle, mannschaften(name)')

    setZuordnungen(zData || [])
    setLadend(false)
  }

  useEffect(() => {
    datenLaden()
  }, [session])

  // Admin-Status umschalten
  const toggleAdmin = async (userId, aktuellerStatus) => {
    const { error } = await supabase
      .from('benutzer')
      .update({ ist_administrator: !aktuellerStatus })
      .eq('id', userId)

    if (error) setMeldung({ typ: 'error', text: error.message })
    else {
      setMeldung({ typ: 'success', text: 'Admin-Status aktualisiert.' })
      datenLaden()
    }
  }

  // Neue Zuordnung / Rolle speichern
  const zuordnungSpeichern = async (e) => {
    e.preventDefault()
    if (!selBenutzer || !selMannschaft) {
      setMeldung({ typ: 'error', text: 'Bitte wähle Nutzer und Mannschaft aus.' })
      return
    }

    const { error } = await supabase
      .from('mannschaftszuordnungen')
      .upsert({
        benutzer_id: selBenutzer,
        mannschaft_id: selMannschaft,
        rolle: selRolle
      }, { onConflict: 'benutzer_id, mannschaft_id' })

    if (error) {
      setMeldung({ typ: 'error', text: error.message })
    } else {
      setMeldung({ typ: 'success', text: 'Zuordnung erfolgreich gespeichert.' })
      setSelBenutzer('')
      setSelMannschaft('')
      setSelRolle('spieler')
      datenLaden()
    }
  }

  // Rolle direkt in Tabelle ändern
  const rolleAendern = async (zuordnungId, neueRolle) => {
    const { error } = await supabase
      .from('mannschaftszuordnungen')
      .update({ rolle: neueRolle })
      .eq('id', zuordnungId)

    if (error) setMeldung({ typ: 'error', text: error.message })
    else datenLaden()
  }

  // Zuordnung löschen
  const zuordnungEntfernen = async (zuordnungId) => {
    if (!window.confirm('Zuordnung wirklich löschen?')) return
    const { error } = await supabase.from('mannschaftszuordnungen').delete().eq('id', zuordnungId)
    if (error) setMeldung({ typ: 'error', text: error.message })
    else datenLaden()
  }

  if (ladend) return null

  if (!istAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: '#F6FAF8', padding: 20, fontFamily: 'Inter, sans-serif' }}>
        <h2 style={{ color: '#991B1B' }}>⛔ Zugriff verweigert</h2>
        <p>Du benötigst Administrator-Rechte, um diese Seite aufzurufen.</p>
        <Link to="/" style={{ color: '#1C8A4E', fontWeight: 600 }}>Zurück zur Startseite</Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff' }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 20px 100px', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 20, margin: '8px 0 16px' }}>⚙️ Adminbereich</h1>

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

        {/* 1. SPIELER EINER MANNSCHAFT ZUWEISEN & ROLLE FESTLEGEN */}
        <div style={cardStyle}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, margin: '0 0 12px', color: '#1C8A4E' }}>
            ➕ Mannschaft & Rolle zuweisen
          </h3>
          <form onSubmit={zuordnungSpeichern} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#5B6D66', display: 'block', marginBottom: 4 }}>Spieler</label>
              <select style={inputStyle} value={selBenutzer} onChange={e => setSelBenutzer(e.target.value)}>
                <option value="">-- Spieler auswählen --</option>
                {benutzerListe.map(b => (
                  <option key={b.id} value={b.id}>{b.vorname} {b.nachname} ({b.email})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#5B6D66', display: 'block', marginBottom: 4 }}>Mannschaft</label>
              <select style={inputStyle} value={selMannschaft} onChange={e => setSelMannschaft(e.target.value)}>
                <option value="">-- Mannschaft auswählen --</option>
                {mannschaften.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#5B6D66', display: 'block', marginBottom: 4 }}>Rolle in der Mannschaft</label>
              <select style={inputStyle} value={selRolle} onChange={e => setSelRolle(e.target.value)}>
                <option value="spieler">🏓 Spieler</option>
                <option value="stellvertreter">🎗️ Stellv. Spielführer</option>
                <option value="spielfuehrer">📋 Spielführer</option>
              </select>
            </div>

            <button type="submit" style={{ ...buttonStyle, marginTop: 4 }}>Speichern</button>
          </form>
        </div>

        {/* 2. AKTUELLE ZUORDNUNGEN & ROLLEN ÜBERSICHT */}
        <div style={cardStyle}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, margin: '0 0 12px' }}>
            👥 Mannschaftsrollen
          </h3>
          {zuordnungen.length === 0 ? (
            <p style={{ fontSize: 13, color: '#5B6D66' }}>Noch keine Zuordnungen vorhanden.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {zuordnungen.map(z => {
                const sp = benutzerListe.find(b => b.id === z.benutzer_id)
                return (
                  <div key={z.id} style={{ padding: 10, background: '#F6FAF8', borderRadius: 8, border: '1px solid #DCE7E2', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{sp ? `${sp.vorname} ${sp.nachname}` : 'Unbekannt'}</span>
                      <button onClick={() => zuordnungEntfernen(z.id)} style={{ border: 'none', background: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 14 }}>✕ Entfernen</button>
                    </div>
                    <div style={{ fontSize: 12, color: '#5B6D66' }}>
                      Team: <strong>{z.mannschaften?.name}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Rolle:</span>
                      <select
                        style={{ ...inputStyle, padding: '4px 8px', fontSize: 12, width: 'auto', flex: 1 }}
                        value={z.rolle || 'spieler'}
                        onChange={e => rolleAendern(z.id, e.target.value)}
                      >
                        <option value="spieler">🏓 Spieler</option>
                        <option value="stellvertreter">🎗️ Stellv. Spielführer</option>
                        <option value="spielfuehrer">📋 Spielführer</option>
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 3. NUTZER- & ADMIN-RECHTE VERWALTUNG */}
        <div style={cardStyle}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, margin: '0 0 12px' }}>
            👑 Admin-Rechte verwalten
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {benutzerListe.map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #EFEFEF' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{b.vorname} {b.nachname}</div>
                  <div style={{ fontSize: 11, color: '#5B6D66' }}>{b.email}</div>
                </div>
                <button
                  onClick={() => toggleAdmin(b.id, b.ist_administrator)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: b.ist_administrator ? '#E8F5E9' : '#F0F4F2',
                    color: b.ist_administrator ? '#1B5E20' : '#5B6D66'
                  }}
                >
                  {b.ist_administrator ? '👑 Admin' : 'Nutzer'}
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

      <BottomNav istAdmin={istAdmin} />
    </div>
  )
}

export default Admin
 
