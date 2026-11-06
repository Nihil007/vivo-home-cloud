import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Clock3, Cpu, HardDrive, MemoryStick, RefreshCw, Server } from 'lucide-react';
import MetricCard from '../components/monitoring/MetricCard.jsx';
import NetworkChart from '../components/monitoring/NetworkChart.jsx';
import ServiceStatus from '../components/monitoring/ServiceStatus.jsx';
import TemperatureCard, { temperatureLevel } from '../components/monitoring/TemperatureCard.jsx';
import { cloudApi, UnauthorizedError } from '../api/cloudApi.js';

const REFRESH_MS = 5000;

export default function ServerMonitor({ onUnauthorized }) {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const hasSuccessfulData = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (mounted.current) {
      setRefreshing(true);
      if (!hasSuccessfulData.current) setLoading(true);
    }
    try {
      const nextStats = await cloudApi.monitorStats();
      const hasMetricGroups = nextStats && typeof nextStats === 'object' && ['cpu', 'device', 'memory', 'network', 'services', 'storage', 'temperatures', 'uptime'].some((key) => key in nextStats);
      if (!hasMetricGroups) throw new Error('The monitoring response did not contain server metrics.');
      if (!mounted.current) return;
      hasSuccessfulData.current = true;
      setStats(nextStats);
      setError('');
      const serverTime = Number(nextStats && nextStats.timestamp);
      setLastUpdated(Number.isFinite(serverTime) && serverTime > 0 ? new Date(serverTime * 1000) : new Date());
      const rx = numberOrNull(nextStats && nextStats.network && nextStats.network.download_bytes_per_second);
      const tx = numberOrNull(nextStats && nextStats.network && nextStats.network.upload_bytes_per_second);
      if (rx != null || tx != null) {
        setHistory((current) => current.concat({ download: rx, upload: tx }).slice(-30));
      }
    } catch (requestError) {
      if (!mounted.current) return;
      if (requestError instanceof UnauthorizedError) {
        onUnauthorized(requestError);
      } else {
        setError(requestError.message || 'Monitoring data could not be refreshed.');
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, [onUnauthorized]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const interval = window.setInterval(refresh, REFRESH_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(interval);
    };
  }, [refresh]);

  const alerts = buildAlerts(stats, error);
  const cloudOnline = stats && stats.services && stats.services.cloud && stats.services.cloud.online;
  const connectionState = typeof cloudOnline === 'boolean' ? (cloudOnline ? 'Online' : 'Offline') : stats ? 'Unavailable' : 'Checking';

  if (loading && !stats && !error) {
    return <section className="monitor-page"><div className="monitor-loading"><span className="spinner" /> Loading server metrics…</div></section>;
  }

  const cpu = stats && stats.cpu;
  const cpuAvailable = cpu && cpu.available === true && numberOrNull(cpu.usage_percent) != null;
  const memory = stats && stats.memory;
  const storage = stats && stats.storage;
  const uptime = stats && stats.uptime;
  const uptimeAvailable = uptime && uptime.available === true && numberOrNull(uptime.seconds) != null;
  const updatedLabel = lastUpdated ? lastUpdated.toLocaleString() : 'No successful update yet';

  return (
    <section className="monitor-page">
      <div className="server-monitor-header">
        <div className="server-monitor-title-block">
          <p className="server-section-kicker">VIVO CLOUD / SYSTEM</p>
          <h1>Server Monitor</h1>
          <p className="server-monitor-device">Vivo Cloud <span>·</span> {(stats && stats.device && stats.device.model) || 'Model unavailable'} <span>·</span> Android {(stats && stats.device && stats.device.android_version) || 'Unavailable'}</p>
        </div>
        <div className="server-monitor-controls">
          <div className={cloudOnline === true ? 'connection-pill online' : cloudOnline === false ? 'connection-pill offline' : 'connection-pill unknown'}><i />{connectionState}</div>
          <button className="monitor-refresh" type="button" onClick={refresh} disabled={refreshing} aria-label="Refresh monitoring stats" title="Refresh now"><RefreshCw size={17} className={refreshing ? 'refresh-spinning' : ''} /></button>
        </div>
      </div>

      <div className="monitor-meta-row"><span><Activity size={14} /> Auto refresh every 5 seconds</span><span>Last updated: {updatedLabel}</span></div>
      {error && <p className={stats ? 'monitor-notice stale' : 'monitor-notice error'} role="status">{stats ? 'Data may be stale. Last refresh failed: ' + error : 'Monitoring data is unavailable: ' + error}</p>}

      <div className="server-metrics-grid">
        <MetricCard title="CPU usage" icon={Cpu} tone="blue" value={cpuAvailable ? Number(cpu.usage_percent).toFixed(1) : 'Unavailable'} unit={cpuAvailable ? '%' : ''} subtitle={cpuAvailable ? 'Processor statistics available' : (cpu && cpu.message) || 'CPU statistics are not available.'} progress={cpuAvailable ? Number(cpu.usage_percent) : null} />
        <MetricCard title="RAM" icon={MemoryStick} tone="violet" value={validPercent(memory && memory.usage_percent) ? Number(memory.usage_percent).toFixed(1) + '%' : 'Unavailable'} progress={validPercent(memory && memory.usage_percent) ? Number(memory.usage_percent) : null} details={[{ label: 'Total', value: formatBytes(memory && memory.total_bytes) }, { label: 'Used', value: formatBytes(memory && memory.used_bytes) }, { label: 'Available', value: formatBytes(memory && memory.available_bytes) }]} />
        <MetricCard title="Storage" icon={HardDrive} tone="mint" value={validPercent(storage && storage.usage_percent) ? Number(storage.usage_percent).toFixed(1) + '%' : 'Unavailable'} progress={validPercent(storage && storage.usage_percent) ? Number(storage.usage_percent) : null} details={[{ label: 'Total', value: formatBytes(storage && storage.total_bytes) }, { label: 'Used', value: formatBytes(storage && storage.used_bytes) }, { label: 'Free', value: formatBytes(storage && storage.free_bytes) }]} />
        <MetricCard title="Server uptime" icon={Clock3} tone="amber" value={uptimeAvailable ? formatUptime(Number(uptime.seconds)) : 'Unavailable'} subtitle={uptimeAvailable ? 'Time since last restart' : 'Android restricts access to uptime information.'} />
      </div>

      <div className="server-monitor-secondary-grid">
        <NetworkChart network={stats && stats.network} history={history} />
        <TemperatureCard temperatures={stats && stats.temperatures} />
      </div>

      <ServiceStatus services={stats && stats.services} />

      <section className="server-panel alerts-panel">
        <div className="server-panel-heading"><div><p className="server-section-kicker">SYSTEM CHECKS</p><h2>Alerts</h2></div><span className={alerts.length ? 'alert-count active' : 'alert-count'}>{alerts.length}</span></div>
        {alerts.length ? <ul className="monitor-alert-list">{alerts.map((alert) => <li className={alert.level} key={alert.text}><i />{alert.text}</li>)}</ul> : <p className="server-empty-state">No alerts from the available readings.</p>}
      </section>
      <div className="monitor-footnote"><Server size={15} /> Metric availability depends on Android system access and the values returned by Flask.</div>
    </section>
  );
}

function buildAlerts(stats, error) {
  const alerts = [];
  if (error) alerts.push({ level: 'warning', text: 'Monitoring API is unavailable or the latest refresh failed.' });
  const ram = numberOrNull(stats && stats.memory && stats.memory.usage_percent);
  if (ram != null && ram >= 85) alerts.push({ level: 'warning', text: 'RAM usage is high at ' + ram.toFixed(1) + '%.' });
  const storage = numberOrNull(stats && stats.storage && stats.storage.usage_percent);
  if (storage != null && storage >= 90) alerts.push({ level: 'warning', text: 'Storage usage is high at ' + storage.toFixed(1) + '%.' });
  const temps = stats && stats.temperatures;
  if (temps && typeof temps === 'object') {
    for (const [name, value] of Object.entries(temps)) {
      const n = numberOrNull(value);
      const level = n == null ? 'normal' : temperatureLevel(n);
      if (n != null && level !== 'normal') alerts.push({ level, text: name.replaceAll('_', ' ') + ' temperature is ' + level + ' at ' + n.toFixed(1) + ' °C. Temperature bands are informational only.' });
    }
  }
  for (const [key, service] of Object.entries((stats && stats.services) || {})) {
    if (service && service.online === false) alerts.push({ level: 'offline', text: key.replaceAll('_', ' ') + ' service is offline.' });
  }
  return alerts;
}

function validPercent(value) {
  const number = numberOrNull(value);
  return number != null && number >= 0 && number <= 100;
}

function numberOrNull(value) {
  const number = Number(value);
  return value != null && Number.isFinite(number) ? number : null;
}

function formatBytes(value) {
  const bytes = numberOrNull(value);
  if (bytes == null) return 'Unavailable';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = bytes;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
  return amount.toFixed(index ? 1 : 0) + ' ' + units[index];
}

function formatUptime(seconds) {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return days + 'd ' + hours + 'h ' + minutes + 'm';
}
