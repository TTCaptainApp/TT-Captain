import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

import Login from './Login'
import Dashboard from './Dashboard'
import Spiele from './Spiele'
import SpielDetail from './SpielDetail'
import Chats from './Chats'
import Chat from './Chat'
import Mannschaften from './Mannschaften'
import Profil from './Profil'
import Admin from './Admin'

function App() {
  const [session, setSession] = useState(null)
  const [ladend, setLadend] = useState(true)

  useEffect(() => {
    // Session abrufen mit Timeout-Schutz
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLadend(false)
    }).catch(() => {
      setLadend(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLadend(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (ladend) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif', color: '#1C8A4E' }}>
        Laden...
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard session={session} />} />
      <Route path="/spiele" element={<Spiele session={session} />} />
      <Route path="/spiele/:id" element={<SpielDetail session={session} />} />
      <Route path="/chats" element={<Chats session={session} />} />
      <Route path="/chats/mannschaft/:mannschaftId" element={<Chat session={session} />} />
      <Route path="/chats/spiel/:spielId" element={<Chat session={session} />} />
      <Route path="/mannschaften" element={<Mannschaften session={session} />} />
      <Route path="/profil" element={<Profil session={session} />} />
      <Route path="/admin" element={<Admin session={session} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
 
