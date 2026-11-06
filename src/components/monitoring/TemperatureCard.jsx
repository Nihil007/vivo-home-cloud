import { Thermometer } from 'lucide-react';

const SENSOR_LABELS = {
  battery: 'Battery',
  bms: 'BMS',
  case_therm: 'Case therm',
  chg_temp: 'Charging temp',
  pm8953_tz: 'PM8953 tz',
  xo_therm: 'XO therm',
};

export default function TemperatureCard({ temperatures }) {
  const readings = temperatures && typeof temperatures === 'object'
    ? Object.entries(temperatures).filter(([, value]) => value != null && Number.isFinite(Number(value)))
    : [];

  return (
    <section className="server-panel temperature-panel">
      <div className="server-panel-heading"><div><p className="server-section-kicker">THERMAL SENSORS</p><h2>Temperature</h2></div><span className="server-panel-icon"><Thermometer size={18} /></span></div>
      {readings.length ? <div className="temperature-grid">{readings.map(([sensor, value]) => {
        const level = temperatureLevel(Number(value));
        return <article className={`temperature-reading ${level}`} key={sensor}><span className="temperature-name">{SENSOR_LABELS[sensor] || sensor.replaceAll('_', ' ')}</span><strong>{Number(value).toFixed(1)}<small>°C</small></strong><span className="temperature-level">{level === 'normal' ? 'Typical reading' : level === 'elevated' ? 'Elevated' : 'High reading'}</span></article>;
      })}</div> : <p className="server-empty-state">Temperature readings are unavailable.</p>}
      <p className="temperature-disclaimer">Color bands are visual guidance only, not device safety limits.</p>
    </section>
  );
}

export function temperatureLevel(value) {
  if (value >= 45) return 'high';
  if (value >= 38) return 'elevated';
  return 'normal';
}
