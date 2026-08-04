import React, { useState, useEffect } from 'react'
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

// Fehler-Fänger für das Smartphone
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: '#991B1B', background: '#FDF2F2', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h3 style={{ fontSize: 16, marginTop: 0 }}>⚠️ Fehler beim Starten der App:</h3>
          <pre style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #F87171', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error?.toString()}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

function MainApp({ session }) {
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

function App() {
  const [session, setSession] = useState(null)
  const [ladend, setLadend] = useState(true)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        setLadend(false)
      })
      .catch((err) => {
        console.error('Session-Fehler:', err)
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
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif', color: '#1C8A4E', fontWeight: 600 }}>
        🔄 App lädt...
      </div>
    )
  }

  return (
    <ErrorBoundary>
      {!session ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <MainApp session={session} />
      )}
    </ErrorBoundary>
  )
}

export default App
