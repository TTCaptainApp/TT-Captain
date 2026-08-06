import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

const cardStyle = { background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 16, marginBottom: 12 }
const inputStyle = { padding: '9px 10px', fontSize: 14, borderRadius: 8, border: '1px solid #DCE7E2', fontFamily: 'inherit', flex: 1 }
const buttonStyle = { background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const smallButtonStyle = { ...buttonStyle, padding: '6px 10px', fontSize: 12.5 }
const outlineSmallButtonStyle = { ...smallButtonStyle, background: 'transparent', color: '#1C8A4E', border: '1px solid #1C8A4E' }

const KADER_VORSCHAU_ANZAHL = 4

function Mannschaften({ session }) {
  const [vereinId, setVereinId] = useState(null)
  const [istAdministrator, setIstAdministrator] = useState(false)
  const [mannschaften, setMannschaften] = useState([])
  const [neuerName, setNeuerName] = useState('')
  const [links, setLinks] = useState({})
  const [fehler, setFehler] = useState(null)
  const [kopiert, setKopiert] = useState(null)

  // Kaderverwaltung
  const [meineRollen, setMeineRollen] = useState({})
  const [kader, setKader] = useState({})
  const [kaderOffen, setKaderOffen] = useState({})
  const [kaderAlleAnzeigen, setKaderAlleAnzeigen] = useState({})
  const [qttrBearbeitenId, setQttrBearbeitenId] = useState(null)
  const [qttrEingabe, setQttrEingabe] = useState('')
  const [qttrSpeichernLaeuft, setQttrSpeichernLaeuft] = useState(false)
  const [qttrFehler, setQttrFehler] = useState(null)

  const ladeMannschaften = async (vId) => {
    const { data } = await supabase.from('mannschaften').select('id, name').eq('verein_id', vId).eq('archiviert', false).order('name')
    setMannschaften(data || [])
  }

  const ladeLinks = async (mannschaftId) => {
    const { data } = await supabase.from('einladungslinks').select('id, code, aktiv').eq('mannschaft_id', mannschaftId).order('erstellt_am', { ascending: false })
    setLinks(prev => ({ ...prev, [mannschaftId]: data || [] }))
  }

  const ladeMeineRollen = async () => {
    const { data } = await supabase.from('mannschaftszuordnungen').select('mannschaft_id, rolle').eq('benutzer_id', session.user.id)
    const rollen = {}
    ;(data || []).forEach(z => { rollen[z.mannschaft_id] = z.rolle })
    setMeineRollen(rollen)
  }

  const ladeKader = async (mannschaftId) => {
    const { data } = await supabase
      .from('mannschaftszuordnungen')
      .select('id, rolle, benutzer(id, vorname, nachname, qttr)')
      .eq('mannschaft_id', mannschaftId)

    const liste = (data || [])
      .filter(z => z.benutzer)
      .map(z => ({ id: z.benutzer.id, vorname: z.benutzer.vorname, nachname: z.benutzer.nachname, qttr: z.benutzer.qttr, rolle: z.rolle }))
      .sort((a, b) => (b.qttr ?? -1) - (a.qttr ?? -1))

    setKader(prev => ({ ...prev, [mannschaftId]: liste }))
  }

  const kaderTogglen = async (mannschaftId) => {
    const istOffen = kaderOffen[mannschaftId]
    if (!istOffen && !kader[mannschaftId]) {
      await ladeKader(mannschaftId)
    }
    setKaderOffen(prev => ({ ...prev, [mannschaftId]: !istOffen }))
  }

  const darfQttrBearbeiten = (mannschaftId) => {
    if (istAdministrator) return true
    const rolle = meineRollen[mannschaftId]
    return rolle === 'spielfuehrer' || rolle === 'stellvertreter'
  }

  const qttrBearbeitungStarten = (mitglied) => {
    setQttrFehler(null)
    setQttrBearbeitenId(mitglied.id)
    setQttrEingabe(mitglied.qttr?.toString() || '')
  }

  const qttrSpeichern = async (mannschaftId, mitgliedId) => {
    setQttrFehler(null)
    const wert = parseInt(qttrEingabe, 10)
    if (isNaN(wert) || wert < 0 || wert > 3000) {
      setQttrFehler('Bitte einen gültigen QTTR-Wert eingeben (0–3000).')
      return
    }
    setQttrSpeichernLaeuft(true)
    const { error } = await supabase.rpc('spielfuehrer_qttr_aendern', {
      zielbenutzer_id: mitgliedId,
      neuer_wert: wert
    })
    setQttrSpeichernLaeuft(false)
    if (error) {
      setQttrFehler(error.message)
      return
    }
    setKader(prev => ({
      ...prev,
      [mannschaftId]: prev[mannschaftId].map(m => m.id === mitgliedId ? { ...m, qttr: wert } : m)
    }))
    setQttrBearbeitenId(null)
  }

  useEffect(() => {
    supabase.from('benutzer').select('verein_id, ist_administrator').eq('id', session.user.id).single()
      .then(({ data }) => {
        if (data) {
          setVereinId(data.verein_id)
          setIstAdministrator(data.ist_administrator || false)
          ladeMannschaften(data.verein_id)
          ladeMeineRollen()
        }
      })
  }, [session])

  const neueMannschaftAnlegen = async (e) => {
    e.preventDefault()
    setFehler(null)
    if (!neuerName.trim()) return
    const { error } = await supabase.from('mannschaften').insert({ verein_id: vereinId, name: neuerName.trim() })
    if (error) { setFehler(error.message); return }
    setNeuerName('')
    ladeMannschaften(vereinId)
  }

  const einladungslinkErzeugen = async (mannschaftId) => {
    const code = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)
    const { error } = await supabase.from('einladungslinks').insert({ mannschaft_id: mannschaftId, code, aktiv: true })
    if (error) { setFehler(error.message); return }
    ladeLinks(mannschaftId)
  }

  const linkKopieren = (code) => {
    const url = `${window.location.origin}/?invite=${code}`
    navigator.clipboard.writeText(url)
    setKopiert(code)
    setTimeout(() => setKopiert(null), 2000)
  }

  const getRolleLabel = (rolle) => {
    switch (rolle) {
      case 'spielfuehrer': return '📋 Spielführer'
      case 'stellvertreter': return '🎗️ Stellv.'
      default: return '🏓 Spieler'
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff' }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 20px 80px', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 20, margin: '8px 0 16px' }}>Mannschaften</h1>

        <form onSubmit={neueMannschaftAnlegen} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input style={inputStyle} placeholder="Name neue Mannschaft (z.B. Herren 1)" value={neuerName} onChange={e => setNeuerName(e.target.value)} />
          <button type="submit" style={buttonStyle}>Anlegen</button>
        </form>
        {fehler && <p style={{ color: '#c0392b', fontSize: 13 }}>{fehler}</p>}

        {mannschaften.map(m => {
          const kaderListe = kader[m.id] || []
          const zeigeAlle = kaderAlleAnzeigen[m.id]
          const sichtbareListe = zeigeAlle ? kaderListe : kaderListe.slice(0, KADER_VORSCHAU_ANZAHL)
          const bearbeitenErlaubt = darfQttrBearbeiten(m.id)

          return (
            <div key={m.id} style={cardStyle}>
              <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{m.name}</div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={smallButtonStyle} onClick={() => einladungslinkErzeugen(m.id)}>+ Einladungslink erzeugen</button>

                {links[m.id] === undefined && (
                  <button style={outlineSmallButtonStyle} onClick={() => ladeLinks(m.id)}>
                    Links anzeigen
                  </button>
                )}

                <button style={outlineSmallButtonStyle} onClick={() => kaderTogglen(m.id)}>
                  {kaderOffen[m.id] ? '👥 Kader ausblenden' : '👥 Kader anzeigen'}
                </button>
              </div>

              {(links[m.id] || []).map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 13 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: l.aktiv ? '#16261F' : '#5B6D66' }}>
                    {l.code} {!l.aktiv && '(inaktiv)'}
                  </span>
                  <button
                    onClick={() => linkKopieren(l.code)}
                    style={{ background: 'none', border: 'none', color: '#1C8A4E', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}
                  >
                    {kopiert === l.code ? '✅ kopiert' : '🔗 Link kopieren'}
                  </button>
                </div>
              ))}

              {kaderOffen[m.id] && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #DCE7E2' }}>
                  {kaderListe.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#5B6D66', margin: 0 }}>Noch keine Spieler zugeordnet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {sichtbareListe.map(mitglied => (
                        <div key={mitglied.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '9px 10px', background: '#F6FAF8', border: '1px solid #DCE7E2', borderRadius: 10
                        }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{mitglied.vorname} {mitglied.nachname}</div>
                            <div style={{ fontSize: 11.5, color: '#5B6D66' }}>{getRolleLabel(mitglied.rolle)}</div>
                          </div>

                          {qttrBearbeitenId === mitglied.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                max="3000"
                                value={qttrEingabe}
                                onChange={e => setQttrEingabe(e.target.value)}
                                style={{ width: 64, padding: '6px 8px', borderRadius: 6, border: '1px solid #DCE7E2', fontSize: 13 }}
                              />
                              <button
                                onClick={() => qttrSpeichern(m.id, mitglied.id)}
                                disabled={qttrSpeichernLaeuft}
                                style={{ background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 6, padding: '6px 9px', fontSize: 12, cursor: 'pointer' }}
                              >
                                {qttrSpeichernLaeuft ? '...' : 'OK'}
                              </button>
                              <button
                                onClick={() => { setQttrBearbeitenId(null); setQttrFehler(null) }}
                                style={{ background: 'none', border: '1px solid #DCE7E2', borderRadius: 6, padding: '6px 9px', fontSize: 12, cursor: 'pointer' }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1C8A4E' }}>{mitglied.qttr ?? '–'}</span>
                              {bearbeitenErlaubt && (
                                <button
                                  onClick={() => qttrBearbeitungStarten(mitglied)}
                                  style={{ background: 'none', border: 'none', color: '#1C8A4E', fontSize: 12, cursor: 'pointer', padding: 0 }}
                                >
                                  ✏️
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {qttrFehler && <p style={{ color: '#c0392b', fontSize: 12, marginTop: 8 }}>{qttrFehler}</p>}

                  {kaderListe.length > KADER_VORSCHAU_ANZAHL && (
                    <button
                      onClick={() => setKaderAlleAnzeigen(prev => ({ ...prev, [m.id]: !zeigeAlle }))}
                      style={{ background: 'none', border: 'none', color: '#5B6D66', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0, marginTop: 10 }}
                    >
                      {zeigeAlle ? '▲ Weniger anzeigen' : `▼ Alle ${kaderListe.length} Spieler anzeigen`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {mannschaften.length === 0 && <p style={{ color: '#5B6D66', fontSize: 14 }}>Noch keine Mannschaften angelegt.</p>}
      </div>

      <BottomNav istAdmin={true} session={session} />
    </div>
  )
}

export default Mannschaften 
