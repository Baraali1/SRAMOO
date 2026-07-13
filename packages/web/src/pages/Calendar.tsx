import { useState, useEffect } from 'react'
import { PosterCard } from '../components/PosterCard.js'
import { SkeletonRow } from '../components/Skeleton.js'
import { tmdb } from '../tmdb.js'
import type { MetaItem } from '../api.js'

function formatDate(date: Date) {
  return date.toISOString().split('T')[0]
}

function getDays() {
  const days: Date[] = []
  for (let i = -1; i < 13; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export function CalendarPage() {
  const [days] = useState(() => getDays())
  const [selectedIdx, setSelectedIdx] = useState(1)
  const [results, setResults] = useState<MetaItem[]>([])
  const [loading, setLoading] = useState(false)

  const selectedDate = days[selectedIdx]

  useEffect(() => {
    if (!selectedDate) return
    setLoading(true)
    const dateStr = formatDate(selectedDate)
    Promise.all([
      tmdb.discover('movie', { 'primary_release_date.gte': dateStr, 'primary_release_date.lte': dateStr }).then(r => r.items).catch(() => []) as Promise<MetaItem[]>,
      tmdb.discover('series', { 'first_air_date.gte': dateStr, 'first_air_date.lte': dateStr }).then(r => r.items).catch(() => []) as Promise<MetaItem[]>,
    ]).then(([movies, series]) => {
      const seen = new Set<string>()
      setResults([...movies, ...series].filter(item => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      }))
      setLoading(false)
    })
  }, [selectedIdx, selectedDate])

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <h1>Calendar</h1>
        <div className="calendar-scroll">
          {days.map((d, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`calendar-pill ${i === selectedIdx ? 'active' : ''}`}
            >
              <span className="day-name">{DAYS_SHORT[d.getDay()]}</span>
              <span className="day-num">{d.getDate()}</span>
              <span className="day-month">{MONTHS[d.getMonth()]}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedDate && (
        <div className="calendar-timeline-date">
          <span className="date-badge">
            {DAYS_SHORT[selectedDate.getDay()]}, {MONTHS[selectedDate.getMonth()]} {selectedDate.getDate()}
          </span>
          <span className="date-label">{results.length} release{results.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {loading ? (
        <SkeletonRow />
      ) : results.length === 0 ? (
        <div className="empty-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <h3>No releases</h3>
          <p>Nothing releases on this date.</p>
        </div>
      ) : (
        <div className="full-grid">
          {results.map((item, i) => (
            <PosterCard
              key={item.id}
              id={item.id}
              type={item.type || 'movie'}
              name={item.name}
              poster={item.poster}
              imdbRating={item.imdbRating}
              releaseInfo={item.releaseInfo}
              className={`animate-fade-up stagger-${(i % 8) + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
