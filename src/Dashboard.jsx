import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

// ── Design-Tokens (konsistent mit Spiele.jsx) ───────────────────
const C = {
  courtGreen: '#1C8A4E',
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
  white: '#FFFFFF',
  gold: '#FFD700',
  purple: '#9B51E0',
  blue: '#2E6FE0',
  mintAccent: '#23D2A0'
}
const fontDisplay = 'Sora, sans-serif'
const fontBody = 'Inter, sans-serif'
const fontMono = "'JetBrains Mono', monospace"

const cardBase = { background: C.white, borderRadius: 16, padding: '18px 16px', marginBottom: 16, boxShadow: '0 1px 2px rgba(22,38,31,0.04)' }
const eyebrow = (color) => ({ fontFamily: fontMono, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color })

const bigButtonStyle = {
  minHeight: 46, borderRadius: 12, fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
  fontFamily: fontBody, flex: 1
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

  // Geburtstag-States
  const [istHeuteGeburtstag, setIstHeuteGeburtstag] = useState(false)
  const [geburtstageKameraden, setGeburtstageKameraden] = useState([])

  const berechneTageBisGeburtstag = (geburtsdatumStr) => {
    if (!geburtsdatumStr) return null
    const heute = new Date()
    heute.setHours(0, 0, 0, 0)

    const parts = geburtsdatumStr.split('-')
    if (parts.length !== 3) return null
    const birthYear = parseInt(parts[0], 10)
    const birthMonth = parseInt(parts[1], 10) - 1
    const birthDay = parseInt(parts[2], 10)

    let naechsterGeb = new Date(heute.getFullYear(), birthMonth, birthDay)
    naechsterGeb.setHours(0, 0, 0, 0)

    if (naechsterGeb < heute) {
      naechsterGeb = new Date(heute.getFullYear() + 1, birthMonth, birthDay)
      naechsterGeb.setHours(0, 0, 0, 0)
    }

    const diffMs = naechsterGeb.getTime() - heute.getTime()
    const tage = Math.round(diffMs / (1000 * 60 * 60 * 24))
    const alter = naechsterGeb.getFullYear() - birthYear

    return { tage, alter }
  }

  const ladeGeburtstage = async () => {
    // 1. Eigener Geburtstag prüfen (eigene Zeile – weiterhin direkt erlaubt)
    const { data: eigenerBenutzer } = await supabase
      .from('benutzer')
      .select('geburtsdatum')
      .eq('id', session.user.id)
      .maybeSingle()

    if (eigenerBenutzer?.geburtsdatum) {
      const stats = berechneTageBisGeburtstag(eigenerBenutzer.geburtsdatum)
      setIstHeuteGeburtstag(stats?.tage === 0)
    }

    // 2. Mannschaftskameraden über RPC (gibt nie das rohe Geburtsdatum zurück, DSGVO)
    const { data: geburtstage, error } = await supabase.rpc('mannschaftskameraden_geburtstage')
    if (error) {
      console.error('Fehler beim Laden der Geburtstage:', error)
      setGeburtstageKameraden([])
      return
    }

    setGeburtstageKameraden((geburtstage || []).map(g => ({
      id: g.benutzer_id,
      vorname: g.vorname,
      nachname: g.nachname,
      tage: g.tage_bis_geburtstag,
      alter: g.wird_alter
    })))
  }

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
    ladeGeburtstage()
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

  const offeneOhneNaechstes = offeneSpiele.filter(s => s.id !== naechstesSpiel?.id)
  const sichtbareSpiele = alleAnzeigen ? offeneOhneNaechstes : offeneOhneNaechstes.slice(0, ANZAHL_SICHTBAR)
  const versteckteAnzahl = offeneOhneNaechstes.length - sichtbareSpiele.length

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: fontBody, color: C.ink }}>
      <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, background: C.white }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 16px 88px', maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 22, margin: '12px 0 4px' }}>
          Hallo {vorname || ''} 👋
        </h1>
        <p style={{ color: C.inkMuted, fontSize: 14, marginBottom: 18 }}>
          Schön, dass du dabei bist.
        </p>

        {/* EIGENER GEBURTSTAGSGRUSS */}
        {istHeuteGeburtstag && (
          <div style={{
            background: `linear-gradient(135deg, ${C.gold} 0%, ${C.ballOrange} 100%)`,
            borderRadius: 16, padding: '18px 16px', marginBottom: 16, color: C.white,
            boxShadow: '0 4px 12px rgba(232,98,44,0.25)', textShadow: '0 1px 2px rgba(0,0,0,0.2)'
          }}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>🎉 🎂 🏓</div>
            <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
              Herzlichen Glückwunsch zum Geburtstag, {vorname}!
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.4, opacity: 0.95 }}>
              Das gesamte Team wünscht dir alles Gute, viel Gesundheit und maximale Erfolge am Tisch!
            </div>
          </div>
        )}

        {/* GEBURTSTAGSERINNERUNG AN MANNSCHAFTSKAMERADEN */}
        {geburtstageKameraden.length > 0 && (
          <div style={{ ...cardBase, border: `1.5px solid ${C.purple}` }}>
            <div style={{ ...eyebrow(C.purple), marginBottom: 10 }}>🎂 Geburtstage im Team</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {geburtstageKameraden.map(k => (
                <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
                  <div>
                    <strong>{k.vorname} {k.nachname}</strong>
                    <span style={{ fontSize: 12, color: C.inkMuted, marginLeft: 6 }}>(wird {k.alter})</span>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 8,
                    background: k.tage === 0 ? C.amberBg : '#F3E8FF',
                    color: k.tage === 0 ? C.amber : C.purple
                  }}>
                    {k.tage === 0 ? 'Heute! 🎉' : k.tage === 1 ? 'Morgen' : `in ${k.tage} Tagen`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BENACHRICHTIGUNGEN */}
        {benachrichtigungen.length > 0 && (
          <div style={{ ...cardBase, border: `1.5px solid ${C.blue}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={eyebrow(C.blue)}>🔔 Neu ({benachrichtigungenAnzahl})</div>
              <button
                onClick={alleBenachrichtigungenGelesen}
                style={{ background: 'none', border: 'none', color: C.inkMuted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0, minHeight: 32 }}
              >
                Alle gelesen
              </button>
            </div>

            {benachrichtigungen.map(b => (
              <div
                key={b.id}
                onClick={() => benachrichtigungOeffnen(b)}
                style={{ padding: '11px 2px', borderTop: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10 }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{b.titel}</div>
                  {b.nachricht && (
                    <div style={{ fontSize: 12.5, color: C.inkMuted, marginTop: 2 }}>{b.nachricht}</div>
                  )}
                </div>
                <div style={{ fontFamily: fontMono, fontSize: 11, color: '#8A9A93', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {zeitKurz(b.erstellt_am)}
                </div>
              </div>
            ))}

            {benachrichtigungenAnzahl > benachrichtigungen.length && (
              <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 8 }}>
                + {benachrichtigungenAnzahl - benachrichtigungen.length} weitere
              </div>
            )}
          </div>
        )}

        {/* NÄCHSTES SPIEL */}
        {naechstesSpiel && (
          <div style={{ ...cardBase, background: C.courtGreen, color: C.white }}>
            <div style={{ ...eyebrow(C.mintAccent), marginBottom: 6 }}>Nächstes Spiel</div>
            <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 16 }}>
              {naechstesSpiel.heim_oder_auswaerts === 'heim'
                ? `${naechstesSpiel.mannschaften?.name} vs. ${naechstesSpiel.gegner}`
                : `${naechstesSpiel.gegner} vs. ${naechstesSpiel.mannschaften?.name}`}
            </div>
            <div style={{ fontFamily: fontMono, fontSize: 12.5, color: 'rgba(255,255,255,.85)', margin: '5px 0 14px' }}>
              📅 {naechstesSpiel.datum} {naechstesSpiel.uhrzeit ? `· ${naechstesSpiel.uhrzeit.slice(0, 5)} Uhr` : ''}
              {naechstesSpiel.halle ? ` · 📍 ${naechstesSpiel.halle}` : ''}
            </div>

            {(!naechsteVerfuegbarkeit || naechsteVerfuegbarkeit === 'offen') && (
              <div style={{ display: 'flex', gap: 8, marginBottom: naechsteAufstellung ? 14 : 0 }}>
                <button
                  onClick={() => zusageSetzen(naechstesSpiel.id, 'zugesagt')}
                  style={{ ...bigButtonStyle, background: C.white, border: `2px solid ${C.white}`, color: C.courtGreen }}
                >
                  ✅ Zusage
                </button>
                <button
                  onClick={() => zusageSetzen(naechstesSpiel.id, 'abgesagt')}
                  style={{ ...bigButtonStyle, background: 'transparent', border: '2px solid rgba(255,255,255,.7)', color: C.white }}
                >
                  ❌ Absage
                </button>
              </div>
            )}
            {naechsteVerfuegbarkeit === 'zugesagt' && (
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: naechsteAufstellung ? 14 : 0 }}>✅ Du hast zugesagt</div>
            )}
            {naechsteVerfuegbarkeit === 'abgesagt' && (
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: naechsteAufstellung ? 14 : 0 }}>❌ Du hast abgesagt</div>
            )}

            {naechsteAufstellung && (
              <div style={{ background: 'rgba(255,255,255,.14)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ ...eyebrow(C.mintAccent), marginBottom: 8 }}>✅ Aufstellung</div>
                {naechsteAufstellung.map((a, i) => (
                  <div key={a.benutzer_id} style={{ display: 'flex', gap: 8, fontSize: 13.5, padding: '2px 0' }}>
                    <span style={{ fontFamily: fontMono, fontWeight: 700 }}>{i + 1}</span>
                    <span>{a.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ERSATZANFRAGEN */}
        {ersatzanfragen.length > 0 && (
          <div style={{ ...cardBase, border: `1.5px solid ${C.mintAccent}` }}>
            <div style={{ ...eyebrow('#146B3B'), marginBottom: 10 }}>🏓 Ersatzspieler-Anfragen ({ersatzanfragen.length})</div>
            {ersatzanfragen.map(a => (
              <div key={a.id} style={{ padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 14 }}>
                  {a.spiele?.heim_oder_auswaerts === 'heim'
                    ? `${a.spiele?.mannschaften?.name} vs. ${a.spiele?.gegner}`
                    : `${a.spiele?.gegner} vs. ${a.spiele?.mannschaften?.name}`}
                </div>
                <div style={{ fontFamily: fontMono, fontSize: 12, color: C.inkMuted, margin: '4px 0 10px' }}>
                  {a.spiele?.datum} {a.spiele?.uhrzeit ? `· ${a.spiele.uhrzeit.slice(0, 5)} Uhr` : ''}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => ersatzanfrageBeantworten(a.id, a.spiel_id, 'zugesagt')}
                    style={{ ...bigButtonStyle, background: C.white, border: `2px solid ${C.courtGreen}`, color: C.courtGreen }}
                  >
                    ✅ Zusage
                  </button>
                  <button
                    onClick={() => ersatzanfrageBeantworten(a.id, a.spiel_id, 'abgelehnt')}
                    style={{ ...bigButtonStyle, background: C.white, border: `2px solid ${C.danger}`, color: C.danger }}
                  >
                    ❌ Ablehnen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* WEITERE OFFENE RÜCKMELDUNGEN */}
        {offeneOhneNaechstes.length > 0 && (
          <div style={{ ...cardBase, border: `1.5px solid ${C.ballOrange}` }}>
            <div style={{ ...eyebrow(C.ballOrange), marginBottom: 10 }}>⚠ Weitere offene Rückmeldungen ({offeneOhneNaechstes.length})</div>

            {sichtbareSpiele.map(s => (
              <div key={s.id} style={{ padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 14 }}>
                  {s.heim_oder_auswaerts === 'heim'
                    ? `${s.mannschaften?.name} vs. ${s.gegner}`
                    : `${s.gegner} vs. ${s.mannschaften?.name}`}
                </div>
                <div style={{ fontFamily: fontMono, fontSize: 12, color: C.inkMuted, margin: '4px 0 10px' }}>
                  {s.datum} {s.uhrzeit ? `· ${s.uhrzeit.slice(0, 5)} Uhr` : ''}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => zusageSetzen(s.id, 'zugesagt')}
                    style={{ ...bigButtonStyle, background: C.white, border: `2px solid ${C.courtGreen}`, color: C.courtGreen }}
                  >
                    ✅ Zusage
                  </button>
                  <button
                    onClick={() => zusageSetzen(s.id, 'abgesagt')}
                    style={{ ...bigButtonStyle, background: C.white, border: `2px solid ${C.danger}`, color: C.danger }}
                  >
                    ❌ Absage
                  </button>
                </div>
              </div>
            ))}

            {versteckteAnzahl > 0 && (
              <button
                onClick={() => setAlleAnzeigen(true)}
                style={{ marginTop: 10, background: 'none', border: 'none', color: C.courtGreen, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, minHeight: 32 }}
              >
                + {versteckteAnzahl} weitere anzeigen
              </button>
            )}
            {alleAnzeigen && offeneOhneNaechstes.length > ANZAHL_SICHTBAR && (
              <button
                onClick={() => setAlleAnzeigen(false)}
                style={{ marginTop: 10, background: 'none', border: 'none', color: C.inkMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, minHeight: 32 }}
              >
                Weniger anzeigen
              </button>
            )}
          </div>
        )}

        <div style={{ ...cardBase, border: `1px solid ${C.border}` }}>
          <div style={{ ...eyebrow(C.mintAccent), marginBottom: 6 }}>Los geht's</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            Schau unter <strong>Spiele</strong> vorbei, um die Spielübersicht deiner Mannschaft(en) zu sehen.
            {istAdmin && <> Als Admin verwaltest du unter <strong>Mannschaften</strong> Teams und Einladungslinks.</>}
          </p>
        </div>

        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            background: 'transparent', border: `1.5px solid ${C.courtGreen}`, color: C.courtGreen,
            borderRadius: 10, minHeight: 44, padding: '0 20px', cursor: 'pointer', fontSize: 14, fontWeight: 700
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
