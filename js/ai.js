/**
 * ai.js — AI Control Layer
 *
 * Interprets sensor readings and decides what actions the drone fleet
 * should take.  Designed to be deterministic given the same inputs so
 * the dashboard is predictable.
 */

const AI = (() => {
  // ---- Event log --------------------------------------------------------------

  const MAX_LOG = 100;
  const eventLog = [];

  function logEvent(type, msg, detail = '') {
    const entry = {
      id:     Date.now() + Math.random(),
      ts:     new Date().toLocaleTimeString(),
      type,   // 'info' | 'warn' | 'alert' | 'action'
      msg,
      detail,
    };
    eventLog.unshift(entry);
    if (eventLog.length > MAX_LOG) eventLog.pop();
    return entry;
  }

  // ---- Thresholds & rule engine -----------------------------------------------

  const RULES = [
    // Seismic spike
    {
      id:        'seismic_high',
      test:      r => r.seismic > 1.0,
      severity:  'critical',
      action:    'EVACUATE_ZONE',
      message:   'Seismic spike detected — deploying safety drones',
      detail:    v => `Seismic reading ${v.seismic.toFixed(3)} exceeds critical threshold 1.0`,
    },
    {
      id:        'seismic_elevated',
      test:      r => r.seismic > 0.4,
      severity:  'warning',
      action:    'MONITOR_SEISMIC',
      message:   'Elevated seismic activity — increasing sensor density',
      detail:    v => `Seismic reading ${v.seismic.toFixed(3)} above normal`,
    },
    // EM pulse
    {
      id:        'em_critical',
      test:      r => r.em > 120,
      severity:  'critical',
      action:    'EM_SHIELD',
      message:   'Strong EM pulse detected — shielding systems activated',
      detail:    v => `EM field ${v.em.toFixed(1)} nT — solar/lightning event likely`,
    },
    {
      id:        'em_elevated',
      test:      r => r.em > 90,
      severity:  'warning',
      action:    'EM_WATCH',
      message:   'EM field elevated — monitoring for pulse',
      detail:    v => `EM field ${v.em.toFixed(1)} nT`,
    },
    // Radiation
    {
      id:        'rad_critical',
      test:      r => r.radiation > 0.40,
      severity:  'critical',
      action:    'RAD_RESPONSE',
      message:   'Radiation above safe threshold — containment drones deployed',
      detail:    v => `Radiation ${v.radiation.toFixed(3)} µSv/h`,
    },
    {
      id:        'rad_elevated',
      test:      r => r.radiation > 0.25,
      severity:  'warning',
      action:    'RAD_MONITOR',
      message:   'Elevated radiation — scout drone dispatched',
      detail:    v => `Radiation ${v.radiation.toFixed(3)} µSv/h`,
    },
    // Telluric
    {
      id:        'tel_high',
      test:      r => r.telluric > 38,
      severity:  'critical',
      action:    'GROUND_SURVEY',
      message:   'Strong telluric current — ground survey initiated',
      detail:    v => `Telluric ${v.telluric.toFixed(2)} mV/km`,
    },
    {
      id:        'tel_elevated',
      test:      r => r.telluric > 28,
      severity:  'warning',
      action:    'TEL_WATCH',
      message:   'Telluric current elevated — passive monitoring',
      detail:    v => `Telluric ${v.telluric.toFixed(2)} mV/km`,
    },
    // Default: all clear
    {
      id:        'all_clear',
      test:      () => true,
      severity:  'normal',
      action:    'STANDBY',
      message:   'All signals nominal — fleet on standby',
      detail:    () => 'No anomalies detected',
    },
  ];

  // ---- Public API -------------------------------------------------------------

  /**
   * Analyse a SensorReading and return a Decision object.
   * The first matching rule wins (rules are ordered by severity).
   */
  function analyse(reading) {
    const matched = RULES.find(r => r.test(reading));

    const decision = {
      ts:       new Date().toLocaleTimeString(),
      ruleId:   matched.id,
      severity: matched.severity,
      action:   matched.action,
      message:  matched.message,
      detail:   matched.detail(reading),
    };

    const logType = matched.severity === 'critical' ? 'alert'
                  : matched.severity === 'warning'  ? 'warn'
                  : 'info';

    if (matched.id !== 'all_clear') {
      logEvent(logType, matched.message, matched.detail(reading));
    }

    return decision;
  }

  /**
   * Return a copy of the event log.
   */
  function getLog() {
    return [...eventLog];
  }

  /**
   * Manually inject a log entry (e.g. from the drone layer).
   */
  function log(type, msg, detail) {
    return logEvent(type, msg, detail);
  }

  return { analyse, getLog, log };
})();
