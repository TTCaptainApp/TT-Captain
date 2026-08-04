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
  const [handyFehler, setHandyFehler] = useState(null)

  useEffect(() => {
    // Fehler auf dem Handy abfangen und auf dem Bildschirm anzeigen
    const fehlerCatcher = (e) => {
      setHandyFehler(e.error?.message || e.message || 'Unbekannter Fehler')
    }
    const rejectionCatcher = (e) => {
      setHandyFehler(e.reason?.message || String(e.reason))
    }

    window.addEventListener('error', fehlerCatcher)
    window.addEventListener('unhandledrejection', rejectionCatcher)

    // Session beim Start laden
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLadend(false)
    }).catch(err => {
      setHandyFehler('Supabase Fehler: ' + err.message)
      setLadend(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      window.removeEventListener('error', fehlerCatcher)
      window.removeEventListener('unhandledrejection', rejectionCatcher)
      subscription.unsubscribe()
    }
  }, [])

  // Falls auf dem Handy ein JavaScript-Fehler passiert -> Fehlermeldung rot anzeigen
  if (handyFehler) {
    return (
      <div style={{ padding: 20, color: '#c0392b', background: '#fdf2f2', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <h3 style={{ marginTop: 0 }}>⚠️ Fehler aufgetreten:</h3>
        <pre style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #f5c6cb', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 13 }}>
          {handyFehler}
        </pre>
        <button 
          onClick={() => window.location.reload()} 
          style={{ background: '#1C8A4E', color: 'white', border: 'none', padding: '10px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', marginTop: 10 }}
        >
          Neu laden
        </button>
      </div>
    )
  }

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

  return (
    <BrowserRouter>
      {!session ? (
        <Routes>
          <Route path="/registrierung" element={<Registrierung />} />
          <Route path="*" element={<Login />} />
        </Routes>
      ) : (
        <Routes>
          {/* Hauptansichten */}
          <Route path="/" element={<Dashboard session={session} />} />
          <Route path="/spiele" element={<Spiele session={session} />} />
          
          {/* Spiel-Details & Aufstellung */}
          <Route path="/spiele/:spielId" element={<SpielDetail session={session} />} />
          <Route path="/spiele/:spielId/aufstellung" element={<SpielDetail session={session} />} />
          <Route path="/aufstellung/:spielId" element={<Aufstellung session={session} />} />

          {/* Teams & Kommunikation */}
          <Route path="/mannschaften" element={<Mannschaften session={session} />} />
          <Route path="/chats" element={<Chats session={session} />} />
          <Route path="/chat/:chatId" element={<Chat session={session} />} />

          {/* Profil & Administration */}
          <Route path="/profil" element={<Profil session={session} />} />
          <Route path="/admin" element={<Admin session={session} />} />
          <Route path="/registrierung" element={<Registrierung session={session} />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}

export default App
