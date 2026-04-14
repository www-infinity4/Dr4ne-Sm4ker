/**
 * app.js — Main application controller
 *
 * Wires Sensor → AI → Drones → UI together in a real-time loop.
 */

const App = (() => {
  const TICK_MS     = 1800;   // sensor + AI cycle interval
  const CHART_TICKS = 50;     // points shown on sparkline charts

  let intervalId  = null;
  let tickCount   = 0;
  let lastReading = null;
  let lastDecision = null;

  // ── Mini sparkline charts (Canvas) ──────────────────────────────────────────

  const charts = {};

  function initChart(id, color) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    charts[id] = { canvas, color, ctx: canvas.getContext('2d') };
  }

  function drawChart(id, data, min, max) {
    const c = charts[id];
    if (!c) return;
    const { canvas, ctx, color } = c;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (data.length < 2) return;

    const range = max - min || 1;
    const pts   = data.slice(-CHART_TICKS);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + '55');
    grad.addColorStop(1, color + '00');

    ctx.beginPath();
    pts.forEach((v, i) => {
      const x = (i / (pts.length - 1)) * W;
      const y = H - ((v - min) / range) * H * 0.9 - H * 0.05;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    // Close fill path
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    pts.forEach((v, i) => {
      const x = (i / (pts.length - 1)) * W;
      const y = H - ((v - min) / range) * H * 0.9 - H * 0.05;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    ctx.stroke();
  }

  // ── Gauge arc helper ─────────────────────────────────────────────────────────

  function drawGauge(id, value, min, max, color) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width;
    const H   = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const cx   = W / 2;
    const cy   = H * 0.72;
    const r    = Math.min(W, H) * 0.42;
    const start = Math.PI;
    const end   = 2 * Math.PI;
    const ratio = Math.min(Math.max((value - min) / (max - min), 0), 1);
    const sweep = start + ratio * Math.PI;

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth   = 10;
    ctx.lineCap     = 'round';
    ctx.stroke();

    // Fill
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, sweep);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 10;
    ctx.stroke();

    // Centre label
    ctx.fillStyle  = '#f1f5f9';
    ctx.font       = `bold ${Math.round(W * 0.14)}px 'JetBrains Mono', monospace`;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(value, cx, cy - r * 0.15);
  }

  // ── DOM helpers ──────────────────────────────────────────────────────────────

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function setAttr(id, attr, val) {
    const el = document.getElementById(id);
    if (el) el.setAttribute(attr, val);
  }

  function setBadge(id, text, cls) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className   = `badge badge--${cls}`;
  }

  // ── Sensor panel update ───────────────────────────────────────────────────────

  function updateSensorPanel(r) {
    // Values
    setText('val-telluric',  r.telluric  + ' mV/km');
    setText('val-seismic',   r.seismic   + ' RS');
    setText('val-em',        r.em        + ' nT');
    setText('val-radiation', r.radiation + ' µSv/h');

    // Gauges
    drawGauge('gauge-telluric',  r.telluric,  0, 60,  '#818cf8');
    drawGauge('gauge-seismic',   r.seismic,   0, 2,   '#34d399');
    drawGauge('gauge-em',        r.em,        0, 150, '#60a5fa');
    drawGauge('gauge-radiation', r.radiation, 0, 0.5, '#f472b6');

    // Sparklines
    drawChart('chart-telluric',  Sensor.getHistory('telluric'),  0,  60);
    drawChart('chart-seismic',   Sensor.getHistory('seismic'),   0,  2   );
    drawChart('chart-em',        Sensor.getHistory('em'),        0,  150 );
    drawChart('chart-radiation', Sensor.getHistory('radiation'), 0,  0.5 );

    // Alert badge
    const level = Sensor.alertLevel(r);
    const badge = ['NOMINAL', 'ELEVATED', 'CRITICAL'][level];
    const cls   = ['ok',      'warn',     'critical' ][level];
    setBadge('alert-badge', badge, cls);

    // Status dot
    const dot = document.getElementById('status-dot');
    if (dot) {
      dot.className = `status-dot status-dot--${cls}`;
    }
  }

  // ── AI decision panel update ─────────────────────────────────────────────────

  function updateAIPanel(decision) {
    setText('ai-action',   decision.action);
    setText('ai-severity', decision.severity.toUpperCase());
    setText('ai-message',  decision.message);
    setText('ai-detail',   decision.detail);

    const sevEl = document.getElementById('ai-severity');
    if (sevEl) {
      sevEl.className = `ai-severity ai-severity--${decision.severity}`;
    }

    // Event log
    const logEl = document.getElementById('event-log');
    if (logEl) {
      const entries = AI.getLog().slice(0, 18);
      logEl.innerHTML = entries.length === 0
        ? '<li class="log-empty">No events yet…</li>'
        : entries.map(e => `
          <li class="log-entry log-entry--${e.type}">
            <span class="log-ts">${e.ts}</span>
            <span class="log-msg">${e.msg}</span>
          </li>`).join('');
    }
  }

  // ── Drone fleet panel update ─────────────────────────────────────────────────

  function updateDronePanel() {
    const fleet   = Drones.getFleet();
    const gridEl  = document.getElementById('drone-grid');
    if (!gridEl) return;

    const active  = fleet.filter(d => d.state !== 'IDLE').length;
    const onMission = fleet.filter(d => d.state === 'ON_MISSION').length;
    setText('drone-active',    active);
    setText('drone-on-mission', onMission);
    setText('drone-idle',      fleet.length - active);

    gridEl.innerHTML = fleet.map(drone => {
      const info    = Drones.missionInfo(drone.mission);
      const stateCls = drone.state.toLowerCase().replace('_', '-');
      const battCls  = drone.battery > 50 ? 'high' : drone.battery > 20 ? 'mid' : 'low';
      return `
        <div class="drone-card drone-card--${stateCls}">
          <div class="drone-card__header">
            <span class="drone-name">${drone.name}</span>
            <span class="drone-icon">${info.icon}</span>
          </div>
          <div class="drone-state">${drone.state.replace('_', ' ')}</div>
          <div class="drone-mission" style="color:${info.color}">${info.label}</div>
          <div class="drone-progress-bar">
            <div class="drone-progress-fill" style="width:${drone.progress}%;background:${info.color}"></div>
          </div>
          <div class="drone-battery">
            <span class="battery-icon battery-icon--${battCls}">⚡</span>
            <span>${drone.battery.toFixed(0)}%</span>
          </div>
        </div>`;
    }).join('');
  }

  // ── Flow diagram update ───────────────────────────────────────────────────────

  function updateFlow(reading, decision) {
    const sensorBox  = document.getElementById('flow-sensor');
    const aiBox      = document.getElementById('flow-ai');
    const actionBox  = document.getElementById('flow-action');
    if (!sensorBox) return;

    // Pulse animation class
    sensorBox.classList.add('pulse');
    setTimeout(() => sensorBox.classList.remove('pulse'), 600);

    setTimeout(() => {
      aiBox.classList.add('pulse');
      setTimeout(() => aiBox.classList.remove('pulse'), 600);
    }, 300);

    setTimeout(() => {
      actionBox.classList.add('pulse');
      setTimeout(() => actionBox.classList.remove('pulse'), 600);
    }, 600);

    setText('flow-sensor-val',  `Telluric ${reading.telluric} · EM ${reading.em} nT`);
    setText('flow-ai-val',      decision.ruleId.replace('_', ' ').toUpperCase());
    setText('flow-action-val',  decision.action.replace('_', ' '));
  }

  // ── Tick ─────────────────────────────────────────────────────────────────────

  function tick() {
    tickCount++;

    const reading  = Sensor.read();
    const decision = AI.analyse(reading);

    Drones.tick(decision);

    updateSensorPanel(reading);
    updateAIPanel(decision);
    updateDronePanel();
    updateFlow(reading, decision);

    setText('tick-counter', `Cycle #${tickCount}`);
    setText('last-updated', new Date().toLocaleTimeString());

    lastReading  = reading;
    lastDecision = decision;
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    // Initialise sparkline canvases
    initChart('chart-telluric',  '#818cf8');
    initChart('chart-seismic',   '#34d399');
    initChart('chart-em',        '#60a5fa');
    initChart('chart-radiation', '#f472b6');

    // Seed a few readings so charts aren't empty on load
    for (let i = 0; i < 20; i++) {
      Sensor.read();
    }

    // First tick immediately, then on interval
    tick();
    intervalId = setInterval(tick, TICK_MS);
  }

  document.addEventListener('DOMContentLoaded', init);

  return { getLastReading: () => lastReading, getLastDecision: () => lastDecision };
})();
