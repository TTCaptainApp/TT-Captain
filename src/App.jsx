import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

// Alle Komponenten aus deiner Ordnerstruktur
import Dashboard from './Dashboard'
import Spiele from './Spiele'
import SpielDetail from './SpielDetail'
import Aufstellung from './Aufstellung'
import Chats from './Chats'
import Chat from './Chat'
import Mannschaften from './Mannschaften'
import Profil from './Profil'
import Admin from './Admin'
import Login from './Login'
import Registrierung from './Registrierung'

function App() {
  const [session, setSession] = useState(null)
  const [ladend, setLadend] = useState(true)

  useEffect(() => {
    // Aktuelle Session beim Start abrufen
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLadend(false)
    })

    // Auf Login/Logout Änderungen lauschen
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

  // Nicht eingeloggt? Login-Maske anzeigen
  if (!session) {
    return <Login />
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Hauptübersichten */}
        <Route path="/" element={<Dashboard session={session} />} />
        <Route path="/spiele" element={<Spiele session={session} />} />
        
        {/* Spiel-Details & Aufstellung (deckt beide URL-Varianten ab) */}
        <Route path="/spiele/:spielId" element={<SpielDetail session={session} />} />
        <Route path="/spiele/:spielId/aufstellung" element={<SpielDetail session={session} />} />
        
        {/* Falls Aufstellung.jsx separat genutzt werden soll */}
        <Route path="/aufstellung/:spielId" element={<Aufstellung session={session} />} />

        {/* Teams & Kommunikation */}
        <Route path="/mannschaften" element={<Mannschaften session={session} />} />
        <Route path="/chats" element={<Chats session={session} />} />
        <Route path="/chat/:chatId" element={<Chat session={session} />} />

        {/* Profil & Administration */}
        <Route path="/profil" element={<Profil session={session} />} />
        <Route path="/admin" element={<Admin session={session} />} />
        <Route path="/registrierung" element={<Registrierung session={session} />} />

        {/* Umleitung für unbekannte Pfade -> zurück zum Dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
 
