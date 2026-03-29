<div align="center">

# CollabFlow

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-222222?style=flat&logo=github-pages&logoColor=white)](https://pages.github.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A modern, real-time collaborative flowchart editor — built with pure HTML/CSS/JS, deployable on GitHub Pages.**

[Live Demo](https://alfredang.github.io/collabflow) · [Report Bug](https://github.com/alfredang/collabflow/issues) · [Request Feature](https://github.com/alfredang/collabflow/issues)

</div>

## Screenshot

<!-- Screenshot will be added once the app is deployed -->
<!-- ![Screenshot](screenshot.png) -->

## About

CollabFlow is a lightweight, browser-based flowchart editor that lets multiple users create and edit diagrams together in real time. No frameworks, no build step — just open `index.html` and start diagramming.

### Key Features

| Feature | Description |
|---------|-------------|
| **Drag & Drop Shapes** | Process, Decision, Start/End, Text Label — click to place, drag to move |
| **Smart Connectors** | Orthogonal arrow routing with auto-port selection and editable labels |
| **Real-Time Collaboration** | Firebase-powered rooms with live sync, presence cursors, and user avatars |
| **Room Sharing** | Generate shareable links and QR codes for instant collaboration |
| **Inline Text Editing** | Double-click any shape to edit text directly on the canvas |
| **Style Customization** | Change fill color, stroke, border width, and font size per element |
| **Export Options** | Export to PNG, PDF, or JSON — import JSON to restore flowcharts |
| **Dark / Light Theme** | Toggle between themes with one click; persisted across sessions |
| **Undo / Redo** | Full history with Ctrl+Z / Ctrl+Shift+Z |
| **Keyboard Shortcuts** | V, R, D, S, T, C for tools; Delete, Ctrl+A, Ctrl+C/V/X/D |
| **Zoom & Pan** | Scroll to zoom, Space+drag to pan, minimap for navigation |
| **Snap to Grid** | Configurable grid with snap alignment for clean layouts |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Rendering** | SVG (shapes, connectors, cursors — all vector-based) |
| **Frontend** | Pure HTML5 + CSS3 + JavaScript ES Modules |
| **Collaboration** | Firebase Realtime Database + Anonymous Auth |
| **PDF Export** | jsPDF (loaded on demand via CDN) |
| **QR Codes** | qrcodejs (loaded on demand via CDN) |
| **Fonts** | Inter (Google Fonts) |
| **Deployment** | GitHub Pages via GitHub Actions |

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Browser (Client)                   │
├──────────┬────────────┬──────────────┬───────────────┤
│ canvas.js│ elements.js│ connectors.js│ selection.js  │
│ drag.js  │ editor.js  │ shortcuts.js │ history.js    │
├──────────┴────────────┴──────────────┴───────────────┤
│                    state.js (AppState)                │
├──────────────────────┬───────────────────────────────┤
│   collaboration.js   │        export.js              │
│  (Firebase sync)     │   (PNG / PDF / JSON)          │
├──────────────────────┴───────────────────────────────┤
│              Firebase Realtime Database               │
│  rooms/{code}/elements  /connections  /presence       │
└──────────────────────────────────────────────────────┘
```

## Project Structure

```
collabflow/
├── index.html                    # App shell (toolbar, sidebar, canvas, modals)
├── css/
│   └── style.css                 # Layout, themes, components
├── js/
│   ├── app.js                    # Entry point — bootstraps all modules
│   ├── state.js                  # Central state store + event system
│   ├── canvas.js                 # SVG canvas, zoom, pan, grid
│   ├── elements.js               # Shape factory and rendering
│   ├── connectors.js             # Arrow routing and rendering
│   ├── selection.js              # Single/multi-select, rubber-band
│   ├── drag.js                   # Drag-and-drop, tool switching
│   ├── editor.js                 # Inline text editing, properties panel
│   ├── history.js                # Undo/redo (snapshot-based)
│   ├── shortcuts.js              # Keyboard shortcut registry
│   ├── collaboration.js          # Firebase: rooms, sync, presence
│   ├── export.js                 # PNG, PDF, JSON export/import
│   ├── theme.js                  # Dark/light toggle
│   ├── minimap.js                # Minimap with viewport indicator
│   ├── ui.js                     # Toolbar, modals, sidebar bindings
│   ├── utils.js                  # Geometry helpers, ID gen, SVG utils
│   ├── firebase-config.example.js # Template for Firebase credentials
│   └── firebase-config.js        # Your Firebase config (gitignored)
├── .github/
│   └── workflows/
│       └── deploy.yml            # GitHub Pages deploy with secret injection
├── .gitignore
├── .nojekyll
└── README.md
```

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- A Firebase project (free tier) for collaboration features

### Local Development

```bash
# Clone the repository
git clone https://github.com/alfredang/collabflow.git
cd collabflow

# Copy the Firebase config template
cp js/firebase-config.example.js js/firebase-config.js

# Edit js/firebase-config.js with your Firebase credentials
# (see Firebase Setup below)

# Serve locally
npx serve -s .
```

Open `http://localhost:3000` in your browser.

### Firebase Setup (for Collaboration)

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project
2. Enable **Anonymous Authentication** (Authentication → Sign-in method → Anonymous)
3. Create a **Realtime Database** (Build → Realtime Database → Create Database)
4. Set database rules for development:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
5. Go to Project Settings → Your apps → Add web app → copy the config
6. Paste the config values into `js/firebase-config.js`

> **Note:** The app works fully offline for single-user flowcharting. Firebase is only needed for real-time collaboration.

## Deployment (GitHub Pages)

This project deploys automatically via GitHub Actions on push to `main`.

### Setting Up GitHub Secrets

Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, and add:

| Secret Name | Value |
|------------|-------|
| `FIREBASE_API_KEY` | Your Firebase API key |
| `FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `FIREBASE_DATABASE_URL` | `https://your-project-default-rtdb.firebaseio.com` |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `FIREBASE_STORAGE_BUCKET` | `your-project.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | Your sender ID |
| `FIREBASE_APP_ID` | Your app ID |

The GitHub Actions workflow injects these secrets into `js/firebase-config.js` at deploy time — no credentials are ever committed to the repository.

### Enabling GitHub Pages

1. Go to repo **Settings** → **Pages**
2. Set Source to **GitHub Actions**
3. Push to `main` — the workflow will deploy automatically

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `V` | Select tool |
| `R` | Process (rectangle) |
| `D` | Decision (diamond) |
| `S` | Start/End (pill) |
| `T` | Text label |
| `C` | Connector (arrow) |
| `Space` + drag | Pan canvas |
| `Scroll` | Zoom in/out |
| `Double-click` | Edit text |
| `Delete` / `Backspace` | Delete selected |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+A` | Select all |
| `Ctrl+C` / `Ctrl+V` | Copy / Paste |
| `Ctrl+D` | Duplicate |
| `Escape` | Deselect / Cancel |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgements

- [Firebase](https://firebase.google.com/) — Real-time database and anonymous auth
- [jsPDF](https://github.com/parallax/jsPDF) — PDF generation
- [qrcodejs](https://github.com/davidshimjs/qrcodejs) — QR code generation
- [Inter](https://rsms.me/inter/) — UI typeface
- Built with [Claude Code](https://claude.ai/code)

---

<div align="center">

**If you found this useful, give it a star!**

</div>
