import { ArrowDownToLine, ArrowUpFromLine, Network } from 'lucide-react';

export default function NetworkChart({ network, history }) {
  const download = numberOrNull(network?.download_bytes_per_second);
  const upload = numberOrNull(network?.upload_bytes_per_second);

  return (
    <section className="server-panel network-panel">
      <div className="server-panel-heading"><div><p className="server-section-kicker">NETWORK ACTIVITY</p><h2>Traffic</h2></div><span className="server-panel-icon"><Network size={18} /></span></div>
      <div className="network-speed-grid">
        <div><span><ArrowDownToLine size={14} /> Download</span><strong>{download == null ? 'Unavailable' : formatRate(download)}</strong></div>
        <div><span><ArrowUpFromLine size={14} /> Upload</span><strong>{upload == null ? 'Unavailable' : formatRate(upload)}</strong></div>
      </div>
      <NetworkSvg history={history} />
      <div className="network-totals"><div><span>Total received</span><strong>{formatBytes(network?.received_bytes)}</strong></div><div><span>Total transmitted</span><strong>{formatBytes(network?.transmitted_bytes)}</strong></div><div><span>Interface</span><strong>{network?.interface || 'Unavailable'}</strong></div></div>
    </section>
  );
}

function NetworkSvg({ history }) {
  const points = history.filter((item) => Number.isFinite(item.download) || Number.isFinite(item.upload));
  if (!points.length) return <div className="network-chart-empty">No network speed readings yet.</div>;
  const width = 640;
  const height = 145;
  const padding = 8;
  const maximum = Math.max(1, ...points.map((point) => Math.max(point.download || 0, point.upload || 0)));
  const linePath = (key) => points.map((point, index) => {
    const value = point[key];
    if (!Number.isFinite(value)) return '';
    const x = points.length === 1 ? width / 2 : padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - (value / maximum) * (height - padding * 2);
    return `${index && Number.isFinite(points[index - 1][key]) ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).filter(Boolean).join(' ');

  return <div className="network-chart-wrap"><svg className="network-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recent download and upload speeds">
    {[0.25, 0.5, 0.75, 1].map((part) => <line key={part} x1="0" x2={width} y1={height - padding - part * (height - padding * 2)} y2={height - padding - part * (height - padding * 2)} className="chart-grid-line" />)}
    <path d={linePath('download')} className="chart-line download-line" />
    <path d={linePath('upload')} className="chart-line upload-line" />
  </svg><div className="network-chart-legend"><span><i className="download-legend" /> Download</span><span><i className="upload-legend" /> Upload</span></div></div>;
}

function numberOrNull(value) {
  const number = Number(value);
  return value != null && Number.isFinite(number) ? number : null;
}

export function formatRate(value) {
  if (value === 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${amount.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

export function formatBytes(value) {
  const bytes = numberOrNull(value);
  if (bytes == null) return 'Unavailable';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = bytes;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${amount.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}
