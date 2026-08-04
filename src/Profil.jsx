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

  // Profilbearbeitung
  const [bearbeitenModus, setBearbeitenModus] = useState(false)
  const [telefonnummer, setTelefonnummer] = useState('')
  const [profilbildHochladend, setProfilbildHochladend] = useState(false)

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
        setNotifAufstellung(bData?.benachrichtigung_aufstellung ?? true)
        setNotifChat(bData?.benachrichtigung_chat ?? true)
        setNotifEmail(bData?.benachrichtigung_email ?? true)

        // 2. Mannschaften & Rollen des Benutzers abfragen
        const { data: mData } = await supabase
          .from('mannschaftszuordnungen')
          .select('id, rolle, mannschaften(id, name)')
          .eq('benutzer_id', session.user.id)

        setMeineMannschaften(mData || [])

        // Prüfen, ob der Nutzer mindestens in einem Team Spielführer ist
        const hatSpielfuehrerRolle = mData?.some(m => m.rolle === 'spielfuehrer')
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
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
              {profil?.vorname} {profil?.nachname}
            </h2>
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
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{m.mannschaften?.name}</span>
                  <span style={{ fontSize: 12, background: '#FFFFFF', padding: '4px 8px', borderRadius: 6, border: '1px solid #DCE7E2', color: '#5B6D66' }}>
                    {getRolleLabel(m.rolle)}
                  </span>
                </div>
              ))}
            </div>
          )}
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
            color: '#991B1B', fontWeight: 600, fontSize: 14, cursor: 'pointer'
          }}
        >
          🚪 Abmelden
        </button>
      </div>

      <BottomNav />
    </div>
  )
}

export default Profil
