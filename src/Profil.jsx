import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

function Profil({ session }) {
  const navigate = useNavigate()
  const [profil, setProfil] = useState(null)
  const [meineMannschaften, setMeineMannschaften] = useState([])
  const [istSpielfuehrer, setIstSpielfuehrer] = useState(false)
  const [ladend, setLadend] = useState(true)

  // Benachrichtigungseinstellungen
  const [notifAufstellung, setNotifAufstellung] = useState(true)
  const [notifChat, setNotifChat] = useState(true)
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifSpieländerung, setNotifSpieländerung] = useState(true)
  const [notifErinnerung, setNotifErinnerung] = useState(true)
  const [notifErsatzanfrage, setNotifErsatzanfrage] = useState(true)

  // Profilbearbeitung
  const [bearbeitenModus, setBearbeitenModus] = useState(false)
  const [telefonnummer, setTelefonnummer] = useState('')
  const [profilbildHochladend, setProfilbildHochladend] = useState(false)

  // Name ändern
  const [nameBearbeiten, setNameBearbeiten] = useState(false)
  const [vornameEingabe, setVornameEingabe] = useState('')
  const [nachnameEingabe, setNachnameEingabe] = useState('')

  // Passwort ändern
  const [neuesPasswort, setNeuesPasswort] = useState('')
  const [neuesPasswortWiederholen, setNeuesPasswortWiederholen] = useState('')
  const [passwortMeldung, setPasswortMeldung] = useState(null)

  // E-Mail ändern
  const [neueEmail, setNeueEmail] = useState('')
  const [emailMeldung, setEmailMeldung] = useState(null)

  // Hauptmannschaft
  const [hauptmannschaftId, setHauptmannschaftId] = useState(null)
  const [hauptmannschaftSpeichernLaeuft, setHauptmannschaftSpeichernLaeuft] = useState(false)

  // QTTR
  const [qttrBearbeiten, setQttrBearbeiten] = useState(false)
  const [qttrEingabe, setQttrEingabe] = useState('')
  const [qttrSpeichernLaeuft, setQttrSpeichernLaeuft] = useState(false)
  const [qttrMeldung, setQttrMeldung] = useState(null)

  // Konto löschen
  const [loeschBestaetigenOffen, setLoeschBestaetigenOffen] = useState(false)
  const [loeschMeldung, setLoeschMeldung] = useState(null)

  useEffect(() => {
    async function profilLaden() {
      try {
        setLadend(true)

        // 1. Benutzerdaten aus DB abfragen
        const { data: bData } = await supabase
          .from('benutzer')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        setProfil(bData)
        setTelefonnummer(bData?.telefonnummer || '')
        setVornameEingabe(bData?.vorname || '')
        setNachnameEingabe(bData?.nachname || '')
        setQttrEingabe(bData?.qttr?.toString() || '')
        setNotifAufstellung(bData?.benachrichtigung_aufstellung ?? true)
        setNotifChat(bData?.benachrichtigung_chat ?? true)
        setNotifEmail(bData?.benachrichtigung_email ?? true)
        setNotifSpieländerung(bData?.benachrichtigung_spieländerung ?? true)
        setNotifErinnerung(bData?.benachrichtigung_erinnerung ?? true)
        setNotifErsatzanfrage(bData?.benachrichtigung_ersatzanfrage ?? true)

        // 2. Mannschaften & Rollen des Benutzers abfragen (archivierte ausblenden)
        const { data: mDataRoh } = await supabase
          .from('mannschaftszuordnungen')
          .select('id, rolle, ist_hauptmannschaft, mannschaften(id, name, archiviert)')
          .eq('benutzer_id', session.user.id)

        const mData = (mDataRoh || []).filter(m => m.mannschaften && !m.mannschaften.archiviert)

        setMeineMannschaften(mData)
        setHauptmannschaftId(mData?.find(m => m.ist_hauptmannschaft)?.id || null)

        // Prüfen, ob der Nutzer mindestens in einem (nicht-archivierten) Team Spielführer/Stellv. ist
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

  const telefonSpeichern = async () => {
    await supabase.from('benutzer').update({ telefonnummer }).eq('id', session.user.id)
    setProfil(prev => ({ ...prev, telefonnummer }))
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

  const passwortAendern = async (e) => {
    e.preventDefault()
    setPasswortMeldung(null)
    if (neuesPasswort.length < 6) {
      setPasswortMeldung({ typ: 'error', text: 'Das Passwort muss mindestens 6 Zeichen haben.' })
      return
    }
    if (neuesPasswort !== neuesPasswortWiederholen) {
      setPasswortMeldung({ typ: 'error', text: 'Die Passwörter stimmen nicht überein.' })
      return
    }
    const { error } = await supabase.auth.updateUser({ password: neuesPasswort })
    if (error) {
      setPasswortMeldung({ typ: 'error', text: error.message })
    } else {
      setPasswortMeldung({ typ: 'success', text: 'Passwort erfolgreich geändert.' })
      setNeuesPasswort('')
      setNeuesPasswortWiederholen('')
    }
  }

  const emailAendern = async (e) => {
    e.preventDefault()
    setEmailMeldung(null)
    if (!neueEmail.trim() || !neueEmail.includes('@')) {
      setEmailMeldung({ typ: 'error', text: 'Bitte eine gültige E-Mail-Adresse eingeben.' })
      return
    }
    const { error } = await supabase.auth.updateUser({ email: neueEmail.trim() })
    if (error) {
      setEmailMeldung({ typ: 'error', text: error.message })
    } else {
      setEmailMeldung({ typ: 'success', text: 'Bestätigungslink wurde an die neue Adresse gesendet. Die Änderung wird erst nach Bestätigung aktiv.' })
      setNeueEmail('')
    }
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

    // Verlauf mitschreiben
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

  if (ladend) {
    return (
      <div style={{ minHeight: '100vh', background: '#F6FAF8', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif', color: '#1C8A4E' }}>
        Laden...
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
          👤 Mein Profil
        </h1>

        {/* PROFIL KOPF */}
        <div style={{ background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <label style={{ cursor: 'pointer' }}>
            {profil?.profilbild_url ? (
              <img src={profil.profilbild_url} alt="Profilbild" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: 52, height: 52, borderRadius: '50%', background: '#1C8A4E', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18
              }}>
                {getInitials()}
              </div>
            )}
            <input type="file" accept="image/*" onChange={profilbildHochladen} style={{ display: 'none' }} disabled={profilbildHochladend} />
          </label>
          <div style={{ flex: 1 }}>
            {nameBearbeiten ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
                <input
                  type="text"
                  value={vornameEingabe}
                  onChange={e => setVornameEingabe(e.target.value)}
                  placeholder="Vorname"
                  style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #DCE7E2', fontSize: 13 }}
                />
                <input
                  type="text"
                  value={nachnameEingabe}
                  onChange={e => setNachnameEingabe(e.target.value)}
                  placeholder="Nachname"
                  style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #DCE7E2', fontSize: 13 }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={nameSpeichern} style={{ background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>Speichern</button>
                  <button onClick={() => setNameBearbeiten(false)} style={{ background: 'none', border: '1px solid #DCE7E2', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>Abbrechen</button>
                </div>
              </div>
            ) : (
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                {profil?.vorname} {profil?.nachname}{' '}
                <button onClick={() => setNameBearbeiten(true)} style={{ background: 'none', border: 'none', color: '#1C8A4E', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>✏️</button>
              </h2>
            )}
            <p style={{ margin: '2px 0 4px', fontSize: 13, color: '#5B6D66' }}>
              {session?.user?.email}
            </p>
            {bearbeitenModus ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  type="tel"
                  value={telefonnummer}
                  onChange={e => setTelefonnummer(e.target.value)}
                  placeholder="Telefonnummer"
                  style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #DCE7E2', fontSize: 13 }}
                />
                <button onClick={telefonSpeichern} style={{ background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>OK</button>
              </div>
            ) : (
              <p style={{ margin: '0 0 4px', fontSize: 13, color: '#5B6D66' }}>
                📞 {profil?.telefonnummer || 'Keine Telefonnummer hinterlegt'}{' '}
                <button onClick={() => setBearbeitenModus(true)} style={{ background: 'none', border: 'none', color: '#1C8A4E', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>✏️</button>
              </p>
            )}
            {profil?.ist_administrator && (
              <span style={{ fontSize: 11, background: '#E8F5E9', color: '#1C8A4E', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                👑 Administrator
              </span>
            )}
          </div>
        </div>

        {/* MANNSCHAFTEN */}
        <div style={{ background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, margin: '0 0 12px', color: '#1C8A4E' }}>
            🏓 Meine Mannschaften & Rollen
          </h3>
          {meineMannschaften.length === 0 ? (
            <p style={{ fontSize: 13, color: '#5B6D66', margin: 0 }}>Keine Zuordnung vorhanden.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {meineMannschaften.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F6FAF8', border: '1px solid #DCE7E2', borderRadius: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="hauptmannschaft"
                      checked={hauptmannschaftId === m.id}
                      onChange={() => hauptmannschaftAendern(m.id)}
                      disabled={hauptmannschaftSpeichernLaeuft}
                      style={{ accentColor: '#1C8A4E' }}
                    />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {m.mannschaften?.name}
                      {hauptmannschaftId === m.id && <span style={{ marginLeft: 6, fontSize: 11, color: '#1C8A4E' }}>★ Haupt</span>}
                    </span>
                  </label>
                  <span style={{ fontSize: 12, background: '#FFFFFF', padding: '4px 8px', borderRadius: 6, border: '1px solid #DCE7E2', color: '#5B6D66' }}>
                    {getRolleLabel(m.rolle)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* QTTR-BEREICH */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #DCE7E2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: qttrBearbeiten ? 10 : 0 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#16261F' }}>🎯 QTTR-Wert</div>
                <div style={{ fontSize: 11, color: '#5B6D66' }}>Aktuelle Spielstärke laut myTischtennis.de</div>
              </div>
              {!qttrBearbeiten && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#1C8A4E' }}>
                    {profil?.qttr ?? '–'}
                  </span>
                  <button
                    onClick={() => setQttrBearbeiten(true)}
                    style={{ background: 'none', border: 'none', color: '#1C8A4E', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    ✏️
                  </button>
                </div>
              )}
            </div>

            {qttrBearbeiten && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="3000"
                    value={qttrEingabe}
                    onChange={e => setQttrEingabe(e.target.value)}
                    placeholder="z.B. 1450"
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #DCE7E2', fontSize: 14 }}
                  />
                  <button
                    onClick={qttrSpeichern}
                    disabled={qttrSpeichernLaeuft}
                    style={{ background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {qttrSpeichernLaeuft ? '...' : 'Speichern'}
                  </button>
                  <button
                    onClick={() => { setQttrBearbeiten(false); setQttrEingabe(profil?.qttr?.toString() || '') }}
                    style={{ background: 'none', border: '1px solid #DCE7E2', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}
                  >
                    Abbrechen
                  </button>
                </div>

                {/* Auto-Import Platzhalter — folgt in einer der nächsten Versionen */}
                <button
                  disabled
                  title="Kommt in Kürze"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: '#F6FAF8', color: '#9AAAA3', border: '1px dashed #DCE7E2',
                    borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'not-allowed'
                  }}
                >
                  🔄 Automatisch von myTischtennis.de importieren (bald verfügbar)
                </button>
              </div>
            )}

            {qttrMeldung && (
              <p style={{ fontSize: 12, margin: '8px 0 0', color: qttrMeldung.typ === 'error' ? '#c0392b' : '#1C8A4E' }}>
                {qttrMeldung.text}
              </p>
            )}
          </div>
        </div>

        {/* BENACHRICHTIGUNGEN */}
        <div style={{ background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 16, marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, margin: '0 0 12px', color: '#16261F' }}>
            🔔 Benachrichtigungen
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Neue Aufstellungen</div>
                <div style={{ fontSize: 11, color: '#5B6D66' }}>Benachrichtigen, wenn eine Aufstellung veröffentlicht wird</div>
              </div>
              <input type="checkbox" checked={notifAufstellung} onChange={e => notifAendern('benachrichtigung_aufstellung', e.target.checked, setNotifAufstellung)} style={{ accentColor: '#1C8A4E', width: 18, height: 18 }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Chat-Nachrichten</div>
                <div style={{ fontSize: 11, color: '#5B6D66' }}>Benachrichtigen bei neuen Nachrichten im Team-/Spielchat</div>
              </div>
              <input type="checkbox" checked={notifChat} onChange={e => notifAendern('benachrichtigung_chat', e.target.checked, setNotifChat)} style={{ accentColor: '#1C8A4E', width: 18, height: 18 }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Spieländerungen</div>
                <div style={{ fontSize: 11, color: '#5B6D66' }}>Benachrichtigen bei Änderung von Zeit, Ort oder Status eines Spiels</div>
              </div>
              <input type="checkbox" checked={notifSpieländerung} onChange={e => notifAendern('benachrichtigung_spieländerung', e.target.checked, setNotifSpieländerung)} style={{ accentColor: '#1C8A4E', width: 18, height: 18 }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Verfügbarkeits-Erinnerung</div>
                <div style={{ fontSize: 11, color: '#5B6D66' }}>Erinnern, wenn noch keine Rückmeldung zu einem nahenden Spiel vorliegt</div>
              </div>
              <input type="checkbox" checked={notifErinnerung} onChange={e => notifAendern('benachrichtigung_erinnerung', e.target.checked, setNotifErinnerung)} style={{ accentColor: '#1C8A4E', width: 18, height: 18 }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Ersatzspieler-Anfragen</div>
                <div style={{ fontSize: 11, color: '#5B6D66' }}>Benachrichtigen, wenn du als Ersatz angefragt wirst</div>
              </div>
              <input type="checkbox" checked={notifErsatzanfrage} onChange={e => notifAendern('benachrichtigung_ersatzanfrage', e.target.checked, setNotifErsatzanfrage)} style={{ accentColor: '#1C8A4E', width: 18, height: 18 }} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>E-Mail Zusammenfassung</div>
                <div style={{ fontSize: 11, color: '#5B6D66' }}>Wichtige Termine und Änderungen per E-Mail erhalten</div>
              </div>
              <input type="checkbox" checked={notifEmail} onChange={e => notifAendern('benachrichtigung_email', e.target.checked, setNotifEmail)} style={{ accentColor: '#1C8A4E', width: 18, height: 18 }} />
            </label>
          </div>
        </div>

        {/* BUTTON: ADMIN-/TEAMVERWALTUNG */}
        {(profil?.ist_administrator || istSpielfuehrer) && (
          <button
            onClick={() => navigate('/admin')}
            style={{
              width: '100%', padding: 14, borderRadius: 12, border: '1px solid #1C8A4E', background: '#ffffff',
              color: '#1C8A4E', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            ⚙️ {profil?.ist_administrator ? 'Zum Adminbereich' : 'Zur Teamverwaltung'}
          </button>
        )}

        {/* ABMELDEN */}
        <button
          onClick={abmelden}
          style={{
            width: '100%', padding: 14, borderRadius: 12, border: '1px solid #F87171', background: '#FEF2F2',
            color: '#991B1B', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 20
          }}
        >
          🚪 Abmelden
        </button>

        {/* GEFAHRENZONE: KONTO LÖSCHEN */}
        <div style={{ border: '1px dashed #F87171', borderRadius: 14, padding: 16 }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 13, margin: '0 0 8px', color: '#991B1B' }}>
            ⚠️ Gefahrenzone
          </h3>
          {profil?.loeschung_beantragt ? (
            <p style={{ fontSize: 13, color: '#5B6D66', margin: 0 }}>
              Löschantrag wurde bereits übermittelt. Ein Administrator kümmert sich darum.
            </p>
          ) : loeschBestaetigenOffen ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 13, color: '#5B6D66', margin: 0 }}>
                Bist du sicher? Dein Konto wird dann von einem Administrator dauerhaft gelöscht.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={kontoLoeschungBeantragen} style={{ background: '#991B1B', color: 'white', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Ja, endgültig beantragen
                </button>
                <button onClick={() => setLoeschBestaetigenOffen(false)} style={{ background: 'none', border: '1px solid #DCE7E2', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setLoeschBestaetigenOffen(true)} style={{ background: 'none', border: '1px solid #F87171', color: '#991B1B', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Konto-Löschung beantragen
            </button>
          )}
          {loeschMeldung && (
            <p style={{ fontSize: 12.5, margin: '8px 0 0', color: loeschMeldung.typ === 'error' ? '#c0392b' : '#1C8A4E' }}>{loeschMeldung.text}</p>
          )}
        </div>
      </div>

      <BottomNav session={session} />
    </div>
  )
}

export default Profil
