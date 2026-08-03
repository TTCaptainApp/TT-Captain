import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

const cardStyle = { background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 14, marginBottom: 12 }
const buttonStyle = { background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const secondaryButtonStyle = { ...buttonStyle, background: 'transparent', color: '#1C8A4E', border: '1px solid #1C8A4E' }
const smallIconButtonStyle = {
  width: 30, height: 30, borderRadius: 7, border: '1px solid #DCE7E2', background: 'white',
  cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center'
}

const anfrageStatusFarbe = { angefragt: '#d4a017', zugesagt: '#1C8A4E', abgelehnt: '#c0392b' }

function Aufstellung({ session }) {
  const { spielId } = useParams()
  const [istAdmin, setIstAdmin] = useState(false)
  const [spiel, setSpiel] = useState(null)
  const [kannBearbeiten, setKannBearbeiten] = useState(false)
  const [aufstellungId, setAufstellungId] = useState(null)
  const [veroeffentlicht, setVeroeffentlicht] = useState(false)
  const [ausgewaehlt, setAusgewaehlt] = useState([])
  const [verfuegbareSpieler, setVerfuegbareSpieler] = useState([])
  const [ladend, setLadend] = useState(true)
  const [fehler, setFehler] = useState(null)
  const [hinweis, setHinweis] = useState(null)

  const [ersatzsucheOffen, setErsatzsucheOffen] = useState(false)
  const [vereinsmitglieder, setVereinsmitglieder] = useState([])
  const [ersatzanfragen, setErsatzanfragen] = useState([])

  const laden = async () => {
    setLadend(true)

    const { data: benutzerRow } = await supabase.from('benutzer').select('ist_administrator').eq('id', session.user.id).single()
    const admin = benutzerRow?.ist_administrator || false
    setIstAdmin(admin)

    const { data: spielData } = await supabase
      .from('spiele')
      .select('id, mannschaft_id, gegner, heim_oder_auswaerts, datum, uhrzeit, mannschaften(name)')
      .eq('id', spielId)
      .single()
    setSpiel(spielData)

    let darfBearbeiten = admin
    if (!darfBearbeiten && spielData) {
      const { data: zuordnung } = await supabase
        .from('mannschaftszuordnungen')
        .select('rolle')
        .eq('benutzer_id', session.user.id)
        .eq('mannschaft_id', spielData.mannschaft_id)
        .maybeSingle()
      darfBearbeiten = zuordnung && (zuordnung.rolle === 'spielfuehrer' || zuordnung.rolle === 'stellvertreter')
    }
    setKannBearbeiten(darfBearbeiten)

    const { data: namen } = await supabase.rpc('teamkollegen_namen')
    const namenLexikon = Object.fromEntries((namen || []).map(n => [n.id, `${n.vorname} ${n.nachname}`]))

    const { data: auf } = await supabase.from('aufstellungen').select('id, veroeffentlicht').eq('spiel_id', spielId).maybeSingle()
    if (auf) {
      setAufstellungId(auf.id)
      setVeroeffentlicht(auf.veroeffentlicht)
      const { data: spielerRows } = await supabase
        .from('aufstellung_spieler')
        .select('benutzer_id, position')
        .eq('aufstellung_id', auf.id)
        .order('position')
      setAusgewaehlt((spielerRows || []).map(r => ({ benutzer_id: r.benutzer_id, name: namenLexikon[r.benutzer_id] || '?' })))
    } else {
      setAufstellungId(null)
      setVeroeffentlicht(false)
      setAusgewaehlt([])
    }

    if (darfBearbeiten) {
      const { data: verf } = await supabase
        .from('verfuegbarkeiten')
        .select('benutzer_id')
        .eq('spiel_id', spielId)
        .eq('status', 'zugesagt')
      setVerfuegbareSpieler((verf || []).map(v => ({ benutzer_id: v.benutzer_id, name: namenLexikon[v.benutzer_id] || '?' })))

      const { data: mitglieder } = await supabase.rpc('vereinsmitglieder_ersatzsuche')
      setVereinsmitglieder((mitglieder || []).sort((a, b) => (b.qttr || 0) - (a.qttr || 0)))

      const { data: anfragenRows } = await supabase
        .from('ersatzanfragen')
        .select('id, angefragter_benutzer_id, status')
        .eq('spiel_id', spielId)
      setErsatzanfragen((anfragenRows || []).map(a => ({ ...a, name: namenLexikon[a.angefragter_benutzer_id] || '?' })))
    }

    setLadend(false)
  }

  useEffect(() => { laden() }, [spielId, session])

  const spielerHinzufuegen = (spieler) => {
    if (ausgewaehlt.some(a => a.benutzer_id === spieler.benutzer_id)) return
    setAusgewaehlt(prev => [...prev, spieler])
  }

  const spielerEntfernen = (benutzerId) => {
    setAusgewaehlt(prev => prev.filter(a => a.benutzer_id !== benutzerId))
  }

  const nachObenVerschieben = (index) => {
    if (index === 0) return
    setAusgewaehlt(prev => {
      const kopie = [...prev]
      ;[kopie[index - 1], kopie[index]] = [kopie[index], kopie[index - 1]]
      return kopie
    })
  }

  const nachUntenVerschieben = (index) => {
    setAusgewaehlt(prev => {
      if (index === prev.length - 1) return prev
      const kopie = [...prev]
      ;[kopie[index], kopie[index + 1]] = [kopie[index + 1], kopie[index]]
      return kopie
    })
  }

  const speichern = async (veroeffentlichen) => {
    setFehler(null)
    setHinweis(null)
    let aId = aufstellungId

    if (!aId) {
      const { data, error } = await supabase
        .from('aufstellungen')
        .insert({ spiel_id: spielId, erstellt_von: session.user.id })
        .select()
        .single()
      if (error) { setFehler(error.message); return }
      aId = data.id
      setAufstellungId(aId)
    }

    await supabase.from('aufstellung_spieler').delete().eq('aufstellung_id', aId)
    if (ausgewaehlt.length > 0) {
      const { error: insertError } = await supabase.from('aufstellung_spieler').insert(
        ausgewaehlt.map((a, i) => ({ aufstellung_id: aId, benutzer_id: a.benutzer_id, position: i + 1 }))
      )
      if (insertError) { setFehler(insertError.message); return }
    }

    if (veroeffentlichen) {
      const { error: updateError } = await supabase
        .from('aufstellungen')
        .update({ veroeffentlicht: true, veroeffentlicht_am: new Date().toISOString() })
        .eq('id', aId)
      if (updateError) { setFehler(updateError.message); return }
      setVeroeffentlicht(true)
      setHinweis('Aufstellung veröffentlicht – alle Mitspieler können sie jetzt sehen.')
    } else {
      setHinweis('Entwurf gespeichert. Noch nicht sichtbar für andere Mitspieler.')
    }
  }

  const ersatzspielerAnfragen = async (benutzerId) => {
    setFehler(null)
    const { error } = await supabase.from('ersatzanfragen').insert({
      spiel_id: spielId,
      angefragter_benutzer_id: benutzerId,
      angefragt_von: session.user.id
    })
    if (error) { setFehler(error.message); return }
    laden()
  }

  if (ladend) return null

  const bereitsAngefragtIds = new Set(
    ersatzanfragen.filter(a => a.status === 'angefragt' || a.status === 'zugesagt').map(a => a.angefragter_benutzer_id)
  )
  const kandidaten = vereinsmitglieder.filter(m =>
    !ausgewaehlt.some(a => a.benutzer_id === m.id) &&
    !verfuegbareSpieler.some(v => v.benutzer_id === m.id) &&
    !bereitsAngefragtIds.has(m.id) &&
    m.id !== session.user.id
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff' }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 20px 80px', maxWidth: 480, margin: '0 auto' }}>
        <Link to="/spiele" style={{ fontSize: 13, color: '#1C8A4E', fontWeight: 600, textDecoration: 'none' }}>← Zurück zu Spiele</Link>

        {spiel && (
          <div style={{ margin: '12px 0 20px' }}>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 19, margin: '0 0 4px' }}>
              {spiel.heim_oder_auswaerts === 'heim'
                ? `${spiel.mannschaften?.name} vs. ${spiel.gegner}`
                : `${spiel.gegner} vs. ${spiel.mannschaften?.name}`}
            </h1>
            <div style={{ fontSize: 13, color: '#5B6D66' }}>
              {spiel.datum} {spiel.uhrzeit ? `· ${spiel.uhrzeit.slice(0, 5)} Uhr` : ''}
              {' · '}
              {veroeffentlicht ? '✅ Veröffentlicht' : '📝 Entwurf'}
            </div>
          </div>
        )}

        {!kannBearbeiten && !veroeffentlicht && (
          <div style={cardStyle}>
            <p style={{ margin: 0, fontSize: 14, color: '#5B6D66' }}>
              Die Aufstellung wird noch vom Spielführer erstellt. Schau später nochmal vorbei.
            </p>
          </div>
        )}

        {!kannBearbeiten && veroeffentlicht && (
          <div style={cardStyle}>
            {ausgewaehlt.map((a, i) => (
              <div key={a.benutzer_id} style={{ padding: '8px 0', borderTop: i > 0 ? '1px solid #DCE7E2' : 'none', fontSize: 14 }}>
                <strong>{i + 1}.</strong> {a.name}
              </div>
            ))}
          </div>
        )}

        {kannBearbeiten && (
          <>
            <div style={cardStyle}>
              <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                Aufstellung ({ausgewaehlt.length})
              </div>
              {ausgewaehlt.length === 0 && (
                <p style={{ fontSize: 13, color: '#5B6D66', margin: 0 }}>Noch niemand ausgewählt.</p>
              )}
              {ausgewaehlt.map((a, i) => (
                <div key={a.benutzer_id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
                  borderTop: i > 0 ? '1px solid #DCE7E2' : 'none'
                }}>
                  <span style={{ fontSize: 14, flex: 1 }}><strong>{i + 1}.</strong> {a.name}</span>
                  <button style={smallIconButtonStyle} onClick={() => nachObenVerschieben(i)} disabled={i === 0}>▲</button>
                  <button style={smallIconButtonStyle} onClick={() => nachUntenVerschieben(i)} disabled={i === ausgewaehlt.length - 1}>▼</button>
                  <button style={{ ...smallIconButtonStyle, color: '#c0392b' }} onClick={() => spielerEntfernen(a.benutzer_id)}>✕</button>
                </div>
              ))}
            </div>

            <div style={cardStyle}>
              <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                Zugesagt, noch nicht in der Aufstellung
              </div>
              {verfuegbareSpieler.filter(v => !ausgewaehlt.some(a => a.benutzer_id === v.benutzer_id)).length === 0 && (
                <p style={{ fontSize: 13, color: '#5B6D66', margin: 0 }}>Keine weiteren zugesagten Spieler.</p>
              )}
              {verfuegbareSpieler
                .filter(v => !ausgewaehlt.some(a => a.benutzer_id === v.benutzer_id))
                .map(v => (
                  <div key={v.benutzer_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                    <span style={{ fontSize: 14 }}>{v.name}</span>
                    <button style={secondaryButtonStyle} onClick={() => spielerHinzufuegen(v)}>+ Hinzufügen</button>
                  </div>
                ))}
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 14 }}>
                  🔍 Ersatzspieler
                </div>
                <button style={secondaryButtonStyle} onClick={() => setErsatzsucheOffen(o => !o)}>
                  {ersatzsucheOffen ? 'Schließen' : 'Suchen'}
                </button>
              </div>

              {ersatzanfragen.length > 0 && (
                <div style={{ marginBottom: ersatzsucheOffen ? 12 : 0 }}>
                  {ersatzanfragen.map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                      <span>{a.name}</span>
                      <span style={{ color: anfrageStatusFarbe[a.status], fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {ersatzsucheOffen && (
                <>
                  {kandidaten.length === 0 && (
                    <p style={{ fontSize: 13, color: '#5B6D66', margin: 0 }}>Keine weiteren Vereinsmitglieder verfügbar.</p>
                  )}
                  {kandidaten.map(k => (
                    <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                      <span style={{ fontSize: 14 }}>{k.vorname} {k.nachname} <span style={{ color: '#5B6D66', fontSize: 12.5 }}>({k.qttr ?? '–'} QTTR)</span></span>
                      <button style={secondaryButtonStyle} onClick={() => ersatzspielerAnfragen(k.id)}>Anfragen</button>
                    </div>
                  ))}
                </>
              )}
            </div>

            {fehler && <p style={{ color: '#c0392b', fontSize: 13 }}>{fehler}</p>}
            {hinweis && <p style={{ color: '#1C8A4E', fontSize: 13 }}>{hinweis}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={secondaryButtonStyle} onClick={() => speichern(false)}>Entwurf speichern</button>
              <button style={buttonStyle} onClick={() => speichern(true)}>Veröffentlichen</button>
            </div>
          </>
        )}
      </div>

      <BottomNav istAdmin={istAdmin} />
    </div>
  )
}

export default Aufstellung
