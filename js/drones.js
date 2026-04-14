/**
 * drones.js — Execution Layer
 *
 * Manages a simulated fleet of autonomous drones.
 * Each drone has a state machine: IDLE → DEPLOYING → ON_MISSION → RETURNING → RECHARGING → IDLE
 */

const Drones = (() => {
  const DRONE_COUNT = 8;

  const STATES = ['IDLE', 'DEPLOYING', 'ON_MISSION', 'RETURNING', 'RECHARGING'];

  const MISSION_TYPES = {
    STANDBY:       { label: 'Standby',          icon: '🔋', color: '#4ade80' },
    MONITOR_SEISMIC:{ label: 'Seismic Survey',  icon: '🌍', color: '#facc15' },
    EVACUATE_ZONE: { label: 'Safety Response',  icon: '🚨', color: '#f87171' },
    EM_SHIELD:     { label: 'EM Shielding',     icon: '⚡', color: '#fb923c' },
    EM_WATCH:      { label: 'EM Watch',         icon: '📡', color: '#facc15' },
    RAD_RESPONSE:  { label: 'Rad Containment',  icon: '☢️', color: '#f87171' },
    RAD_MONITOR:   { label: 'Rad Scout',        icon: '🔍', color: '#facc15' },
    GROUND_SURVEY: { label: 'Ground Survey',    icon: '🗺️', color: '#60a5fa' },
    TEL_WATCH:     { label: 'Telluric Watch',   icon: '🧲', color: '#a78bfa' },
  };

  // ---- Drone initialisation ---------------------------------------------------

  function makeDrone(id) {
    return {
      id,
      name:     `D-${String(id + 1).padStart(2, '0')}`,
      state:    'IDLE',
      mission:  'STANDBY',
      battery:  Math.round(80 + Math.random() * 20),  // 80–100%
      progress: 0,    // mission progress 0–100
      lat:      -20 + Math.random() * 40,              // simulated position
      lng:      -40 + Math.random() * 80,
      ticksLeft: 0,
    };
  }

  const fleet = Array.from({ length: DRONE_COUNT }, (_, i) => makeDrone(i));

  // ---- State machine ----------------------------------------------------------

  const STATE_DURATIONS = {
    DEPLOYING:  { min: 3,  max: 6  },   // ticks
    ON_MISSION: { min: 8,  max: 20 },
    RETURNING:  { min: 3,  max: 6  },
    RECHARGING: { min: 5,  max: 10 },
  };

  function randomTicks(state) {
    const d = STATE_DURATIONS[state];
    return d ? Math.round(d.min + Math.random() * (d.max - d.min)) : 0;
  }

  function transitionDrone(drone, newState, mission) {
    drone.state    = newState;
    drone.progress = 0;
    drone.ticksLeft = randomTicks(newState);
    if (mission) drone.mission = mission;
  }

  function tickDrone(drone) {
    // Battery drains during active states, charges during RECHARGING / IDLE
    if (['DEPLOYING', 'ON_MISSION'].includes(drone.state)) {
      drone.battery = Math.max(0, drone.battery - 0.5);
    } else if (['RECHARGING'].includes(drone.state)) {
      drone.battery = Math.min(100, drone.battery + 2);
    } else if (drone.state === 'IDLE') {
      drone.battery = Math.min(100, drone.battery + 0.3);
    }

    if (drone.state === 'IDLE') return; // Nothing to advance

    drone.ticksLeft = Math.max(0, drone.ticksLeft - 1);
    drone.progress  = drone.ticksLeft === 0 ? 100
                    : 100 - Math.round((drone.ticksLeft / (STATE_DURATIONS[drone.state]?.max || 1)) * 100);

    if (drone.ticksLeft > 0) return;

    // Advance state machine
    switch (drone.state) {
      case 'DEPLOYING':
        transitionDrone(drone, 'ON_MISSION');
        AI.log('action', `${drone.name} on mission: ${MISSION_TYPES[drone.mission]?.label}`,
               `Battery ${drone.battery.toFixed(0)}%`);
        break;
      case 'ON_MISSION':
        transitionDrone(drone, 'RETURNING');
        break;
      case 'RETURNING':
        transitionDrone(drone, 'RECHARGING');
        AI.log('info', `${drone.name} returned — recharging`,
               `Battery ${drone.battery.toFixed(0)}%`);
        break;
      case 'RECHARGING':
        transitionDrone(drone, 'IDLE', 'STANDBY');
        break;
      default:
        break;
    }
  }

  // ---- Dispatch logic ---------------------------------------------------------

  let lastAction = '';

  /**
   * Receive a decision from the AI layer and dispatch drones accordingly.
   */
  function dispatch(decision) {
    if (decision.action === lastAction && decision.severity === 'normal') return;
    lastAction = decision.action;

    if (decision.action === 'STANDBY') {
      // Recall non-critical drones. RAD_RESPONSE drones are kept active because
      // a radiation containment mission must complete before the drone can safely return.
      fleet.forEach(d => {
        if (d.state === 'ON_MISSION' && d.mission !== 'RAD_RESPONSE') {
          transitionDrone(d, 'RETURNING');
        }
      });
      return;
    }

    // Number of drones to dispatch depends on severity
    const count = decision.severity === 'critical' ? 3
                : decision.severity === 'warning'  ? 1
                : 0;

    let dispatched = 0;
    for (const drone of fleet) {
      if (dispatched >= count) break;
      if (drone.state === 'IDLE' && drone.battery > 20) {
        transitionDrone(drone, 'DEPLOYING', decision.action);
        AI.log('action',
               `${drone.name} dispatched — ${MISSION_TYPES[decision.action]?.label || decision.action}`,
               decision.detail);
        dispatched++;
      }
    }
  }

  // ---- Public API -------------------------------------------------------------

  /**
   * Advance the fleet simulation by one tick.
   * Call this on each update cycle.
   */
  function tick(decision) {
    dispatch(decision);
    fleet.forEach(tickDrone);
  }

  /**
   * Return a snapshot of the fleet.
   */
  function getFleet() {
    return fleet.map(d => ({ ...d }));
  }

  /**
   * Return mission metadata (label, icon, color) for a mission key.
   */
  function missionInfo(key) {
    return MISSION_TYPES[key] || { label: key, icon: '🤖', color: '#94a3b8' };
  }

  return { tick, getFleet, missionInfo, STATES };
})();
