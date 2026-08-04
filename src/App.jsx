import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Registrierung from './Registrierung'
import Login from './Login'
import Dashboard from './Dashboard'
import Mannschaften from './Mannschaften'
import Spiele from './Spiele'
import Aufstellung from './Aufstellung'
import Chats from './Chats'
import Chat from './Chat'

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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard session={session} />} />
        <Route path="/mannschaften" element={<Mannschaften session={session} />} />
        <Route path="/spiele" element={<Spiele session={session} />} />
        <Route path="/spiele/:spielId/aufstellung" element={<Aufstellung session={session} />} />
        <Route path="/chats" element={<Chats session={session} />} />
        <Route path="/chats/mannschaft/:mannschaftId" element={<Chat session={session} />} />
        <Route path="/chats/spiel/:spielId" element={<Chat session={session} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App 
