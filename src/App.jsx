import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Registrierung from './Registrierung'
import Login from './Login'
import Dashboard from './Dashboard'

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
  return <Dashboard session={session} />
}

export default App
