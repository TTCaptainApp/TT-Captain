import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'

export function BottomNav({ istAdmin, session }) {
  const location = useLocation()
  const path = location.pathname
  const [ungelesenChat, setUngelesenChat] = useState(0)
  const [ungelesenSpiele, setUngelesenSpiele] = useState(0)

  useEffect(() => {
    if (!session?.user?.id) return

    const ladeAnzahl = async () => {
      const { data } = await supabase
        .from('benachrichtigungen')
        .select('typ')
        .eq('benutzer_id', session.user.id)
        .eq('gelesen', false)

      let chat = 0
      let spiele = 0
      ;(data || []).forEach(b => {
        if (b.typ === 'chat') chat += 1
        else spiele += 1
      })
      setUngelesenChat(chat)
      setUngelesenSpiele(spiele)
    }
    ladeAnzahl()

    const channel = supabase
      .channel('benachrichtigungen-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'benachrichtigungen', filter: `benutzer_id=eq.${session.user.id}` },
        () => ladeAnzahl()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [session?.user?.id])

  const itemStyle = (aktiv) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textDecoration: 'none',
    fontSize: 11,
    fontWeight: aktiv ? 700 : 500,
    color: aktiv ? '#1C8A4E' : '#5B6D66',
    gap: 2,
    position: 'relative'
  })

  const badgeStyle = {
    position: 'absolute',
    top: -4,
    right: -8,
    background: '#c0392b',
    color: 'white',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    fontSize: 10,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 3px',
    lineHeight: 1
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#ffffff',
      borderTop: '1px solid #DCE7E2',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '8px 0 12px',
      maxWidth: 480,
      margin: '0 auto',
      zIndex: 100
    }}>
      <Link to="/" style={itemStyle(path === '/')}>
        <span style={{ fontSize: 18 }}>🏠</span>
        <span>Start</span>
      </Link>

      <Link to="/spiele" style={itemStyle(path.startsWith('/spiele'))}>
        <span style={{ fontSize: 18, position: 'relative' }}>
          📅
          {ungelesenSpiele > 0 && <span style={badgeStyle}>{ungelesenSpiele > 9 ? '9+' : ungelesenSpiele}</span>}
        </span>
        <span>Spiele</span>
      </Link>

      <Link to="/chats" style={itemStyle(path.startsWith('/chat'))}>
        <span style={{ fontSize: 18, position: 'relative' }}>
          💬
          {ungelesenChat > 0 && <span style={badgeStyle}>{ungelesenChat > 9 ? '9+' : ungelesenChat}</span>}
        </span>
        <span>Chats</span>
      </Link>

      <Link to="/mannschaften" style={itemStyle(path.startsWith('/mannschaften'))}>
        <span style={{ fontSize: 18 }}>👥</span>
        <span>Teams</span>
      </Link>

      <Link to="/profil" style={itemStyle(path === '/profil' || path === '/admin')}>
        <span style={{ fontSize: 18 }}>👤</span>
        <span>Profil</span>
      </Link>
    </div>
  )
}

export default BottomNav
 
