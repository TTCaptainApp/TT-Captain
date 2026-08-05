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
      const { data: zData } = await supabase
        .from('mannschaftszuordnungen')
        .select('id, benutzer_id, mannschaft_id, rolle, benutzer(id, vorname, nachname, email), mannschaften(id, name)')

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
    } finally {
      setLadend(false)
    }
  }

  useEffect(() => {
    datenLaden()
  }, [session])

  const zuweisungSpeichern = async (e) => {
    e.preventDefault()
    setMeldung(null)

    if (!selectedBenutzer || !selectedMannschaft) {
      setMeldung({ typ: 'err 
