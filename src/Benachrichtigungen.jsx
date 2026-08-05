import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

const pageStyle = {
  minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif',
  color: '#16261F', padding: '20px 16px 90px', maxWidth: 480, margin: '0 auto'
}
const headerStyle = { fontSize: 20, fontWeight: 700, margin: '0 0 16px 0' }
const itemStyle = (gelesen) => ({
  background: gelesen ? '#ffffff' : '#EAF6EF',
  border: '1px solid #DCE7E2',
  borderRadius: 12,
  padding: '14px 16px',
  marginBottom: 10,
  cursor: 'pointer'
})
const titelStyle = { fontSize: 14, fontWeight: 700, margin: '0 0 4px 0' }
const nachrichtStyle = { fontSize: 13, color: '#5B6D66', margin: '0 0 6px 0' }
const zeitStyle = { fontSize: 11, color: '#8AA098', margin: 0 }
const leerStyle = { textAlign: 'center', color: '#5B6D66', fontSize: 14, marginTop: 60 }
const einstellungBoxStyle = {
  background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 12,
  padding: '14px 16px', marginBottom: 20, display: 'flex',
  justifyContent: 'space-between', alignItems: 'center'
}

function relativZeit(datum) {
  const diffMs = Date.now() - new Date(datum).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'gerade eben'
  if (min < 60) return `vor ${min} Min.`
  const std = Math.floor(min / 60)
  if (std < 24) return `vor ${std} Std.`
  const tage = Math.floor(std / 24)
  return `vor ${tage} Tag${tage > 1 ? 'en' : ''}`
}

function Benachrichtigungen({ session }) {
  const [liste, setListe] = useState([])
  const [ladend, setLadend] = useState(true)
  const [einstellungAktiv, setEinstellungAktiv] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!session?.user?.id) return

    const laden = async () => {
      setLadend(true)
      const { data } = await supabase
        .from('benachrichtigungen')
        .select('*')
        .eq('benutzer_id', session.user.id)
        .order('erstellt_am', { ascending: false })
        .limit(50)
      setListe(data || [])

      const { data: einstellung } = await supabase
        .from('benachrichtigungseinstellungen')
        .select('aktiv')
        .eq('benutzer_id', session.user.id)
        .maybeSingle()
      setEinstellungAktiv(einstellung ? einstellung.aktiv : true)
      setLadend(false)
    }
    laden()
  }, [session?.user?.id])

  const handleKlick = async (eintrag) => {
    if (!eintrag.gelesen) {
      await supabase
        .from('benachrichtigungen')
        .update({ gelesen: true })
        .eq('id', eintrag.id)
      setListe(liste.map(e => e.id === eintrag.id ? { ...e, gelesen: true } : e))
    }
    if (eintrag.link) navigate(eintrag.link)
  }

  const handleEinstellungToggle = async () => {
    const neuerWert = !einstellungAktiv
    setEinstellungAktiv(neuerWert)
    await supabase
      .from('benachrichtigungseinstellungen')
      .upsert({ benutzer_id: session.user.id, aktiv: neuerWert })
  }

  return (
    <div style={pageStyle}>
      <h1 style={headerStyle}>Benachrichtigungen</h1>

      <div style={einstellungBoxStyle}>
        <span style={{ fontSize: 14 }}>Benachrichtigungen erhalten</span>
        <input
          type="checkbox"
          checked={einstellungAktiv}
          onChange={handleEinstellungToggle}
          style={{ width: 20, height: 20 }}
        />
      </div>

      {ladend && <p style={leerStyle}>Lädt...</p>}
      {!ladend && liste.length === 0 && <p style={leerStyle}>Noch keine Benachrichtigungen.</p>}
      {!ladend && liste.map(eintrag => (
        <div key={eintrag.id} style={itemStyle(eintrag.gelesen)} onClick={() => handleKlick(eintrag)}>
          <p style={titelStyle}>{eintrag.titel}</p>
          <p style={nachrichtStyle}>{eintrag.nachricht}</p>
          <p style={zeitStyle}>{relativZeit(eintrag.erstellt_am)}</p>
        </div>
      ))}
    </div>
  )
}

export default Benachrichtigungen
