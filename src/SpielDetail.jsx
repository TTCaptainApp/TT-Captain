import { useNavigate, useParams } from 'react-router-dom'
import Brand from './Brand'
import BottomNav from './BottomNav'

function SpielDetail({ session }) {
  const navigate = useNavigate()
  const { id } = useParams()

  return (
    <div style={{ minHeight: '100vh', background: '#F6FAF8', fontFamily: 'Inter, sans-serif', color: '#16261F' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #DCE7E2', background: '#ffffff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button 
          onClick={() => navigate(-1)} 
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 0 }}
        >
          ⬅️
        </button>
        <Brand size={16} />
      </div>

      <div style={{ padding: '20px 20px 100px', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 20, margin: '8px 0 16px' }}>
          🏓 Spieldetails
        </h1>

        <div style={{ background: '#ffffff', border: '1px solid #DCE7E2', borderRadius: 14, padding: 16 }}>
          <p style={{ margin: 0, color: '#5B6D66', fontSize: 14 }}>
            Details für Spiel-ID: <strong>{id}</strong>
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

export default SpielDetail
