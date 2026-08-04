import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'
import { parseICS, gegnerErmitteln } from './icsParser'

const cardStyle = { background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 14, marginBottom: 10 }
const inputStyle = { padding: '9px 10px', fontSize: 14, borderRadius: 8, border: '1px solid #DCE7E2', fontFamily: 'inherit', width: '100%' }
const buttonStyle = { background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const secondaryButtonStyle = { ...buttonStyle, background: 'transparent', color: '#1C8A4E', border: '1px solid #1C8A4E' }
const smallButtonStyle = { padding: '6px 12px', fontSize: 12.5, fontWeight: 600, borderRadius: 7, cursor: 'pointer', border: '1px solid #DCE7E2', background: 'white', color: '#16261F' }

const statusFarbe = {
  geplant: '#1C8A4E',
  verlegt: '#d4a017',
  abgesagt: '#c0392b',
  gespielt: '#5B6D66'
}

function Spiele({ session }) {
  const [istAdmin, setIstAdmin] = useState(false)
  const [meineMannschaften, setMeineMannschaften] = useState([])
  const [alleMannschaften, setAlleMannschaften] = useState([])
  const [spiele, setSpiele] = useState([])
  const [meineVerfuegbarkeiten, setMeineVerfuegbarkeiten] = useState({})
  const [verfuegbarkeitCounts, setVerfuegbarkeitCounts] = useState({})
  const [formOffen, setFormOffen] = useState(false)
  const [importOffen, setImportOffen] = useState(false)

  const [mannschaftId, setMannschaftId] = useState('')
  const [gegner, setGegner] = useState('')
  const [heimAuswaerts, setHeimAuswaerts] = useState('heim')
  const [datum, setDatum] = useState('')
  const [uhrzeit, setUhrzeit] = useState('')
  const [halle, setHalle] = useState('')
  const [fehler, setFehler] = useState(null)

  const [importMannschaftId, setImportMannschaftId] = useState('')
  const [eigenerName, setEigenerName] = useState('')
  const [importEvents, setImportEvents] = useState([])
  const [importFehler, setImportFehler] = useState(null)
  const [importLaeuft, setImportLaeuft] = useState(false)

  const [bearbeitenId, setBearbeitenId] = useState(null)
  const [bGegner, setBGegner] = useState('')
  const [bHeimAuswaerts, setBHeimAuswaerts] = useState('heim')
  const [bDatum, setBDatum] = useState('')
  const [bUhrzeit, setBUhrzeit] = useState('')
  const [bHalle, setBHalle] = useState('')
  const [bStatus, setBStatus] = useState('geplant')

  const ladeSpiele = async () => {
    const { data, error } = await supabase
      .from('spiele')
      .select(`
        id,
        mannschaft_id,
        gegner,
        heim_oder_auswaerts,
        datum,
        uhrzeit,
        halle,
        status,
        mannschaften(name),
        aufstellungen (
          id,
          veroeffentlicht,
          aufstellung_spieler (
            position,
            benutzer (
              vorname,
              nachname,
              qttr
            )
          )
        )
      `)
      .order('datum')

    if (error) {
      console.error('Fehler beim Laden der Spiele:', error)
    }
    setSpiele(data || [])
  }

  const ladeVerfuegbarkeiten = async () => {
    const { data: eigene } = await supabase
      .from('verfuegbarkeiten')
      .select('spiel_id, status')
      .eq('benutzer_id', session.user.id)
    setMeineVerfuegbarkeiten(Object.fromEntries((eigene || []).map(v => [v.spiel_id, v.status])))

    const { data: alle } = await supabase.from('verfuegbarkeiten').select('spiel_id, status')
    const counts = {}
    ;(alle || []).forEach(v => {
      counts[v.spiel_id] = counts[v.spiel_id] || { zugesagt: 0, abgesagt: 0, offen: 0 }
      counts[v.spiel_id][v.status] = (counts[v.spiel_id][v.status] || 0) + 1
    })
    setVerfuegbarkeitCounts(counts)
  }

  useEffect(() => {
    supabase.from('benutzer').select('verein_id, ist_administrator').eq('id', session.user.id).single()
      .then(({ data }) => {
        if (data) {
          setIstAdmin(data.ist_administrator)
          if (data.ist_administrator) {
            supabase.from('mannschaften').select('id, name').eq('verein_id', data.verein_id).order('name')
              .then(({ data: teams }) => setAlleMannschaften(teams || []))
          }
        }
      })

    supabase
      .from('mannschaftszuordnungen')
      .select('mannschaft_id, rolle, mannschaften(name)')
      .eq('benutzer_id', session.user.id)
      .then(({ data }) => {
        setMeineMannschaften((data || []).map(z => ({
          mannschaft_id: z.mannschaft_id,
          rolle: z.rolle,
          name: z.mannschaften?.name
        })))
      })

    ladeSpiele()
    ladeVerfuegbarkeiten()
  }, [session])

  const mannschaftIdsMeine = new Set(meineMannschaften.map(m => m.mannschaft_id))
  const spielfuehrerMannschaftIds = new Set(
    meineMannschaften.filter(m => m.rolle === 'spielfuehrer' || m.rolle === 'stellvertreter').map(m => m.mannschaft_id)
  )
  const kannBearbeiten = (mId) => istAdmin || spielfuehrerMannschaftIds.has(mId)

  const kannSpielAnlegen = istAdmin || spielfuehrerMannschaftIds.size > 0
  const auswahlMannschaften = istAdmin
    ? alleMannschaften.map(m => ({ mannschaft_id: m.id, name: m.name }))
    : meineMannschaften.filter(m => spielfuehrerMannschaftIds.has(m.mannschaft_id))

  const spielAnlegen = async (e) => {
    e.preventDefault()
    setFehler(null)
    if (!mannschaftId || !gegner || !datum) {
      setFehler('Bitte Mannschaft, Gegner und Datum ausfüllen.')
      return
    }
    const { error } = await supabase.from('spiele').insert({
      mannschaft_id: mannschaftId, gegner, heim_oder_auswaerts: heimAuswaerts,
      datum, uhrzeit: uhrzeit || null, halle: halle || null
    })
    if (error) { setFehler(error.message); return }
    setGegner(''); setDatum(''); setUhrzeit(''); setHalle('')
    setFormOffen(false)
    ladeSpiele()
  }

  const neuParsen = (rohEvents) => {
    setImportEvents(rohEvents.map(ev => {
      const { gegner, heimAuswaerts } = gegnerErmitteln(ev.summary, eigenerName)
      return { ...ev, gegner, heimAuswaerts, uebernehmen: true }
    }))
  }

  const dateiAusgewaehlt = (e) => {
    const datei = e.target.files[0]
    if (!datei) return
    setImportFehler(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const events = parseICS(reader.result)
        if (events.length === 0) { setImportFehler('Keine Termine in der Datei gefunden.'); return }
        neuParsen(events)
      } catch {
        setImportFehler('Die Datei konnte nicht gelesen werden. Ist es eine gültige .ics-Datei?')
      }
    }
    reader.readAsText(datei)
  }

  const importZeileAendern = (index, feld, wert) => {
    setImportEvents(prev => prev.map((ev, i) => i === index ? { ...ev, [feld]: wert } : ev))
  }

  const importDurchfuehren = async () => {
    setImportFehler(null)
    if (!importMannschaftId) { setImportFehler('Bitte zuerst eine Mannschaft auswählen.'); return }
    const zeilenZumImport = importEvents.filter(ev => ev.uebernehmen)
    if (zeilenZumImport.length === 0) { setImportFehler('Keine Termine ausgewählt.'); return }
    setImportLaeuft(true)
    const rows = zeilenZumImport.map(ev => ({
      mannschaft_id: importMannschaftId, gegner: ev.gegner, heim_oder_auswaerts: ev.heimAuswaerts,
      datum: ev.datum, uhrzeit: ev.uhrzeit, halle: ev.location || null
    }))
    const { error } = await supabase.from('spiele').insert(rows)
    setImportLaeuft(false)
    if (error) { setImportFehler(error.message); return }
    setImportEvents([])
    setImportOffen(false)
    ladeSpiele()
  }

  const zusageSetzen = async (spielId, status) => {
    setMeineVerfuegbarkeiten(prev => ({ ...prev, [spielId]: status }))
    await supabase.from('verfuegbarkeiten').upsert(
      { spiel_id: spielId, benutzer_id: session.user.id, status, geaendert_am: new Date().toISOString() },
      { onConflict: 'spiel_id,benutzer_id' }
    )
    ladeVerfuegbarkeiten()
  }

  const bearbeitenStarten = (s) => {
    setBearbeitenId(s.id)
    setBGegner(s.gegner)
    setBHeimAuswaerts(s.heim_oder_auswaerts)
    setBDatum(s.datum)
    setBUhrzeit(s.uhrzeit ? s.uhrzeit.slice(0, 5) : '')
    setBHalle(s.halle || '')
    setBStatus(s.status)
  }

  const bearbeitenSpeichern = async (e) => {
    e.preventDefault()
    await supabase.from('spiele').update({
      gegner: bGegner, heim_oder_auswaerts: bHeimAuswaerts, datum: bDatum,
      uhrzeit: bUhrzeit || null, halle: bHalle || null, status: bStatus,
      zuletzt_geaendert_am: new Date().toISOString()
    }).eq('id', bearbeitenId)
    setBearbeitenId(null)
    ladeSpiele()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff' }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 20px 80px', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 16px', flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 20, margin: 0 }}>Spiele</h1>
          {kannSpielAnlegen && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={secondaryButtonStyle} onClick={() => setImportOffen(o => !o)}>
                {importOffen ? 'Abbrechen' : '📅 ICS importieren'}
              </button>
              <button style={buttonStyle} onClick={() => setFormOffen(f => !f)}>
                {formOffen ? 'Abbrechen' : '+ Spiel'}
              </button>
            </div>
          )}
        </div>

        {importOffen && (
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select style={inputStyle} value={importMannschaftId} onChange={e => setImportMannschaftId(e.target.value)}>
              <option value="">Mannschaft wählen...</option>
              {auswahlMannschaften.map(m => <option key={m.mannschaft_id} value={m.mannschaft_id}>{m.name}</option>)}
            </select>
            <input
              style={inputStyle}
              placeholder="Euer Teamname wie in der ICS-Datei"
              value={eigenerName}
              onChange={e => {
                setEigenerName(e.target.value)
                if (importEvents.length > 0) {
                  neuParsen(importEvents.map(ev => ({ summary: ev.summary, location: ev.location, datum: ev.datum, uhrzeit: ev.uhrzeit })))
                }
              }}
            />
            <input type="file" accept=".ics" onChange={dateiAusgewaehlt} style={{ fontSize: 13 }} />
            {importFehler && <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{importFehler}</p>}
            {importEvents.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{importEvents.length} Termine gefunden:</div>
                {importEvents.map((ev, i) => (
                  <div key={i} style={{ border: '1px solid #DCE7E2', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={ev.uebernehmen} onChange={e => importZeileAendern(i, 'uebernehmen', e.target.checked)} />
                      {ev.datum} {ev.uhrzeit ? `· ${ev.uhrzeit} Uhr` : ''}
                    </label>
                    <input style={inputStyle} value={ev.gegner} onChange={e => importZeileAendern(i, 'gegner', e.target.value)} placeholder="Gegner" />
                    <select style={inputStyle} value={ev.heimAuswaerts} onChange={e => importZeileAendern(i, 'heimAuswaerts', e.target.value)}>
                      <option value="heim">Heim</option>
                      <option value="auswaerts">Auswärts</option>
                    </select>
                  </div>
                ))}
                <button style={buttonStyle} onClick={importDurchfuehren} disabled={importLaeuft}>
                  {importLaeuft ? 'Importiere...' : `${importEvents.filter(e => e.uebernehmen).length} Termine importieren`}
                </button>
              </>
            )}
          </div>
        )}

        {formOffen && (
          <form onSubmit={spielAnlegen} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select style={inputStyle} value={mannschaftId} onChange={e => setMannschaftId(e.target.value)}>
              <option value="">Mannschaft wählen...</option>
              {auswahlMannschaften.map(m => <option key={m.mannschaft_id} value={m.mannschaft_id}>{m.name}</option>)}
            </select>
            <input style={inputStyle} placeholder="Gegner" value={gegner} onChange={e => setGegner(e.target.value)} />
            <select style={inputStyle} value={heimAuswaerts} onChange={e => setHeimAuswaerts(e.target.value)}>
              <option value="heim">Heim</option>
              <option value="auswaerts">Auswärts</option>
            </select>
            <input style={inputStyle} type="date" value={datum} onChange={e => setDatum(e.target.value)} />
            <input style={inputStyle} type="time" value={uhrzeit} onChange={e => setUhrzeit(e.target.value)} />
            <input style={inputStyle} placeholder="Halle (optional)" value={halle} onChange={e => setHalle(e.target.value)} />
            {fehler && <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{fehler}</p>}
            <button type="submit" style={buttonStyle}>Speichern</button>
          </form>
        )}

        {spiele.map(s => {
          let veroeffentlichteAufstellung = null
          if (Array.isArray(s.aufstellungen)) {
            veroeffentlichteAufstellung = s.aufstellungen.find(a => a?.veroeffentlicht)
          } else if (s.aufstellungen && typeof s.aufstellungen === 'object') {
            if (s.aufstellungen.veroeffentlicht) {
              veroeffentlichteAufstellung = s.aufstellungen
            }
          }

          return (
            <div key={s.id} style={cardStyle}>
              {bearbeitenId === s.id ? (
                <form onSubmit={bearbeitenSpeichern} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input style={inputStyle} value={bGegner} onChange={e => setBGegner(e.target.value)} placeholder="Gegner" />
                  <select style={inputStyle} value={bHeimAuswaerts} onChange={e => setBHeimAuswaerts(e.target.value)}>
                    <option value="heim">Heim</option>
                    <option value="auswaerts">Auswärts</option>
                  </select>
                  <input style={inputStyle} type="date" value={bDatum} onChange={e => setBDatum(e.target.value)} />
                  <input style={inputStyle} type="time" value={bUhrzeit} onChange={e => setBUhrzeit(e.target.value)} />
                  <input style={inputStyle} value={bHalle} onChange={e => setBHalle(e.target.value)} placeholder="Halle" />
                  <select style={inputStyle} value={bStatus} onChange={e => setBStatus(e.target.value)}>
                    <option value="geplant">Geplant</option>
                    <option value="verlegt">Verlegt</option>
                    <option value="abgesagt">Abgesagt</option>
                    <option value="gespielt">Gespielt</option>
                  </select>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" style={buttonStyle}>Speichern</button>
                    <button type="button" style={secondaryButtonStyle} onClick={() => setBearbeitenId(null)}>Abbrechen</button>
                  </div>
                </form>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 14 }}>
                      {s.heim_oder_auswaerts === 'heim'
                        ? `${s.mannschaften?.name} vs. ${s.gegner}`
                        : `${s.gegner} vs. ${s.mannschaften?.name}`}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: statusFarbe[s.status] || '#5B6D66', textTransform: 'uppercase' }}>
                      {s.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#5B6D66', marginTop: 4 }}>
                    {s.datum} {s.uhrzeit ? `· ${s.uhrzeit.slice(0, 5)} Uhr` : ''} {s.halle ? `· ${s.halle}` : ''} · {s.heim_oder_auswaerts === 'heim' ? 'Heimspiel' : 'Auswärts'}
                  </div>

                  {veroeffentlichteAufstellung && (
                    <div style={{
                      marginTop: 10,
                      padding: '10px 12px',
                      background: '#F0F7F4',
                      border: '1px solid #DCE7E2',
                      borderRadius: 8
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1C8A4E', marginBottom: 6 }}>
                        📋 Aufstellung:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {(veroeffentlichteAufstellung.aufstellung_spieler || [])
                          .slice()
                          .sort((a, b) => a.position - b.position)
                          .map((asp) => {
                            const b = Array.isArray(asp.benutzer) ? asp.benutzer[0] : asp.benutzer
                            return (
                              <div key={asp.position} style={{ fontSize: 13, color: '#16261F' }}>
                                <strong>{asp.position}.</strong> {b?.vorname} {b?.nachname}
                                {b?.qttr && (
                                  <span style={{ fontSize: 11, color: '#5B6D66', marginLeft: 4 }}>
                                    ({b.qttr} QTTR)
                                  </span>
                                )}
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {mannschaftIdsMeine.has(s.mannschaft_id) && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => zusageSetzen(s.id, 'zugesagt')}
                        style={{ ...smallButtonStyle, background: meineVerfuegbarkeiten[s.id] === 'zugesagt' ? '#1C8A4E' : 'white', color: meineVerfuegbarkeiten[s.id] === 'zugesagt' ? 'white' : '#16261F', borderColor: '#1C8A4E' }}
                      >
                        ✅ Zusage
                      </button>
                      <button
                        onClick={() => zusageSetzen(s.id, 'abgesagt')}
                        style={{ ...smallButtonStyle, background: meineVerfuegbarkeiten[s.id] === 'abgesagt' ? '#c0392b' : 'white', color: meineVerfuegbarkeiten[s.id] === 'abgesagt' ? 'white' : '#16261F', borderColor: '#c0392b' }}
                      >
                        ❌ Absage
                      </button>
                      {!meineVerfuegbarkeiten[s.id] && <span style={{ fontSize: 11.5, color: '#5B6D66' }}>noch offen</span>}
                      <Link to={`/spiele/${s.id}/aufstellung`} style={{ ...smallButtonStyle, textDecoration: 'none', display: 'inline-block' }}>
                        📋 Aufstellung
                      </Link>
                    </div>
                  )}

                  {kannBearbeiten(s.mannschaft_id) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                      {verfuegbarkeitCounts[s.id] && (
                        <span style={{ fontSize: 11.5, color: '#5B6D66' }}>
                          ✅ {verfuegbarkeitCounts[s.id].zugesagt || 0} · ❌ {verfuegbarkeitCounts[s.id].abgesagt || 0} · ❓ {verfuegbarkeitCounts[s.id].offen || 0}
                        </span>
                      )}
                      <button onClick={() => bearbeitenStarten(s)} style={{ ...smallButtonStyle, borderColor: '#DCE7E2', color: '#1C8A4E' }}>
                        ✏️ Bearbeiten
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}

        {spiele.length === 0 && <p style={{ color: '#5B6D66', fontSize: 14 }}>Noch keine Spiele eingetragen.</p>}
      </div>

      <BottomNav istAdmin={istAdmin} />
    </div>
  )
}

export default Spiele
