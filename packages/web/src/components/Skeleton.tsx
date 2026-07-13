export function SkeletonRow() {
  return (
    <div className="skeleton-row section-wrap">
      <div className="skeleton-title skeleton" />
      <div className="skeleton-track">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`skeleton-card animate-fade-up stagger-${(i % 8) + 1}`}>
            <div className="skeleton-poster skeleton" />
            <div className="skeleton-line skeleton" />
            <div className="skeleton-line-short skeleton" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonHero() {
  return (
    <div className="skeleton-hero skeleton" />
  )
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="sramo-spinner" />
    </div>
  )
}

export function SkeletonDetail() {
  return (
    <div className="section-wrap" style={{ paddingTop: 24 }}>
      <div className="skeleton-glass skeleton-glass-pulse">
        <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 12, width: '100%', marginBottom: 6 }} />
        <div className="skeleton" style={{ height: 12, width: '100%', marginBottom: 6 }} />
        <div className="skeleton" style={{ height: 12, width: '70%', marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ height: 32, width: 100, borderRadius: 99 }} />
          <div className="skeleton" style={{ height: 32, width: 100, borderRadius: 99 }} />
          <div className="skeleton" style={{ height: 32, width: 100, borderRadius: 99 }} />
        </div>
      </div>
    </div>
  )
}
