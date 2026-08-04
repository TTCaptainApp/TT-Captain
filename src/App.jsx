import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

// Komponenten-Imports
import Dashboard from './Dashboard'
import Spiele from './Spiele'
import SpielDetail from './SpielDetail'
import Profil from './Profil'
import Admin from './Admin'
import Login from './Login'

function App() {
  const [session, setSession] = useState(null)
  const [ladend, setLadend] = useState(true)

  useEffect(() => {
    // Aktuelle Session beim Start abrufen
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLadend(false)
    })

    // Auf Änderungen des Login-Status lauschen (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (ladend) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: '#F6FAF8',
        fontFamily: 'Inter, sans-serif',
        color: '#1C8A4E',
        fontWeight: 600
      }}>
        Wird geladen...
      </div>
    )
  }

  // Wenn der Nutzer nicht eingeloggt ist, Login-Seite anzeigen
  if (!session) {
    return <Login />
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Hauptansichten */}
        <Route path="/" element={<Dashboard session={session} />} />
        <Route path="/spiele" element={<Spiele session={session} />} />
        
        {/* Detailansicht für EIN Spiel & Aufstellung */}
        <Route path="/spiele/:spielId" element={<SpielDetail session={session} />} />
        
        {/* Weitere Bereiche */}
        <Route path="/profil" element={<Profil session={session} />} />
        <Route path="/admin" element={<Admin session={session} />} />

        {/* Fallback bei allen unbekannten URLs -> zurück zum Dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
 
