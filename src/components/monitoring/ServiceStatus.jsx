import { Globe2, Server, Terminal } from 'lucide-react';

const SERVICE_META = [
  { key: 'website', label: 'Website', Icon: Globe2 },
  { key: 'cloud', label: 'Cloud API', Icon: Server },
  { key: 'ssh', label: 'SSH', Icon: Terminal },
];

export default function ServiceStatus({ services }) {
  return (
    <section className="server-panel services-panel">
      <div className="server-panel-heading"><div><p className="server-section-kicker">CONNECTED SERVICES</p><h2>Service status</h2></div></div>
      <div className="service-grid">{SERVICE_META.map(({ key, label, Icon }) => {
        const service = services?.[key];
        const state = typeof service?.online === 'boolean' ? service.online ? 'online' : 'offline' : 'unknown';
        const port = service?.port != null && Number.isFinite(Number(service.port)) ? service.port : 'Unavailable';
        return <article className={`service-card ${state}`} key={key}><div className="service-card-top"><span className="service-icon"><Icon size={17} /></span><span className={`service-indicator ${state}`} /><span className="service-state">{state === 'unknown' ? 'Unavailable' : state === 'online' ? 'Online' : 'Offline'}</span></div><strong>{label}</strong><small>Port {port}</small></article>;
      })}</div>
    </section>
  );
}
