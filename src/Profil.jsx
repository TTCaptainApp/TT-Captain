import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

const toggleRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 0',
  borderBottom: '1px solid #EFEFEF'
}

function Profil({ session }) {
  const navigate = useNavigate()
  const [profilData, setProfilData] = useState(null)
  const [meineMannschaften, setMeineMannschaften] = useState([])
  const [ladend, setLadend] = useState(true)
  const [speichernd, setSpeichernd] = useState(false)
  const [meldung, setMeldung] = useState(null)

  // Benachrichtigungs-States
  const [bAufstellung, setBAufstellung] = useState(true)
  const [bChat, setBChat] = useState(true)
  const [bEmail, setBEmail] = useState(true)

  const datenLaden = async () => {
    setLadend(true)

    // 1. Profil laden
    const { data: bRow } = await supabase
      .from('benutzer')
      .select('id, vorname, nachname, email, ist_administrator, benachrichtigung_aufstellung, benachrichtigung_chat, benachrichtigung_email')
      .eq('id', session.user.id)
      .single()

    if (bRow) {
      setProfilData(bRow)
      setBAufstellung(bRow.benachrichtigung_aufstellung ?? true)
      setBChat(bRow.benachrichtigung_chat ?? true)
      setBEmail(bRow.benachrichtigung_email ?? true)
    }

    // 2. Meine Mannschaften & Rollen laden
    const { data: mData } = await supabase
      .from('mannschaftszuordnungen')
      .select('rolle, mannschaften(name)')
      .eq('benutzer_id', session.user.id)

    setMeineMannschaften(mData || [])
    setLadend(false)
  }

  useEffect(() => {
    datenLaden()
  }, [session])

  const einstellungenSpeichern = async (einstellungen) => {
    setSpeichernd(true)
    const { error } = await supabase
      .from('benutzer')
      .update(einstellungen)
      .eq('id', session.user.id)

    setSpeichernd(false)
    if (error) {
      setMeldung({ typ: 'error', text: error.message })
    } else {
      setMeldung({ typ: 'success', text: 'Einstellungen gespeichert.' })
      setTimeout(() => setMeldung(null), 3000)
    }
  }

  const handleToggle = (key, val, setter) => {
    setter(val)
    einstellungenSpeichern({ [key]: val })
  }

  const abmelden = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const rolleText = (r) => {
    if (r === 'spielfuehrer') return '📋 Spielführer'
    if (r === 'stellvertreter') return '🎗️ Stellv. Spielführer'
    return '🏓 Spieler'
  }

  if (ladend) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff' }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 20px 100px', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 20, margin: '8px 0 16px' }}>👤 Mein Profil</h1>

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

        {/* 1. NUTZERDATEN */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: '#1C8A4E', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700
            }}>
              {profilData?.vorname?.[0]}{profilData?.nachname?.[0]}
            </div>
            <div>
              <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 16 }}>
                {profilData?.vorname} {profilData?.nachname}
              </div>
              <div style={{ fontSize: 12, color: '#5B6D66' }}>{profilData?.email}</div>
              {profilData?.ist_administrator && (
                <span style={{ display: 'inline-block', marginTop: 4, background: '#E8F5E9', color: '#1B5E20', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
                  👑 Administrator
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. MEINE MANNSCHAFTEN */}
        <div style={cardStyle}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, margin: '0 0 10px', color: '#1C8A4E' }}>
            🏓 Meine Mannschaften & Rollen
          </h3>
          {meineMannschaften.length === 0 ? (
            <p style={{ fontSize: 13, color: '#5B6D66', margin: 0 }}>Du bist noch keiner Mannschaft zugewiesen.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {meineMannschaften.map((m, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#F6FAF8', borderRadius: 8, border: '1px solid #DCE7E2' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{m.mannschaften?.name}</span>
                  <span style={{ fontSize: 12, background: '#FFFFFF', padding: '4px 8px', borderRadius: 6, border: '1px solid #DCE7E2', fontWeight: 500 }}>
                    {rolleText(m.rolle)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. BENACHRICHTIGUNGSEINSTELLUNGEN */}
        <div style={cardStyle}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, margin: '0 0 12px' }}>
            🔔 Benachrichtigungen
          </h3>

          <div style={toggleRowStyle}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Neue Aufstellungen</div>
              <div style={{ fontSize: 11, color: '#5B6D66' }}>Benachrichtigen, wenn eine Aufstellung veröffentlicht wird</div>
            </div>
            <input
              type="checkbox"
              checked={bAufstellung}
              onChange={e => handleToggle('benachrichtigung_aufstellung', e.target.checked, setBAufstellung)}
              style={{ width: 18, height: 18, accentColor: '#1C8A4E', cursor: 'pointer' }}
            />
          </div>

          <div style={toggleRowStyle}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Chat-Nachrichten</div>
              <div style={{ fontSize: 11, color: '#5B6D66' }}>Benachrichtigen bei neuen Nachrichten im Team-/Spielchat</div>
            </div>
            <input
              type="checkbox"
              checked={bChat}
              onChange={e => handleToggle('benachrichtigung_chat', e.target.checked, setBChat)}
              style={{ width: 18, height: 18, accentColor: '#1C8A4E', cursor: 'pointer' }}
            />
          </div>

          <div style={{ ...toggleRowStyle, borderBottom: 'none' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>E-Mail Zusammenfassung</div>
              <div style={{ fontSize: 11, color: '#5B6D66' }}>Wichtige Termine und Änderungen per E-Mail erhalten</div>
            </div>
            <input
              type="checkbox"
              checked={bEmail}
              onChange={e => handleToggle('benachrichtigung_email', e.target.checked, setBEmail)}
              style={{ width: 18, height: 18, accentColor: '#1C8A4E', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* 4. ADMIN & ABMELDEN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profilData?.ist_administrator && (
            <Link
              to="/admin"
              style={{
                display: 'block', textAlign: 'center', background: '#FFFFFF', color: '#1C8A4E',
                border: '1px solid #1C8A4E', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, textDecoration: 'none'
              }}
            >
              ⚙️ Zum Adminbereich
            </Link>
          )}

          <button
            onClick={abmelden}
            style={{
              width: '100%', background: '#FDF2F2', color: '#991B1B', border: '1px solid #F87171',
              borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer'
            }}
          >
            🚪 Abmelden
          </button>
        </div>

      </div>

      <BottomNav istAdmin={profilData?.ist_administrator} />
    </div>
  )
}

export default Profil
