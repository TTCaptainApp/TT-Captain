function Brand({ size = 20 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
      <span style={{ fontSize: size + 10 }}>🏓</span>
      <span style={{
        fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: size,
        color: '#16261F', letterSpacing: '-0.01em'
      }}>
        TT <span style={{ color: '#FF5A1F' }}>Captain</span>
      </span>
    </div>
  )
}

export default Brand
