import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

const smallButtonStyle = {
  padding: '6px 12px', fontSize: 12.5, fontWeight: 600, borderRadius: 7,
  cursor: 'pointer', border: '1px solid #DCE7E2', background: 'white', color: '#16261F'
}

const ANZAHL_SICHTBAR = 2
const BENACHRICHTIGUNGEN_SICHTBAR = 4

function Dashboard({ session }) {
  const navigate = useNavigate()
  const [vorname, setVorname] = useState('')
  const [istAdmin, setIstAdmin] = useState(false)
  const [offeneSpiele, setOffeneSpiele] = useState([])
  const [alleAnzeigen, setAlleAnzeigen] = useState(false)
  const [ersatzanfragen, setErsatzanfragen] = useState([])
  const [naechstesSpiel, setNaechstesSpiel] = useState(null)
  const [naechsteVerfuegbarkeit, setNaechsteVerfuegbarkeit] = useState(null)
  const [naechsteAufstellung, setNaechsteAufstellung] = useState(null)
  const [benachrichtigungen, setBenachrichtigungen] = useState([])
  const [benachrichtigungenAnzahl, setBenachrichtigungenAnzahl] = useState(0)

  const ladeNaechstesSpiel = async () => {
    const { data: zuordnungen } = await supabase
      .from('mannschaftszuordnungen')
      .select('mannschaft_id')
      .eq('benutzer_id', session.user.id)
    const mannschaftIds = (zuordnungen || []).map(z => z.mannschaft_id)
    if (mannschaftIds.length === 0) { setNaechstesSpiel(null); return }

    const heute = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('spiele')
      .select('id, mannschaft_id, gegner, heim_oder_auswaerts, datum, uhrzeit, halle, mannschaften(name)')
      .in('mannschaft_id', mannschaftIds)
      .eq('status', 'geplant')
      .gte('datum', heute)
      .order('datum', { ascending: true })
      .order('uhrzeit', { ascending: true })
      .limit(1)

    const spiel = data?.[0] || null
    setNaechstesSpiel(spiel)
    if (!spiel) { setNaechsteVerfuegbarkeit(null); setNaechsteAufstellung(null); return }

    const { data: verf } = await supabase
      .from('verfuegbarkeiten')
      .select('status')
      .eq('spiel_id', spiel.id)
      .eq('benutzer_id', session.user.id)
      .maybeSingle()
    setNaechsteVerfuegbarkeit(verf?.status || null)

    const { data: auf } = await supabase
      .from('aufstellungen')
      .select('id, veroeffentlicht')
      .eq('spiel_id', spiel.id)
      .maybeSingle()

    if (auf?.veroeffentlicht) {
      const { data: namen } = await supabase.rpc('teamkollegen_namen')
      const lex = Object.fromEntries((namen || []).map(n => [n.id, `${n.vorname} ${n.nachname}`]))
      const { data: spielerRows } = await supabase
        .from('aufstellung_spieler')
        .select('benutzer_id, position')
        .eq('aufstellung_id', auf.id)
        .order('position')
      setNaechsteAufstellung((spielerRows || []).map(r => ({ ...r, name: lex[r.benutzer_id] || '?' })))
    } else {
      setNaechsteAufstellung(null)
    }
  }

  const ladeOffeneSpiele = async () => {
    const { data: zuordnungen } = await supabase
      .from('mannschaftszuordnungen')
      .select('mannschaft_id')
      .eq('benutzer_id', session.user.id)
    const mannschaftIds = (zuordnungen || []).map(z => z.mannschaft_id)
    if (mannschaftIds.length === 0) { setOffeneSpiele([]); return }

    const heute = new Date().toISOString().slice(0, 10)
    const { data: spieleData } = await supabase
      .from('spiele')
      .select('id, gegner, heim_oder_auswaerts, datum, uhrzeit, mannschaften(name)')
      .in('mannschaft_id', mannschaftIds)
      .eq('status', 'geplant')
      .gte('datum', heute)
      .order('datum')

    const { data: verfData } = await supabase
      .from('verfuegbarkeiten')
      .select('spiel_id, status')
      .eq('benutzer_id', session.user.id)

    const statusMap = Object.fromEntries((verfData || []).map(v => [v.spiel_id, v.status]))
    const offene = (spieleData || []).filter(s => !statusMap[s.id] || statusMap[s.id] === 'offen')
    setOffeneSpiele(offene)
  }

  const ladeErsatzanfragen = async () => {
    const { data } = await supabase
      .from('ersatzanfragen')
      .select('id, spiel_id, spiele(gegner, heim_oder_auswaerts, datum, uhrzeit, mannschaften(name))')
      .eq('angefragter_benutzer_id', session.user.id)
      .eq('status', 'angefragt')
    setErsatzanfragen(data || [])
  }

  const ladeBenachrichtigungen = async () => {
    const { data, count } = await supabase
      .from('benachrichtigungen')
      .select('id, typ, titel, nachricht, link, erstellt_am', { count: 'exact' })
      .eq('benutzer_id', session.user.id)
      .eq('gelesen', false)
      .order('erstellt_am', { ascending: false })
      .limit(BENACHRICHTIGUNGEN_SICHTBAR)
    setBenachrichtigungen(data || [])
    setBenachrichtigungenAnzahl(count || 0)
  }

  const ladeAlles = () => {
    ladeNaechstesSpiel()
    ladeOffeneSpiele()
    ladeErsatzanfragen()
    ladeBenachrichtigungen()
  }

  useEffect(() => {
    supabase.from('benutzer').select('vorname, ist_administrator').eq('id', session.user.id).single()
      .then(({ data }) => {
        if (data) {
          setVorname(data.vorname)
          setIstAdmin(data.ist_administrator)
        }
      })
    ladeAlles()
  }, [session])

  const zusageSetzen = async (spielId, status) => {
    await supabase.from('verfuegbarkeiten').upsert(
      { spiel_id: spielId, benutzer_id: session.user.id, status, geaendert_am: new Date().toISOString() },
      { onConflict: 'spiel_id,benutzer_id' }
    )
    ladeAlles()
  }

  const ersatzanfrageBeantworten = async (anfrageId, spielId, antwort) => {
    await supabase.from('ersatzanfragen').update({
      status: antwort, beantwortet_am: new Date().toISOString()
    }).eq('id', anfrageId)

    if (antwort === 'zugesagt') {
      await supabase.from('verfuegbarkeiten').upsert(
        { spiel_id: spielId, benutzer_id: session.user.id, status: 'zugesagt', geaendert_am: new Date().toISOString() },
        { onConflict: 'spiel_id,benutzer_id' }
      )
    }
    ladeAlles()
  }

  const benachrichtigungOeffnen = async (b) => {
    await supabase.from('benachrichtigungen').update({ gelesen: true }).eq('id', b.id)
    ladeBenachrichtigungen()
    if (b.link) navigate(b.link)
  }

  const alleBenachrichtigungenGelesen = async () => {
    await supabase.from('benachrichtigungen')
      .update({ gelesen: true })
      .eq('benutzer_id', session.user.id)
      .eq('gelesen', false)
    ladeBenachrichtigungen()
  }

  const zeitKurz = (iso) => {
    const datum = new Date(iso)
    const heute = new Date()
    const istHeute = datum.toDateString() === heute.toDateString()
    if (istHeute) {
      return datum.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    }
    return datum.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  }

  // Das nächste Spiel wird oben separat gezeigt, daher aus der
  // "Offene Rückmeldungen"-Liste herausfiltern (keine Dopplung)
  const offeneOhneNaechstes = offeneSpiele.filter(s => s.id !== naechstesSpiel?.id)
  const sichtbareSpiele = alleAnzeigen ? offeneOhneNaechstes : offeneOhneNaechstes.slice(0, ANZAHL_SICHTBAR)
  const versteckteAnzahl = offeneOhneNaechstes.length - sichtbareSpiele.length

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff' }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 20px 80px', maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 22, margin: '12px 0 4px' }}>
          Hallo {vorname || ''} 👋
        </h1>
        <p style={{ color: '#5B6D66', fontSize: 14, marginBottom: 20 }}>
          Schön, dass du dabei bist.
        </p>

        {benachrichtigungen.length > 0 && (
          <div style={{
            background: '#ffffff', border: '2px solid #2E6FE0', borderRadius: 16,
            padding: '18px 16px', marginBottom: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
                letterSpacing: '.06em', textTransform: 'uppercase', color: '#2E6FE0'
              }}>
                🔔 Neu ({benachrichtigungenAnzahl})
              </div>
              <button
                onClick={alleBenachrichtigungenGelesen}
                style={{ background: 'none', border: 'none', color: '#5B6D66', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Alle gelesen
              </button>
            </div>

            {benachrichtigungen.map(b => (
              <div
                key={b.id}
                onClick={() => benachrichtigungOeffnen(b)}
                style={{ padding: '9px 0', borderTop: '1px solid #DCE7E2', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10 }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{b.titel}</div>
                  {b.nachricht && (
                    <div style={{ fontSize: 12.5, color: '#5B6D66', marginTop: 2 }}>{b.nachricht}</div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#8A9A93', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {zeitKurz(b.erstellt_am)}
                </div>
              </div>
            ))}

            {benachrichtigungenAnzahl > benachrichtigungen.length && (
              <div style={{ fontSize: 12, color: '#5B6D66', marginTop: 8 }}>
                + {benachrichtigungenAnzahl - benachrichtigungen.length} weitere
              </div>
            )}
          </div>
        )}

        {naechstesSpiel && (
          <div style={{
            background: '#1C8A4E', borderRadius: 16, padding: '18px 16px', marginBottom: 16, color: 'white'
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
              letterSpacing: '.06em', textTransform: 'uppercase', color: '#23D2A0', marginBottom: 6
            }}>
              Nächstes Spiel
            </div>
            <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 16 }}>
              {naechstesSpiel.heim_oder_auswaerts === 'heim'
                ? `${naechstesSpiel.mannschaften?.name} vs. ${naechstesSpiel.gegner}`
                : `${naechstesSpiel.gegner} vs. ${naechstesSpiel.mannschaften?.name}`}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', margin: '3px 0 12px' }}>
              {naechstesSpiel.datum} {naechstesSpiel.uhrzeit ? `· ${naechstesSpiel.uhrzeit.slice(0, 5)} Uhr` : ''}
              {naechstesSpiel.halle ? ` · ${naechstesSpiel.halle}` : ''}
            </div>

            {(!naechsteVerfuegbarkeit || naechsteVerfuegbarkeit === 'offen') && (
              <div style={{ display: 'flex', gap: 8, marginBottom: naechsteAufstellung ? 14 : 0 }}>
                <button
                  onClick={() => zusageSetzen(naechstesSpiel.id, 'zugesagt')}
                  style={{ ...smallButtonStyle, background: 'white', borderColor: 'white', color: '#1C8A4E' }}
                >
                  ✅ Zusage
                </button>
                <button
                  onClick={() => zusageSetzen(naechstesSpiel.id, 'abgesagt')}
                  style={{ ...smallButtonStyle, background: 'transparent', borderColor: 'rgba(255,255,255,.6)', color: 'white' }}
                >
                  ❌ Absage
                </button>
              </div>
            )}
            {naechsteVerfuegbarkeit === 'zugesagt' && (
              <div style={{ fontSize: 13, marginBottom: naechsteAufstellung ? 14 : 0 }}>✅ Du hast zugesagt</div>
            )}
            {naechsteVerfuegbarkeit === 'abgesagt' && (
              <div style={{ fontSize: 13, marginBottom: naechsteAufstellung ? 14 : 0 }}>❌ Du hast abgesagt</div>
            )}

            {naechsteAufstellung && (
              <div style={{ background: 'rgba(255,255,255,.12)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, color: '#23D2A0' }}>
                  ✅ Aufstellung
                </div>
                {naechsteAufstellung.map((a, i) => (
                  <div key={a.benutzer_id} style={{ fontSize: 13.5, padding: '2px 0' }}>
                    <strong>{i + 1}.</strong> {a.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {ersatzanfragen.length > 0 && (
          <div style={{
            background: '#ffffff', border: '2px solid #23D2A0', borderRadius: 16,
            padding: '18px 16px', marginBottom: 16
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
              letterSpacing: '.06em', textTransform: 'uppercase', color: '#146B3B', marginBottom: 10
            }}>
              🏓 Ersatzspieler-Anfragen ({ersatzanfragen.length})
            </div>
            {ersatzanfragen.map(a => (
              <div key={a.id} style={{ padding: '10px 0', borderTop: '1px solid #DCE7E2' }}>
                <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 14 }}>
                  {a.spiele?.heim_oder_auswaerts === 'heim'
                    ? `${a.spiele?.mannschaften?.name} vs. ${a.spiele?.gegner}`
                    : `${a.spiele?.gegner} vs. ${a.spiele?.mannschaften?.name}`}
                </div>
                <div style={{ fontSize: 12.5, color: '#5B6D66', margin: '3px 0 8px' }}>
                  {a.spiele?.datum} {a.spiele?.uhrzeit ? `· ${a.spiele.uhrzeit.slice(0, 5)} Uhr` : ''}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => ersatzanfrageBeantworten(a.id, a.spiel_id, 'zugesagt')} style={{ ...smallButtonStyle, borderColor: '#1C8A4E', color: '#1C8A4E' }}>
                    ✅ Zusage
                  </button>
                  <button onClick={() => ersatzanfrageBeantworten(a.id, a.spiel_id, 'abgelehnt')} style={{ ...smallButtonStyle, borderColor: '#c0392b', color: '#c0392b' }}>
                    ❌ Ablehnen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {offeneOhneNaechstes.length > 0 && (
          <div style={{
            background: '#ffffff', border: '2px solid #FF5A1F', borderRadius: 16,
            padding: '18px 16px', marginBottom: 16
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
              letterSpacing: '.06em', textTransform: 'uppercase', color: '#FF5A1F', marginBottom: 10
            }}>
              ⚠ Weitere offene Rückmeldungen ({offeneOhneNaechstes.length})
            </div>

            {sichtbareSpiele.map(s => (
              <div key={s.id} style={{ padding: '10px 0', borderTop: '1px solid #DCE7E2' }}>
                <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 14 }}>
                  {s.heim_oder_auswaerts === 'heim'
                    ? `${s.mannschaften?.name} vs. ${s.gegner}`
                    : `${s.gegner} vs. ${s.mannschaften?.name}`}
                </div>
                <div style={{ fontSize: 12.5, color: '#5B6D66', margin: '3px 0 8px' }}>
                  {s.datum} {s.uhrzeit ? `· ${s.uhrzeit.slice(0, 5)} Uhr` : ''}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => zusageSetzen(s.id, 'zugesagt')} style={{ ...smallButtonStyle, borderColor: '#1C8A4E', color: '#1C8A4E' }}>
                    ✅ Zusage
                  </button>
                  <button onClick={() => zusageSetzen(s.id, 'abgesagt')} style={{ ...smallButtonStyle, borderColor: '#c0392b', color: '#c0392b' }}>
                    ❌ Absage
                  </button>
                </div>
              </div>
            ))}

            {versteckteAnzahl > 0 && (
              <button
                onClick={() => setAlleAnzeigen(true)}
                style={{ marginTop: 8, background: 'none', border: 'none', color: '#1C8A4E', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                + {versteckteAnzahl} weitere anzeigen
              </button>
            )}
            {alleAnzeigen && offeneOhneNaechstes.length > ANZAHL_SICHTBAR && (
              <button
                onClick={() => setAlleAnzeigen(false)}
                style={{ marginTop: 8, background: 'none', border: 'none', color: '#5B6D66', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Weniger anzeigen
              </button>
            )}
          </div>
        )}

        <div style={{ background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 16, padding: '20px 18px', marginBottom: 16 }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
            letterSpacing: '.06em', textTransform: 'uppercase', color: '#23D2A0', marginBottom: 6
          }}>
            Los geht's
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            Schau unter <strong>Spiele</strong> vorbei, um die Spielübersicht deiner Mannschaft(en) zu sehen.
            {istAdmin && <> Als Admin verwaltest du unter <strong>Mannschaften</strong> Teams und Einladungslinks.</>}
          </p>
        </div>

        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            background: 'transparent', border: '1px solid #1C8A4E', color: '#1C8A4E',
            borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600
          }}
        >
          Abmelden
        </button>
      </div>

      <BottomNav istAdmin={istAdmin} session={session} />
    </div>
  )
}

export default Dashboard
