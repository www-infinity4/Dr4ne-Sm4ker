# 🛸 INFINITY — Autonomous Earth System

> **Zero-waste · AI-controlled · Minimal footprint**  
> *Systems that serve then disappear.*

A real-time web dashboard that translates the Infinity Earth-sensor ideology into something
fully functional in a browser — no server required.

[![Deploy to GitHub Pages](https://github.com/www-infinity4/Dr4ne-Sm4ker/actions/workflows/deploy.yml/badge.svg)](https://github.com/www-infinity4/Dr4ne-Sm4ker/actions/workflows/deploy.yml)

---

## Live Site

**[https://www-infinity4.github.io/Dr4ne-Sm4ker/](https://www-infinity4.github.io/Dr4ne-Sm4ker/)**

---

## What it does

| Layer | What it simulates |
|---|---|
| 🌍 **Earth Signal Layer** | Telluric currents, seismic activity, EM field, radiation — live-animated with sparklines & gauges |
| 🧠 **AI Control Layer** | Rule-based decision engine that classifies readings as Normal / Warning / Critical and chooses fleet actions |
| 🚁 **Drone Execution Layer** | 8-drone fleet with full state machines (Deploy → Mission → Return → Recharge) |
| 📟 **Signal Flow** | Real-time Detection → Decision → Action visual pipeline |
| 📋 **Event Log** | Timestamped feed of every AI decision and drone dispatch |

---

## Stack

- Pure **HTML · CSS · JavaScript** — zero dependencies, zero build step
- Deployed automatically to **GitHub Pages** on every push to `main`

---

## Project structure

```
.
├── index.html              # Dashboard UI
├── css/
│   └── styles.css          # Dark-theme, mobile-first styles
├── js/
│   ├── sensor.js           # Earth signal simulation layer
│   ├── ai.js               # AI analysis & event log
│   ├── drones.js           # Drone fleet state machines
│   └── app.js              # Main loop — wires all layers together
└── .github/
    └── workflows/
        └── deploy.yml      # GitHub Pages deployment workflow
```

---

## Local development

No build step needed — just open `index.html` in a browser:

```bash
# Using Python's built-in server (optional)
python3 -m http.server 8080
# Then visit http://localhost:8080
```

---

## Ideology preserved

> "No profit-driven waste, no planned obsolescence, minimal footprint,  
>  systems that serve then disappear."
