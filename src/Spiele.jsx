import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'
import { parseICS, gegnerErmitteln } from './icsParser'

// ── Design-Tokens ────────────────────────────────────────────────
const C = {
  courtGreen: '#1C8A4E',
  courtGreenDark: '#146238',
  ballOrange: '#E8622C',
  mint: '#EAF6F0',
  peach: '#FBEBE3',
  bg: '#F6FAF8',
  ink: '#16261F',
  inkMuted: '#5B6D66',
  border: '#DCE7E2',
  danger: '#C0392B',
  dangerBg: '#FBEAE8',
  amber: '#A5760A',
  amberBg: '#FBF3DC',
  white: '#FFFFFF'
}
const fontDisplay = 'Sora, sans-serif'
const fontBody = 'Inter, sans-serif'
const fontMono = "'JetBrains Mono', monospace"

const cardStyle = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, marginBottom: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(22,38,31,0.04)' }
const inputStyle = { padding: '10px 12px', fontSize: 15, borderRadius: 10, border: `1px solid ${C.border}`, fontFamily: fontBody, width: '100%', boxSizing: 'border-box' }
const buttonStyle = { background: C.courtGreen, color: 'white', border: 'none', borderRadius: 10, padding: '11px 16px', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: fontBody }
const secondaryButtonStyle = { ...buttonStyle, background: 'transparent', color: C.courtGreen, border: `1.5px solid ${C.courtGreen}` }

const statusStyle = {
  geplant: { bg: C.mint, fg: C.courtGreen },
  veroeffentlicht: { bg: C.courtGreen, fg: C.white },
  verlegt: { bg: C.amberBg, fg: C.amber },
  abgesagt: { bg: C.dangerBg, fg: C.danger },
  gespielt: { bg: '#EEF1F0', fg: C.inkMuted }
}

const mapsLink = (adresse) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`

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
            benutzer_id
          )
        )
      `)
      .order('datum')

    if (error) {
      console.error('Fehler beim Laden der Spiele:', error)
      setSpiele([])
      return
    }

    // Alle benutzer_ids aus veröffentlichten Aufstellungen einsammeln
    const alleIds = new Set()
    ;(data || []).forEach(s => {
      const aufstellungen = Array.isArray(s.aufstellungen) ? s.aufstellungen : (s.aufstellungen ? [s.aufstellungen] : [])
      aufstellungen.forEach(a => {
        if (a?.veroeffentlicht) {
          ;(a.aufstellung_spieler || []).forEach(asp => alleIds.add(asp.benutzer_id))
        }
      })
    })

    let profilLex = {}
    if (alleIds.size > 0) {
      const { data: profile } = await supabase
        .from('benutzer_profile')
        .select('id, vorname, nachname, qttr')
        .in('id', Array.from(alleIds))
      profilLex = Object.fromEntries((profile || []).map(p => [p.id, p]))
    }

    // Namen wieder in die Struktur einsetzen, damit der Rest der Komponente unverändert bleibt
    const angereichert = (data || []).map(s => {
      const aufstellungen = Array.isArray(s.aufstellungen) ? s.aufstellungen : (s.aufstellungen ? [s.aufstellungen] : [])
      return {
        ...s,
        aufstellungen: aufstellungen.map(a => ({
          ...a,
          aufstellung_spieler: (a.aufstellung_spieler || []).map(asp => ({
            ...asp,
            benutzer: profilLex[asp.benutzer_id] || null
          }))
        }))
      }
    })

    setSpiele(angereichert)
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

  const formatDatum = (isoDatum) => {
    try {
      const d = new Date(isoDatum + 'T00:00:00')
      return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return isoDatum
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: fontBody, color: C.ink }}>
      <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, background: C.white }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 16px 88px', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 18px', flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 21, margin: 0 }}>Spiele</h1>
          {kannSpielAnlegen && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={secondaryButtonStyle} onClick={() => setImportOffen(o => !o)}>
                {importOffen ? 'Abbrechen' : '📅 ICS'}
              </button>
              <button style={buttonStyle} onClick={() => setFormOffen(f => !f)}>
                {formOffen ? 'Abbrechen' : '+ Spiel'}
              </button>
            </div>
          )}
        </div>

        {importOffen && (
          <div style={{ ...cardStyle, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            {importFehler && <p style={{ color: C.danger, fontSize: 13, margin: 0 }}>{importFehler}</p>}
            {importEvents.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{importEvents.length} Termine gefunden:</div>
                {importEvents.map((ev, i) => (
                  <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
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
          <form onSubmit={spielAnlegen} style={{ ...cardStyle, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            {fehler && <p style={{ color: C.danger, fontSize: 13, margin: 0 }}>{fehler}</p>}
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

          const istHeim = s.heim_oder_auswaerts === 'heim'
          const akzentFarbe = istHeim ? C.courtGreen : C.ballOrange
          const istVeroeffentlicht = !!veroeffentlichteAufstellung && s.status === 'geplant'
          const statusLabel = istVeroeffentlicht ? 'veröffentlicht' : s.status
          const st = istVeroeffentlicht ? statusStyle.veroeffentlicht : (statusStyle[s.status] || statusStyle.gespielt)
          const meineRueckmeldung = meineVerfuegbarkeiten[s.id]
          const counts = verfuegbarkeitCounts[s.id]

          return (
            <div key={s.id} style={{ ...cardStyle, borderLeft: `5px solid ${akzentFarbe}` }}>
              <div style={{ padding: '14px 16px' }}>
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
                    {/* Kopfzeile: Gegner + Status/Bearbeiten */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>
                        {istHeim ? `${s.mannschaften?.name} vs. ${s.gegner}` : `${s.gegner} vs. ${s.mannschaften?.name}`}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                          background: st.bg, color: st.fg, padding: '4px 9px', borderRadius: 999
                        }}>
                          {statusLabel}
                        </span>
                        {kannBearbeiten(s.mannschaft_id) && (
                          <button
                            onClick={() => bearbeitenStarten(s)}
                            aria-label="Spiel bearbeiten"
                            style={{ width: 30, height: 30, borderRadius: 999, border: `1px solid ${C.border}`, background: C.white, color: C.courtGreen, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Home/Away-Chip */}
                    <div style={{ marginTop: 6 }}>
                      <span style={{
                        fontSize: 11.5, fontWeight: 700, color: akzentFarbe,
                        background: istHeim ? C.mint : C.peach, padding: '3px 9px', borderRadius: 6
                      }}>
                        {istHeim ? '🏠 Heimspiel' : '✈️ Auswärts'}
                      </span>
                    </div>

                    {/* Datum / Zeit / Ort */}
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontFamily: fontMono, fontSize: 12.5, color: C.inkMuted }}>
                      <div>📅 {formatDatum(s.datum)}{s.uhrzeit ? ` · ${s.uhrzeit.slice(0, 5)} Uhr` : ''}</div>
                      {s.halle && (
                        <div style={{ fontFamily: fontBody }}>
                          📍 {s.halle}{' '}
                          <a
                            href={mapsLink(s.halle)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: akzentFarbe, fontWeight: 600, textDecoration: 'none' }}
                          >
                            🗺️ Route
                          </a>
                        </div>
                      )}
                    </div>

                    {veroeffentlichteAufstellung && (
                      <div style={{
                        marginTop: 12,
                        padding: '12px 14px',
                        background: C.mint,
                        border: `1px solid ${C.border}`,
                        borderRadius: 12
                      }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: C.courtGreen, marginBottom: 8, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                          📋 Aufstellung
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {(veroeffentlichteAufstellung.aufstellung_spieler || [])
                            .slice()
                            .sort((a, b) => a.position - b.position)
                            .map((asp) => {
                              const b = Array.isArray(asp.benutzer) ? asp.benutzer[0] : asp.benutzer
                              return (
                                <div key={asp.position} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13.5 }}>
                                  <span style={{ fontFamily: fontMono, fontWeight: 700, color: C.courtGreen, minWidth: 16 }}>{asp.position}</span>
                                  <span style={{ flex: 1 }}>{b?.vorname} {b?.nachname}</span>
                                  {b?.qttr && (
                                    <span style={{ fontFamily: fontMono, fontSize: 12, color: C.inkMuted }}>
                                      {b.qttr}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}

                    {mannschaftIdsMeine.has(s.mannschaft_id) && (
                      <div style={{ marginTop: 14 }}>
                        {!meineRueckmeldung && (
                          <div style={{ fontSize: 12, color: C.inkMuted, marginBottom: 6, fontWeight: 600 }}>
                            Rückmeldung noch offen
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <button
                            onClick={() => zusageSetzen(s.id, 'zugesagt')}
                            style={{
                              minHeight: 50, borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                              border: `2px solid ${C.courtGreen}`,
                              background: meineRueckmeldung === 'zugesagt' ? C.courtGreen : C.white,
                              color: meineRueckmeldung === 'zugesagt' ? C.white : C.courtGreen,
                              fontFamily: fontBody
                            }}
                          >
                            ✅ Zusage
                          </button>
                          <button
                            onClick={() => zusageSetzen(s.id, 'abgesagt')}
                            style={{
                              minHeight: 50, borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                              border: `2px solid ${C.danger}`,
                              background: meineRueckmeldung === 'abgesagt' ? C.danger : C.white,
                              color: meineRueckmeldung === 'abgesagt' ? C.white : C.danger,
                              fontFamily: fontBody
                            }}
                          >
                            ❌ Absage
                          </button>
                        </div>
                        <Link
                          to={`/spiele/${s.id}/aufstellung`}
                          style={{
                            marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            minHeight: 44, borderRadius: 12, textDecoration: 'none',
                            border: `1px solid ${C.border}`, color: C.ink, fontSize: 14, fontWeight: 600
                          }}
                        >
                          📋 Aufstellung
                        </Link>
                      </div>
                    )}

                    {kannBearbeiten(s.mannschaft_id) && counts && (
                      <div style={{ display: 'flex', gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontFamily: fontMono, fontSize: 12.5 }}>
                        <span style={{ color: C.courtGreen, fontWeight: 700 }}>✅ {counts.zugesagt || 0}</span>
                        <span style={{ color: C.danger, fontWeight: 700 }}>❌ {counts.abgesagt || 0}</span>
                        <span style={{ color: C.inkMuted, fontWeight: 700 }}>❓ {counts.offen || 0}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}

        {spiele.length === 0 && <p style={{ color: C.inkMuted, fontSize: 14 }}>Noch keine Spiele eingetragen.</p>}
      </div>

      <BottomNav istAdmin={istAdmin} session={session} />
    </div>
  )
}

export default Spiele
