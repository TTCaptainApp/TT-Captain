import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

function Admin({ session }) {
  const navigate = useNavigate()
  const [benutzerListe, setBenutzerListe] = useState([])
  const [mannschaftenListe, setMannschaftenListe] = useState([])
  const [zuordnungen, setZuordnungen] = useState([])
  const [loeschantraege, setLoeschantraege] = useState([])
  const [istAdmin, setIstAdmin] = useState(false)
  const [ladend, setLadend] = useState(true)
  const [meldung, setMeldung] = useState(null)

  // Formular-States
  const [selectedBenutzer, setSelectedBenutzer] = useState('')
  const [selectedMannschaft, setSelectedMannschaft] = useState('')
  const [selectedRolle, setSelectedRolle] = useState('spieler')

  const datenLaden = async () => {
    try {
      setLadend(true)
      
      // 1. Prüfen ob Admin
      const { data: prof } = await supabase
        .from('benutzer')
        .select('ist_administrator')
        .eq('id', session.user.id)
        .maybeSingle()

      const adminFlag = prof?.ist_administrator || false
      setIstAdmin(adminFlag)

      // 2. Zuordnungen des aktuellen Nutzers prüfen (für Spielführer-Rolle)
      const { data: meineZuordnungen } = await supabase
        .from('mannschaftszuordnungen')
        .select('mannschaft_id, rolle')
        .eq('benutzer_id', session.user.id)

      const gefuehrteTeamIds = meineZuordnungen
        ?.filter(z => z.rolle === 'spielfuehrer')
        .map(z => z.mannschaft_id) || []

      // Zugang verweigern, wenn weder Admin noch Spielführer
      if (!adminFlag && gefuehrteTeamIds.length === 0) {
        navigate('/')
        return
      }

      // 3. Alle Benutzer laden (für Auswahlliste)
      const { data: bData } = await supabase
        .from('benutzer')
        .select('id, vorname, nachname, email')
        .order('vorname')

      setBenutzerListe(bData || [])
      if (bData && bData.length > 0) setSelectedBenutzer(bData[0].id)

      // 4. Mannschaften laden (Admin = Alle, Spielführer = Nur eigene)
      let mQuery = supabase.from('mannschaften').select('id, name').order('name')
      if (!adminFlag) {
        mQuery = mQuery.in('id', gefuehrteTeamIds)
      }
      const { data: mData } = await mQuery
      setMannschaftenListe(mData || [])
      if (mData && mData.length > 0) setSelectedMannschaft(mData[0].id)

      // 5. Zuordnungen laden
      let zQuery = supabase
        .from('mannschaftszuordnungen')
        .select('id, benutzer_id, mannschaft_id, rolle, benutzer(id, vorname, nachname, email), mannschaften(id, name)')
      
      if (!adminFlag) {
        zQuery = zQuery.in('mannschaft_id', gefuehrteTeamIds)
      }
      const { data: zData } = await zQuery
      setZuordnungen(zData || [])

      // 6. Offene Löschanträge laden (nur für Administratoren)
      if (adminFlag) {
        const { data: lData } = await supabase
          .from('benutzer')
          .select('id, vorname, nachname, email, loeschung_beantragt_am')
          .eq('loeschung_beantragt', true)
          .order('loeschung_beantragt_am')
        setLoeschantraege(lData || [])
      }

    } catch (err) {
      console.error(err)
      setMeldung({ typ: 'error', text: 'Fehler beim Laden der Daten.' })
    } finally {
      setLadend(false)
    }
  }

  useEffect(() => {
    if (session) {
      datenLaden()
    }
  }, [session])

  const zuweisungSpeichern = async (e) => {
    e.preventDefault()
    setMeldung(null)

    if (!selectedBenutzer || !selectedMannschaft) {
      setMeldung({ typ: 'error', text: 'Bitte Benutzer und Mannschaft auswählen.' })
      return
    }

    try {
      const { error } = await supabase
        .from('mannschaftszuordnungen')
        .insert([
          { benutzer_id: selectedBenutzer, mannschaft_id: selectedMannschaft, rolle: selectedRolle }
        ])

      if (error) throw error

      setMeldung({ typ: 'success', text: 'Zuordnung erfolgreich gespeichert.' })
      datenLaden()
    } catch (err) {
      console.error(err)
      setMeldung({ typ: 'error', text: 'Fehler beim Speichern der Zuordnung.' })
    }
  }

  const zuordnungLoeschen = async (id) => {
    if (!confirm('Möchten Sie diese Zuordnung wirklich löschen?')) return
    try {
      const { error } = await supabase
        .from('mannschaftszuordnungen')
        .delete()
        .eq('id', id)

      if (error) throw error
      setMeldung({ typ: 'success', text: 'Zuordnung gelöscht.' })
      datenLaden()
    } catch (err) {
      console.error(err)
      setMeldung({ typ: 'error', text: 'Fehler beim Löschen der Zuordnung.' })
    }
  }

  const loeschantragBestaetigen = async (userId) => {
    if (!confirm('Möchten Sie diesen Benutzer endgültig löschen?')) return
    try {
      const { error } = await supabase
        .from('benutzer')
        .delete()
        .eq('id', userId)

      if (error) throw error
      setMeldung({ typ: 'success', text: 'Benutzer erfolgreich gelöscht.' })
      datenLaden()
    } catch (err) {
      console.error(err)
      setMeldung({ typ: 'error', text: 'Fehler beim Löschen des Benutzers.' })
    }
  }

  if (ladend) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col justify-between pb-20">
        <div className="p-4"><Brand /></div>
        <div className="text-center py-10 text-gray-400">Lade Admin-Bereich...</div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col justify-between pb-24">
      <div className="p-4 max-w-md w-full mx-auto">
        <Brand />
        <h1 className="text-xl font-bold mt-4 mb-2">
          {istAdmin ? 'Administrator-Bereich' : 'Spielführer-Verwaltung'}
        </h1>

        {meldung && (
          <div className={`p-3 rounded mb-4 text-sm ${meldung.typ === 'error' ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}>
            {meldung.text}
          </div>
        )}

        {/* Neue Zuordnung Formular */}
        <div className="bg-gray-800 p-4 rounded-lg shadow mb-6">
          <h2 className="text-md font-semibold mb-3">Benutzer zu Mannschaft zuordnen</h2>
          <form onSubmit={zuweisungSpeichern} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Benutzer</label>
              <select 
                value={selectedBenutzer} 
                onChange={(e) => setSelectedBenutzer(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white text-sm"
              >
                {benutzerListe.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.vorname} {b.nachname} ({b.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Mannschaft</label>
              <select 
                value={selectedMannschaft} 
                onChange={(e) => setSelectedMannschaft(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white text-sm"
              >
                {mannschaftenListe.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Rolle</label>
              <select 
                value={selectedRolle} 
                onChange={(e) => setSelectedRolle(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white text-sm"
              >
                <option value="spieler">Spieler</option>
                <option value="spielfuehrer">Spielführer</option>
              </select>
            </div>

            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded text-sm transition"
            >
              Zuordnung speichern
            </button>
          </form>
        </div>

        {/* Bestehende Zuordnungen */}
        <div className="bg-gray-800 p-4 rounded-lg shadow mb-6">
          <h2 className="text-md font-semibold mb-3">Aktive Zuordnungen</h2>
          {zuordnungen.length === 0 ? (
            <p className="text-xs text-gray-400">Keine Zuordnungen vorhanden.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {zuordnungen.map(z => (
                <div key={z.id} className="bg-gray-700 p-2.5 rounded flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold text-white">
                      {z.benutzer?.vorname} {z.benutzer?.nachname}
                    </div>
                    <div className="text-gray-300">
                      {z.mannschaften?.name} — <span className="text-blue-400">{z.rolle}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => zuordnungLoeschen(z.id)}
                    className="bg-red-700 hover:bg-red-600 text-white px-2 py-1 rounded transition"
                  >
                    Löschen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Offene Löschanträge (Nur Admin) */}
        {istAdmin && loeschantraege.length > 0 && (
          <div className="bg-gray-800 p-4 rounded-lg shadow">
            <h2 className="text-md font-semibold mb-3 text-red-400">Offene Löschanträge</h2>
            <div className="space-y-2">
              {loeschantraege.map(l => (
                <div key={l.id} className="bg-gray-700 p-2.5 rounded flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold">{l.vorname} {l.nachname}</div>
                    <div className="text-gray-400">{l.email}</div>
                  </div>
                  <button 
                    onClick={() => loeschantragBestaetigen(l.id)}
                    className="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Konto löschen
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}

export default Admin
 
