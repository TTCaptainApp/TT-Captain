import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Registrierung from './Registrierung'
import Login from './Login'
import Dashboard from './Dashboard'
import Mannschaften from './Mannschaften'
import Spiele from './Spiele'
import Aufstellung from './Aufstellung'
import Chats from './Chats'
import Chat from './Chat'
import Profil from './Profil'
import Admin from './Admin'
import NeuesPasswort from './NeuesPasswort'
import Benachrichtigungen from './Benachrichtigungen'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) return null

  const params = new URLSearchParams(window.location.search)
  const inviteCode = params.get('invite')

  if (!session && inviteCode) {
    return <Registrierung inviteCode={inviteCode} />
  }
  if (!session) {
    return <Login />
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard session={session} />} />
      <Route path="/mannschaften" element={<Mannschaften session={session} />} />
      <Route path="/spiele" element={<Spiele session={session} />} />
      <Route path="/spiele/:spielId/aufstellung" element={<Aufstellung session={session} />} />
      <Route path="/chats" element={<Chats session={session} />} />
      <Route path="/chats/mannschaft/:mannschaftId" element={<Chat session={session} />} />
      <Route path="/chats/spiel/:spielId" element={<Chat session={session} />} />
      <Route path="/profil" element={<Profil session={session} />} />
      <Route path="/admin" element={<Admin session={session} />} />
      <Route path="/neues-passwort" element={<NeuesPasswort />} />
      <Route path="/benachrichtigungen" element={<Benachrichtigungen session={session} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default App 
