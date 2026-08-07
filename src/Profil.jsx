import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

// ── Design-Tokens (konsistent mit Spiele.jsx / Dashboard.jsx) ───
const C = {
  courtGreen: '#1C8A4E',
  mint: '#EAF6F0',
  bg: '#F6FAF8',
  ink: '#16261F',
  inkMuted: '#5B6D66',
  border: '#DCE7E2',
  danger: '#C0392B',
  dangerBg: '#FEF2F2',
  white: '#FFFFFF'
}
const fontDisplay = 'Sora, sans-serif'
const fontBody = 'Inter, sans-serif'
const fontMono = "'JetBrains Mono', monospace"

const cardStyle = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: '0 1px 2px rgba(22,38,31,0.04)' }
const smallInputStyle = { padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13.5, boxSizing: 'border-box', fontFamily: fontBody }
const iconBtnStyle = { background: 'none', border: 'none', color: C.courtGreen, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 4, minWidth: 32, minHeight: 32 }
const primaryBtnStyle = { background: C.courtGreen, color: C.white, border: 'none', borderRadius: 8, minHeight: 38, padding: '0 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: fontBody }
const ghostBtnStyle = { background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, minHeight: 38, padding: '0 14px', fontSize: 12.5, cursor: 'pointer', fontFamily: fontBody }

function Profil({ session }) {
  const navigate = useNavigate()
  const [profil, setProfil] = useState(null)
  const [meineMannschaften, setMeineMannschaften] = useState([])
  const [istSpielfuehrer, setIstSpielfuehrer] = useState(false)
  const [ladend, setLadend] = useState(true)

  const [notifAufstellung, setNotifAufstellung] = useState(true)
  const [notifChat, setNotifChat] = useState(true)
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifSpieländerung, setNotifSpieländerung] = useState(true)
  const [notifErinnerung, setNotifErinnerung] = useState(true)
  const [notifErsatzanfrage, setNotifErsatzanfrage] = useState(true)

  const [bearbeitenModus, setBearbeitenModus] = useState(false)
  const [telefonnummer, setTelefonnummer] = useState('')
  const [geburtsdatum, setGeburtsdatum] = useState('')
  const [profilbildHochladend, setProfilbildHochladend] = useState(false)

  const [nameBearbeiten, setNameBearbeiten] = useState(false)
  const [vornameEingabe, setVornameEingabe] = useState('')
  const [nachnameEingabe, setNachnameEingabe] = useState('')

  const [hauptmannschaftId, setHauptmannschaftId] = useState(null)
  const [hauptmannschaftSpeichernLaeuft, setHauptmannschaftSpeichernLaeuft] = useState(false)

  const [qttrBearbeiten, setQttrBearbeiten] = useState(false)
  const [qttrEingabe, setQttrEingabe] = useState('')
  const [qttrSpeichernLaeuft, setQttrSpeichernLaeuft] = useState(false)
  const [qttrMeldung, setQttrMeldung] = useState(null)

  const [loeschBestaetigenOffen, setLoeschBestaetigenOffen] = useState(false)
  const [loeschMeldung, setLoeschMeldung] = useState(null)

  useEffect(() => {
    async function profilLaden() {
      try {
        setLadend(true)

        const { data: bData } = await supabase
          .from('benutzer')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        setProfil(bData)
        setTelefonnummer(bData?.telefonnummer || '')
        setGeburtsdatum(bData?.geburtsdatum || '')
        setVornameEingabe(bData?.vorname || '')
        setNachnameEingabe(bData?.nachname || '')
        setQttrEingabe(bData?.qttr?.toString() || '')
        setNotifAufstellung(bData?.benachrichtigung_aufstellung ?? true)
        setNotifChat(bData?.benachrichtigung_chat ?? true)
        setNotifEmail(bData?.benachrichtigung_email ?? true)
        setNotifSpieländerung(bData?.benachrichtigung_spieländerung ?? true)
        setNotifErinnerung(bData?.benachrichtigung_erinnerung ?? true)
        setNotifErsatzanfrage(bData?.benachrichtigung_ersatzanfrage ?? true)

        const { data: mDataRoh } = await supabase
          .from('mannschaftszuordnungen')
          .select('id, rolle, ist_hauptmannschaft, mannschaften(id, name, archiviert)')
          .eq('benutzer_id', session.user.id)

        const mData = (mDataRoh || []).filter(m => m.mannschaften && !m.mannschaften.archiviert)

        setMeineMannschaften(mData)
        setHauptmannschaftId(mData?.find(m => m.ist_hauptmannschaft)?.id || null)

        const hatSpielfuehrerRolle = mData?.some(m => m.rolle === 'spielfuehrer' || m.rolle === 'stellvertreter')
        setIstSpielfuehrer(hatSpielfuehrerRolle)

      } catch (err) {
        console.error('Fehler beim Laden des Profils:', err)
      } finally {
        setLadend(false)
      }
    }

    profilLaden()
  }, [session])

  const abmelden = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const notifAendern = async (feld, wert, setter) => {
    setter(wert)
    await supabase.from('benutzer').update({ [feld]: wert }).eq('id', session.user.id)
  }

  const kontaktdatenSpeichern = async () => {
    await supabase.from('benutzer').update({
      telefonnummer: telefonnummer.trim() || null,
      geburtsdatum: geburtsdatum || null
    }).eq('id', session.user.id)

    setProfil(prev => ({
      ...prev,
      telefonnummer: telefonnummer.trim() || null,
      geburtsdatum: geburtsdatum || null
    }))
    setBearbeitenModus(false)
  }

  const profilbildHochladen = async (e) => {
    const datei = e.target.files[0]
    if (!datei) return
    setProfilbildHochladend(true)
    const dateiPfad = `${session.user.id}/${Date.now()}_${datei.name}`
    const { error: uploadError } = await supabase.storage.from('profilbilder').upload(dateiPfad, datei)
    if (uploadError) { setProfilbildHochladend(false); return }
    const { data: urlData } = supabase.storage.from('profilbilder').getPublicUrl(dateiPfad)
    await supabase.from('benutzer').update({ profilbild_url: urlData.publicUrl }).eq('id', session.user.id)
    setProfil(prev => ({ ...prev, profilbild_url: urlData.publicUrl }))
    setProfilbildHochladend(false)
  }

  const nameSpeichern = async () => {
    if (!vornameEingabe.trim() || !nachnameEingabe.trim()) return
    await supabase.from('benutzer').update({ vorname: vornameEingabe.trim(), nachname: nachnameEingabe.trim() }).eq('id', session.user.id)
    setProfil(prev => ({ ...prev, vorname: vornameEingabe.trim(), nachname: nachnameEingabe.trim() }))
    setNameBearbeiten(false)
  }

  const hauptmannschaftAendern = async (zuordnungId) => {
    setHauptmannschaftSpeichernLaeuft(true)
    await supabase.from('mannschaftszuordnungen').update({ ist_hauptmannschaft: false }).eq('benutzer_id', session.user.id)
    await supabase.from('mannschaftszuordnungen').update({ ist_hauptmannschaft: true }).eq('id', zuordnungId)
    setHauptmannschaftId(zuordnungId)
    setHauptmannschaftSpeichernLaeuft(false)
  }

  const qttrSpeichern = async () => {
    setQttrMeldung(null)
    const wert = parseInt(qttrEingabe, 10)

    if (isNaN(wert) || wert < 0 || wert > 3000) {
      setQttrMeldung({ typ: 'error', text: 'Bitte einen gültigen QTTR-Wert eingeben (0–3000).' })
      return
    }

    setQttrSpeichernLaeuft(true)

    const { error: updateError } = await supabase
      .from('benutzer')
      .update({ qttr: wert })
      .eq('id', session.user.id)

    if (updateError) {
      setQttrMeldung({ typ: 'error', text: updateError.message })
      setQttrSpeichernLaeuft(false)
      return
    }

    await supabase.from('qttr_verlauf').insert({
      benutzer_id: session.user.id,
      qttr_wert: wert,
      gueltig_ab: new Date().toISOString().slice(0, 10),
      quelle: 'manuell'
    })

    setProfil(prev => ({ ...prev, qttr: wert }))
    setQttrBearbeiten(false)
    setQttrSpeichernLaeuft(false)
    setQttrMeldung({ typ: 'success', text: 'QTTR-Wert gespeichert.' })
  }

  const kontoLoeschungBeantragen = async () => {
    setLoeschMeldung(null)
    const { error } = await supabase
      .from('benutzer')
      .update({ loeschung_beantragt: true, loeschung_beantragt_am: new Date().toISOString() })
      .eq('id', session.user.id)
    if (error) {
      setLoeschMeldung({ typ: 'error', text: error.message })
    } else {
      setProfil(prev => ({ ...prev, loeschung_beantragt: true }))
      setLoeschMeldung({ typ: 'success', text: 'Löschantrag wurde übermittelt. Ein Administrator wird dein Konto in Kürze löschen.' })
    }
    setLoeschBestaetigenOffen(false)
  }

  const getRolleLabel = (rolle) => {
    switch (rolle) {
      case 'spielfuehrer': return '📋 Spielführer'
      case 'stellvertreter': return '🎗️ Stellv. Spielführer'
      default: return '🏓 Spieler'
    }
  }

  const getInitials = () => {
    if (!profil?.vorname && !profil?.nachname) return '👤'
    return `${profil?.vorname?.[0] || ''}${profil?.nachname?.[0] || ''}`.toUpperCase()
  }

  const datumFormatieren = (datumStr) => {
    if (!datumStr) return ''
    const parts = datumStr.split('-')
    if (parts.length !== 3) return datumStr
    return `${parts[2]}.${parts[1]}.${parts[0]}`
  }

  if (ladend) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: fontBody, color: C.courtGreen }}>
        Laden...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: fontBody, color: C.ink }}>
      <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, background: C.white }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 16px 100px', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 21, margin: '8px 0 16px' }}>
          👤 Mein Profil
        </h1>

        {/* PROFIL KOPF */}
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <label style={{ cursor: 'pointer', flexShrink: 0 }}>
            {profil?.profilbild_url ? (
              <img src={profil.profilbild_url} alt="Profilbild" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: C.courtGreen, color: C.white,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 19, fontFamily: fontDisplay
              }}>
                {getInitials()}
              </div>
            )}
            <input type="file" accept="image/*" onChange={profilbildHochladen} style={{ display: 'none' }} disabled={profilbildHochladend} />
          </label>

          <div style={{ flex: 1, minWidth: 0 }}>
            {nameBearbeiten ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
                <input
                  type="text"
                  value={vornameEingabe}
                  onChange={e => setVornameEingabe(e.target.value)}
                  placeholder="Vorname"
                  style={smallInputStyle}
                />
                <input
                  type="text"
                  value={nachnameEingabe}
                  onChange={e => setNachnameEingabe(e.target.value)}
                  placeholder="Nachname"
                  style={smallInputStyle}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={nameSpeichern} style={primaryBtnStyle}>Speichern</button>
                  <button onClick={() => setNameBearbeiten(false)} style={ghostBtnStyle}>Abbrechen</button>
                </div>
              </div>
            ) : (
              <h2 style={{ fontFamily: fontDisplay, fontSize: 17, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                {profil?.vorname} {profil?.nachname}
                <button onClick={() => setNameBearbeiten(true)} style={iconBtnStyle}>✏️</button>
              </h2>
            )}

            <p style={{ margin: '2px 0 8px', fontSize: 13, color: C.inkMuted, wordBreak: 'break-word' }}>
              {session?.user?.email}
            </p>

            {bearbeitenModus ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6, background: C.bg, padding: 12, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.inkMuted, display: 'block', marginBottom: 3 }}>Telefonnummer</label>
                  <input
                    type="tel"
                    value={telefonnummer}
                    onChange={e => setTelefonnummer(e.target.value)}
                    placeholder="Telefonnummer"
                    style={{ ...smallInputStyle, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.inkMuted, display: 'block', marginBottom: 3 }}>Geburtsdatum</label>
                  <input
                    type="date"
                    value={geburtsdatum}
                    onChange={e => setGeburtsdatum(e.target.value)}
                    style={{ ...smallInputStyle, width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <button onClick={kontaktdatenSpeichern} style={primaryBtnStyle}>Speichern</button>
                  <button onClick={() => setBearbeitenModus(false)} style={ghostBtnStyle}>Abbrechen</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ margin: 0, fontSize: 13, color: C.inkMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                  📞 {profil?.telefonnummer || 'Keine Telefonnummer hinterlegt'}
                  <button onClick={() => setBearbeitenModus(true)} style={iconBtnStyle}>✏️</button>
                </p>
                <p style={{ margin: 0, fontSize: 13, color: C.inkMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                  🎂 {profil?.geburtsdatum ? datumFormatieren(profil.geburtsdatum) : 'Kein Geburtsdatum hinterlegt'}
                  <button onClick={() => setBearbeitenModus(true)} style={iconBtnStyle}>✏️</button>
                </p>
              </div>
            )}

            {profil?.ist_administrator && (
              <span style={{ display: 'inline-block', marginTop: 10, fontSize: 11, background: C.mint, color: C.courtGreen, padding: '3px 10px', borderRadius: 12, fontWeight: 700 }}>
                👑 Administrator
              </span>
            )}
          </div>
        </div>

        {/* MANNSCHAFTEN */}
        <div style={cardStyle}>
          <h3 style={{ fontFamily: fontDisplay, fontSize: 15, margin: '0 0 12px', color: C.courtGreen }}>
            🏓 Meine Mannschaften & Rollen
          </h3>
          {meineMannschaften.length === 0 ? (
            <p style={{ fontSize: 13, color: C.inkMuted, margin: 0 }}>Keine Zuordnung vorhanden.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {meineMannschaften.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, minHeight: 48 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="hauptmannschaft"
                      checked={hauptmannschaftId === m.id}
                      onChange={() => hauptmannschaftAendern(m.id)}
                      disabled={hauptmannschaftSpeichernLaeuft}
                      style={{ accentColor: C.courtGreen, width: 18, height: 18 }}
                    />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {m.mannschaften?.name}
                      {hauptmannschaftId === m.id && <span style={{ marginLeft: 6, fontSize: 11, color: C.courtGreen }}>★ Haupt</span>}
                    </span>
                  </label>
                  <span style={{ fontSize: 11.5, background: C.white, padding: '4px 9px', borderRadius: 6, border: `1px solid ${C.border}`, color: C.inkMuted }}>
                    {getRolleLabel(m.rolle)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* QTTR-BEREICH */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: qttrBearbeiten ? 10 : 0 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>🎯 QTTR-Wert</div>
                <div style={{ fontSize: 11, color: C.inkMuted }}>Aktuelle Spielstärke laut myTischtennis.de</div>
              </div>
              {!qttrBearbeiten && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: fontMono, fontSize: 18, fontWeight: 700, color: C.courtGreen }}>
                    {profil?.qttr ?? '–'}
                  </span>
                  <button onClick={() => setQttrBearbeiten(true)} style={iconBtnStyle}>✏️</button>
                </div>
              )}
            </div>

            {qttrBearbeiten && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="3000"
                    value={qttrEingabe}
                    onChange={e => setQttrEingabe(e.target.value)}
                    placeholder="z.B. 1450"
                    style={{ flex: 1, minHeight: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14.5, boxSizing: 'border-box', fontFamily: fontMono }}
                  />
                  <button
                    onClick={qttrSpeichern}
                    disabled={qttrSpeichernLaeuft}
                    style={{ background: C.courtGreen, color: C.white, border: 'none', borderRadius: 10, minHeight: 40, padding: '0 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {qttrSpeichernLaeuft ? '...' : 'Speichern'}
                  </button>
                  <button
                    onClick={() => { setQttrBearbeiten(false); setQttrEingabe(profil?.qttr?.toString() || '') }}
                    style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, minHeight: 40, padding: '0 14px', fontSize: 13.5, cursor: 'pointer' }}
                  >
                    Abbrechen
                  </button>
                </div>

                <button
                  disabled
                  title="Kommt in Kürze"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: C.bg, color: '#9AAAA3', border: `1px dashed ${C.border}`,
                    borderRadius: 10, minHeight: 38, padding: '0 14px', fontSize: 12.5, fontWeight: 600, cursor: 'not-allowed'
                  }}
                >
                  🔄 Automatisch von myTischtennis.de importieren (bald verfügbar)
                </button>
              </div>
            )}

            {qttrMeldung && (
              <p style={{ fontSize: 12.5, margin: '10px 0 0', color: qttrMeldung.typ === 'error' ? C.danger : C.courtGreen }}>
                {qttrMeldung.text}
              </p>
            )}
          </div>
        </div>

        {/* BENACHRICHTIGUNGEN */}
        <div style={cardStyle}>
          <h3 style={{ fontFamily: fontDisplay, fontSize: 15, margin: '0 0 14px' }}>
            🔔 Benachrichtigungen
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', minHeight: 40 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Neue Aufstellungen</div>
                <div style={{ fontSize: 11.5, color: C.inkMuted }}>Benachrichtigen, wenn eine Aufstellung veröffentlicht wird</div>
              </div>
              <input type="checkbox" checked={notifAufstellung} onChange={e => notifAendern('benachrichtigung_aufstellung', e.target.checked, setNotifAufstellung)} style={{ accentColor: C.courtGreen, width: 20, height: 20, flexShrink: 0 }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', minHeight: 40 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Chat-Nachrichten</div>
                <div style={{ fontSize: 11.5, color: C.inkMuted }}>Benachrichtigen bei neuen Nachrichten im Team-/Spielchat</div>
              </div>
              <input type="checkbox" checked={notifChat} onChange={e => notifAendern('benachrichtigung_chat', e.target.checked, setNotifChat)} style={{ accentColor: C.courtGreen, width: 20, height: 20, flexShrink: 0 }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', minHeight: 40 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Spieländerungen</div>
                <div style={{ fontSize: 11.5, color: C.inkMuted }}>Benachrichtigen bei Änderung von Zeit, Ort oder Status eines Spiels</div>
              </div>
              <input type="checkbox" checked={notifSpieländerung} onChange={e => notifAendern('benachrichtigung_spieländerung', e.target.checked, setNotifSpieländerung)} style={{ accentColor: C.courtGreen, width: 20, height: 20, flexShrink: 0 }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', minHeight: 40 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Verfügbarkeits-Erinnerung</div>
                <div style={{ fontSize: 11.5, color: C.inkMuted }}>Erinnern, wenn noch keine Rückmeldung zu einem nahenden Spiel vorliegt</div>
              </div>
              <input type="checkbox" checked={notifErinnerung} onChange={e => notifAendern('benachrichtigung_erinnerung', e.target.checked, setNotifErinnerung)} style={{ accentColor: C.courtGreen, width: 20, height: 20, flexShrink: 0 }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', minHeight: 40 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Ersatzspieler-Anfragen</div>
                <div style={{ fontSize: 11.5, color: C.inkMuted }}>Benachrichtigen, wenn du als Ersatz angefragt wirst</div>
              </div>
              <input type="checkbox" checked={notifErsatzanfrage} onChange={e => notifAendern('benachrichtigung_ersatzanfrage', e.target.checked, setNotifErsatzanfrage)} style={{ accentColor: C.courtGreen, width: 20, height: 20, flexShrink: 0 }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', minHeight: 40 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>E-Mail Zusammenfassung</div>
                <div style={{ fontSize: 11.5, color: C.inkMuted }}>Wichtige Termine und Änderungen per E-Mail erhalten</div>
              </div>
              <input type="checkbox" checked={notifEmail} onChange={e => notifAendern('benachrichtigung_email', e.target.checked, setNotifEmail)} style={{ accentColor: C.courtGreen, width: 20, height: 20, flexShrink: 0 }} />
            </label>
          </div>
        </div>

        {/* BUTTON: ADMIN-/TEAMVERWALTUNG */}
        {(profil?.ist_administrator || istSpielfuehrer) && (
          <button
            onClick={() => navigate('/admin')}
            style={{
              width: '100%', minHeight: 50, borderRadius: 12, border: `1.5px solid ${C.courtGreen}`, background: C.white,
              color: C.courtGreen, fontWeight: 700, fontSize: 14.5, cursor: 'pointer', marginBottom: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: fontBody
            }}
          >
            ⚙️ {profil?.ist_administrator ? 'Zum Adminbereich' : 'Zur Teamverwaltung'}
          </button>
        )}

        {/* ABMELDEN */}
        <button
          onClick={abmelden}
          style={{
            width: '100%', minHeight: 50, borderRadius: 12, border: '1.5px solid #F87171', background: C.dangerBg,
            color: '#991B1B', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', marginBottom: 20, fontFamily: fontBody
          }}
        >
          🚪 Abmelden
        </button>

        {/* GEFAHRENZONE: KONTO LÖSCHEN */}
        <div style={{ border: '1px dashed #F87171', borderRadius: 16, padding: 16, marginBottom: 24 }}>
          <h3 style={{ fontFamily: fontDisplay, fontSize: 13, margin: '0 0 8px', color: '#991B1B' }}>
            ⚠️ Gefahrenzone
          </h3>
          {profil?.loeschung_beantragt ? (
            <p style={{ fontSize: 13, color: C.inkMuted, margin: 0 }}>
              Löschantrag wurde bereits übermittelt. Ein Administrator kümmert sich darum.
            </p>
          ) : loeschBestaetigenOffen ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 13, color: C.inkMuted, margin: 0 }}>
                Bist du sicher? Dein Konto wird dann von einem Administrator dauerhaft gelöscht.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={kontoLoeschungBeantragen} style={{ background: '#991B1B', color: C.white, border: 'none', borderRadius: 10, minHeight: 42, padding: '0 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                  Ja, endgültig beantragen
                </button>
                <button onClick={() => setLoeschBestaetigenOffen(false)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, minHeight: 42, padding: '0 16px', fontSize: 13.5, cursor: 'pointer' }}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setLoeschBestaetigenOffen(true)} style={{ background: 'none', border: '1px solid #F87171', color: '#991B1B', borderRadius: 10, minHeight: 42, padding: '0 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
              Konto-Löschung beantragen
            </button>
          )}
          {loeschMeldung && (
            <p style={{ fontSize: 12.5, margin: '10px 0 0', color: loeschMeldung.typ === 'error' ? C.danger : C.courtGreen }}>{loeschMeldung.text}</p>
          )}
        </div>

        {/* RECHTLICHES (DSGVO) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 14px', paddingTop: 4 }}>
          <a href="/impressum.html" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.inkMuted, textDecoration: 'underline' }}>
            Impressum
          </a>
          <a href="/datenschutz.html" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.inkMuted, textDecoration: 'underline' }}>
            Datenschutz
          </a>
          <a href="/nutzungsbedingungen.html" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.inkMuted, textDecoration: 'underline' }}>
            Nutzungsbedingungen
          </a>
        </div>
      </div>

      <BottomNav session={session} />
    </div>
  )
}

export default Profil
