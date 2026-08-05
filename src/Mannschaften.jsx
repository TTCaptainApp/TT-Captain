import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Brand from './Brand'
import BottomNav from './BottomNav'

const cardStyle = { background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 16, marginBottom: 12 }
const inputStyle = { padding: '9px 10px', fontSize: 14, borderRadius: 8, border: '1px solid #DCE7E2', fontFamily: 'inherit', flex: 1 }
const buttonStyle = { background: '#1C8A4E', color: 'white', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const smallButtonStyle = { ...buttonStyle, padding: '6px 10px', fontSize: 12.5 }

function Mannschaften({ session }) {
  const [vereinId, setVereinId] = useState(null)
  const [mannschaften, setMannschaften] = useState([])
  const [neuerName, setNeuerName] = useState('')
  const [links, setLinks] = useState({})
  const [fehler, setFehler] = useState(null)
  const [kopiert, setKopiert] = useState(null)

  const ladeMannschaften = async (vId) => {
    const { data } = await supabase.from('mannschaften').select('id, name').eq('verein_id', vId).order('name')
    setMannschaften(data || [])
  }

  const ladeLinks = async (mannschaftId) => {
    const { data } = await supabase.from('einladungslinks').select('id, code, aktiv').eq('mannschaft_id', mannschaftId).order('erstellt_am', { ascending: false })
    setLinks(prev => ({ ...prev, [mannschaftId]: data || [] }))
  }

  useEffect(() => {
    supabase.from('benutzer').select('verein_id').eq('id', session.user.id).single()
      .then(({ data }) => {
        if (data) {
          setVereinId(data.verein_id)
          ladeMannschaften(data.verein_id)
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

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff' }}>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 20px 8 
