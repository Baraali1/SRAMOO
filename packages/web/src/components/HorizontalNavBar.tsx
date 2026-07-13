import { useNavigate } from 'react-router-dom'

export function HorizontalNavBar() {
  const navigate = useNavigate()

  return (
    <header className="header-glass">
      <div className="header-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--accent)" stroke="none">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        <span>Sramo</span>
      </div>
      <div className="header-actions">
        <button
          onClick={() => navigate('/search')}
          className="header-btn"
          title="Search"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      </div>
    </header>
  )
}
