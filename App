import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [status, setStatus] = useState('Verbinde mit Supabase...')

  useEffect(() => {
    supabase.auth.getSession().then(() => {
      setStatus('Verbindung zu Supabase steht ✅')
    })
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif',
      background: '#F6FAF8',
      color: '#16261F',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1>🏓 TT Captain</h1>
      <p>{status}</p>
      <p style={{ fontSize: '13px', color: '#5B6D66' }}>Sprint 1 – Grundgerüst</p>
    </div>
  )
}

export default App 
