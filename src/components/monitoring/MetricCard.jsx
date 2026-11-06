export default function MetricCard({ title, icon: Icon, value, unit = '', subtitle, progress, details = [], tone = 'mint', loading = false }) {
  return (
    <article className="server-metric-card">
      <div className="server-metric-heading">
        <span className={`server-metric-icon ${tone}`}>{Icon && <Icon size={18} strokeWidth={1.8} />}</span>
        <span className="server-metric-title">{title}</span>
      </div>
      {loading ? <div className="server-metric-skeleton" aria-label={`Loading ${title}`} /> : <>
        <p className={`server-metric-value${String(value).length > 12 ? ' compact' : ''}`}>{value ?? 'Unavailable'}{unit && <span>{unit}</span>}</p>
        {subtitle && <p className="server-metric-subtitle">{subtitle}</p>}
        {progress != null && <div className="server-meter" role="meter" aria-label={`${title} usage`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}><span className={tone} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>}
        {details.length > 0 && <dl className="server-metric-details">{details.map((detail) => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>}
      </>}
    </article>
  );
}
