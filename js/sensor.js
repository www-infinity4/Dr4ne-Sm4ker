/**
 * sensor.js — Earth Signal Layer
 *
 * Simulates natural environmental signals:
 *   - Telluric currents (ground electrical currents)
 *   - Seismic activity
 *   - Electromagnetic field fluctuations
 *   - Radiation levels
 */

const Sensor = (() => {
  // Historical data buffers (last N readings)
  const HISTORY_LEN = 60;

  const history = {
    telluric:  [],
    seismic:   [],
    em:        [],
    radiation: [],
  };

  // Running baseline values that drift slowly to simulate real-world variation
  let baseline = {
    telluric:  12.5,  // mV/km
    seismic:   0.02,  // Richter-scale proxy (micro-seism)
    em:        47.0,  // nT (nano-Tesla)
    radiation: 0.12,  // µSv/h (background)
  };

  // ---- helpers ----------------------------------------------------------------

  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  function gaussian(mean, sigma) {
    // Box-Muller transform for normally distributed noise
    const u1 = Math.random();
    const u2 = Math.random();
    const z  = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
    return mean + sigma * z;
  }

  function driftBaseline(key, min, max, drift) {
    baseline[key] += gaussian(0, drift);
    baseline[key]  = clamp(baseline[key], min, max);
  }

  // ---- per-signal generation --------------------------------------------------

  function readTelluric() {
    driftBaseline('telluric', 5, 40, 0.3);
    const val = clamp(gaussian(baseline.telluric, 1.2), 0, 60);
    return parseFloat(val.toFixed(2));
  }

  function readSeismic() {
    driftBaseline('seismic', 0.01, 0.8, 0.005);
    // Occasional micro-quakes
    const spike = Math.random() < 0.04 ? gaussian(0.5, 0.15) : 0;
    const val   = clamp(gaussian(baseline.seismic, 0.01) + spike, 0, 3.0);
    return parseFloat(val.toFixed(3));
  }

  function readEM() {
    driftBaseline('em', 30, 80, 0.8);
    // EM pulses (solar wind, lightning, etc.)
    const pulse = Math.random() < 0.06 ? gaussian(15, 4) : 0;
    const val   = clamp(gaussian(baseline.em, 2.5) + pulse, 0, 150);
    return parseFloat(val.toFixed(1));
  }

  function readRadiation() {
    driftBaseline('radiation', 0.08, 0.35, 0.005);
    const val = clamp(gaussian(baseline.radiation, 0.01), 0, 2.0);
    return parseFloat(val.toFixed(3));
  }

  // ---- push reading to history ------------------------------------------------

  function pushHistory(key, val) {
    history[key].push(val);
    if (history[key].length > HISTORY_LEN) history[key].shift();
  }

  // ---- public -----------------------------------------------------------------

  /**
   * Take a single snapshot of all sensors.
   * Returns a SensorReading object.
   */
  function read() {
    const ts        = Date.now();
    const telluric  = readTelluric();
    const seismic   = readSeismic();
    const em        = readEM();
    const radiation = readRadiation();

    pushHistory('telluric',  telluric);
    pushHistory('seismic',   seismic);
    pushHistory('em',        em);
    pushHistory('radiation', radiation);

    return { ts, telluric, seismic, em, radiation };
  }

  /**
   * Return the last N readings for a given signal key.
   */
  function getHistory(key) {
    return [...(history[key] || [])];
  }

  /**
   * Compute alert level (0=normal, 1=elevated, 2=critical) from a reading.
   */
  function alertLevel(reading) {
    let level = 0;
    if (reading.telluric  > 28 || reading.seismic > 0.4  ||
        reading.em        > 90 || reading.radiation > 0.25) level = 1;
    if (reading.telluric  > 38 || reading.seismic > 1.0  ||
        reading.em        > 120 || reading.radiation > 0.40) level = 2;
    return level;
  }

  return { read, getHistory, alertLevel };
})();
