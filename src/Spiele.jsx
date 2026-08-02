import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'

const cardStyle = { background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 14, marginBottom: 10 }
const inputStyle = { padding: '9px 10px', fontSize: 14, borderRadius: 8, border: '1px solid #DCE7E2', fontFamily: 'inherit', width: '100%' }
const buttonStyle = { background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }

const statusFarbe = {
  geplant: '#1C8A4E',
  verlegt: '#d4a017',
  abgesagt: '#c0392b',
  gespielt: '#5B6D66'
}

function Spiele({ session }) {
  const [meineMannschaften, setMeineMannschaften] = useState([]) // {mannschaft_id, name, rolle}
  const [spiele, setSpiele] = useState([])
  const [formOffen, setFormOffen] = useState(false)
  const [mannschaftId, setMannschaftId] = useState('')
  const [gegner, setGegner] = useState('')
  const [heimAuswaerts, setHeimAuswaerts] = useState('heim')
  const [datum, setDatum] = useState('')
  const [uhrzeit, setUhrzeit] = useState('')
  const [halle, setHalle] = useState('')
  const [fehler, setFehler] = useState(null)

  const ladeSpiele = async () => {
    const { data } = await supabase
      .from('spiele')
      .select('id, gegner, heim_oder_auswaerts, datum, uhrzeit, halle, status, mannschaften(name)')
      .order('datum')
    setSpiele(data || [])
  }

  useEffect(() => {
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
  }, [session])

  const kannSpielAnlegen = meineMannschaften.some(m => m.rolle === 'spielfuehrer' || m.rolle === 'stellvertreter')

  const spielAnlegen = async (e) => {
    e.preventDefault()
    setFehler(null)
    if (!mannschaftId || !gegner || !datum) {
      setFehler('Bitte Mannschaft, Gegner und Datum ausfüllen.')
      return
    }
    const { error } = await supabase.from('spiele').insert({
      mannschaft_id: mannschaftId,
      gegner,
      heim_oder_auswaerts: heimAuswaerts,
      datum,
      uhrzeit: uhrzeit || null,
      halle: halle || null
    })
    if (error) {
      setFehler(error.message)
      return
    }
    setGegner(''); setDatum(''); setUhrzeit(''); setHalle('')
    setFormOffen(false)
    ladeSpiele()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Brand size={16} />
        <Link to="/" style={{ fontSize: 13, color: '#1C8A4E', fontWeight: 600, textDecoration: 'none' }}>← Zurück</Link>
      </div>

      <div style={{ padding: 20, maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 16px' }}>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 20, margin: 0 }}>Spiele</h1>
          {kannSpielAnlegen && (
            <button style={buttonStyle} onClick={() => setFormOffen(f => !f)}>
              {formOffen ? 'Abbrechen' : '+ Spiel'}
            </button>
          )}
        </div>

        {formOffen && (
          <form onSubmit={spielAnlegen} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select style={inputStyle} value={mannschaftId} onChange={e => setMannschaftId(e.target.value)}>
              <option value="">Mannschaft wählen...</option>
              {meineMannschaften
                .filter(m => m.rolle === 'spielfuehrer' || m.rolle === 'stellvertreter')
                .map(m => <option key={m.mannschaft_id} value={m.mannschaft_id}>{m.name}</option>)}
            </select>
            <input style={inputStyle} placeholder="Gegner" value={gegner} onChange={e => setGegner(e.target.value)} />
            <select style={inputStyle} value={heimAuswaerts} onChange={e => setHeimAuswaerts(e.target.value)}>
              <option value="heim">Heim</option>
              <option value="auswaerts">Auswärts</option>
            </select>
            <input style={inputStyle} type="date" value={datum} onChange={e => setDatum(e.target.value)} />
            <input style={inputStyle} type="time" value={uhrzeit} onChange={e => setUhrzeit(e.target.value)} />
            <input style={inputStyle} placeholder="Halle (optional)" value={halle} onChange={e => setHalle(e.target.value)} />
            {fehler && <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{fehler}</p>}
            <button type="submit" style={buttonStyle}>Speichern</button>
          </form>
        )}

        {spiele.map(s => (
          <div key={s.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 14 }}>
                {s.mannschaften?.name} vs. {s.gegner}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: statusFarbe[s.status] || '#5B6D66', textTransform: 'uppercase' }}>
                {s.status}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#5B6D66', marginTop: 4 }}>
              {s.datum} {s.uhrzeit ? `· ${s.uhrzeit.slice(0, 5)} Uhr` : ''} {s.halle ? `· ${s.halle}` : ''} · {s.heim_oder_auswaerts === 'heim' ? 'Heimspiel' : 'Auswärts'}
            </div>
          </div>
        ))}

        {spiele.length === 0 && <p style={{ color: '#5B6D66', fontSize: 14 }}>Noch keine Spiele eingetragen.</p>}
      </div>
    </div>
  )
}

export default Spiele
