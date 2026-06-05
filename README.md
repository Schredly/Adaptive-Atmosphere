# Adaptive Atmosphere

An AI-powered realtime platform for **environmental orchestration** — it reads a
space through computer vision, infers its *atmosphere* from motion intelligence,
and orchestrates music to match. This repository is the functional application
foundation built beneath the Figma Make visual design: the UI is preserved
exactly, and a realtime architecture (services → store → hooks → UI) drives it.

> The app ships in **mock mode** — it is fully alive on first load with no camera
> and no Spotify account. Plug in a webcam or credentials to go live.

---

## Quick start

```bash
npm install
cp .env.example .env      # optional — mock mode works without it
npm run dev               # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check (tsc -b) + production bundle
npm run preview    # serve the production build
npm run typecheck  # types only
```

---

## Architecture

Data flows in one direction: **services compute → the store holds → hooks pump → components render.**

```
src/
  main.tsx                     # entry — mounts <App/> + global styles
  app/                         # ← preserved Figma Make UI (do not redesign)
    App.tsx, routes.tsx
    components/                # Dashboard, TopNav, Settings, Spotify, TestMode, …
      ui/                      # shadcn/radix primitives
  store/
    useAtmosphereStore.ts      # single source of truth (Zustand)
  hooks/
    useAtmosphereEngine.ts     # the heartbeat — runs once in Layout
    useCamera.ts               # binds CameraService ↔ <video> ↔ store
    useMotionAnalysis.ts       # live MediaPipe Pose → motion samples (opt-in)
  services/
    camera/cameraService.ts    # getUserMedia, device list, reconnect
    vision/motionEngine.ts     # cinematic mock motion simulator
    vision/poseService.ts      # MediaPipe Pose (lazy-loaded)
    atmosphere/atmosphereEngine.ts  # pure motion → state/confidence/metrics
    ai/interpretationEngine.ts # realtime AI feed lines
    spotify/spotifyService.ts  # energy/state → playlist + track
    spotify/catalog.ts         # mock track + playlist data
  types/
    atmosphere.ts  motion.ts  spotify.ts
  styles/                      # ← preserved Tailwind v4 theme
```

### The engine loop (`useAtmosphereEngine`)

Mounted once in `Layout`, it ticks every ~1.3s and keeps the **whole store live on
every route**:

1. **Motion** — a `MotionSample` from the mock simulator (or the freshest live
   pose sample) → `motionEnergyScore`, `motionIntensity`, `subjectCount`.
2. **Atmosphere** — `deriveAtmosphereState()` maps energy/intensity/subjects to
   one of seven states → `atmosphereState`, `confidenceScore`, `transitionRule`.
3. **Metrics** — rolling crowd/confidence/persistence/stability.
4. **AI feed** — interpretation lines emitted on meaningful change.
5. **Music** — `orchestrate()` picks a playlist + track for the current energy.

### State model

| Atmosphere states | Environment modes |
|---|---|
| `idle` `ambient` `social` `active` `intense` `focused` `chaotic` | `gym` `jujitsu` `lounge` `retail` `surf_skate` `party` |

Switching the **environment mode** (top nav) re-biases the engine — e.g. `lounge`
reads cooler and calmer, `party` hotter and more volatile.

### Store fields

`cameraConnected` · `activeCameraDevice` · `environmentMode` · `motionEnergyScore`
· `atmosphereState` · `confidenceScore` · `activePlaylist` · `spotifyConnected` ·
`currentTrack` · `motionHistory` · `aiInterpretationFeed` · `playbackState`
(plus camera devices/status, metrics, subject count, motion source, and UI settings).

---

## Camera system

`CameraService` (a singleton) handles live webcams **and iPhone / Continuity
Cameras** (they appear as standard `videoinput` devices once paired with macOS):

- device enumeration + labels (after permission grant)
- start / switch / stop streams
- automatic reconnection with exponential backoff on track-end or device removal
- events mirrored into the store, so the TopNav indicator and Settings always
  reflect reality

On the Dashboard, the **Webcam / iPhone** buttons in the camera card connect the
feed. The real `<video>` renders *beneath* the cinematic overlays (scan line,
heatmaps, pose skeletons, motion trails), so enabling it augments the design
rather than replacing it. Camera access requires **HTTPS or `localhost`**.

---

## Motion intelligence: mock ↔ live

- **Mock (default)** — `motionEngine.ts` is a momentum-driven simulator that
  builds, peaks, and settles so the system feels intentional and cinematic.
- **Live** — set `VITE_MOTION_SOURCE=live`. When the camera is connected,
  `useMotionAnalysis` lazy-loads **MediaPipe Pose**, derives energy from landmark
  displacement, and pushes real `MotionSample`s into the store. If the model
  can't load (offline/blocked CDN), it silently falls back to mock — the UI never
  breaks. (The MediaPipe WASM bundle is code-split and only downloaded on demand.)

---

## Spotify orchestration

`spotifyService.ts` maps the live energy/state onto a playlist + track. It ships
as a deterministic mock (see `catalog.ts`) shaped like a thin wrapper over the
Spotify Web API, so a real integration drops in behind the same store fields. The
OAuth (PKCE) authorize-URL builder is wired and reads credentials from env.

---

## Environment variables

All browser-exposed vars must be `VITE_`-prefixed. See `.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_MOTION_SOURCE` | `mock` | `mock` simulation or `live` MediaPipe Pose |
| `VITE_POSE_MODEL_URL` | Google CDN | MediaPipe pose-landmarker `.task` model |
| `VITE_POSE_DELEGATE` | `GPU` | Pose backend: `GPU` (auto-falls-back to CPU) or `CPU` |
| `VITE_SPOTIFY_CLIENT_ID` | — | Spotify app client id (OAuth PKCE) |
| `VITE_SPOTIFY_REDIRECT_URI` | `…/spotify/callback` | OAuth redirect |
| `VITE_SPOTIFY_SCOPES` | playback scopes | Requested OAuth scopes |

Mock mode needs **none** of these.

---

## Tech stack

React 19 · TypeScript · Vite 6 · Tailwind CSS v4 (`@tailwindcss/vite`) ·
Motion (`motion/react`) · Zustand · React Router v7 · MediaPipe Tasks Vision
(Pose) · Radix UI / shadcn primitives · lucide-react.

## Design preservation

The `src/app/` and `src/styles/` trees are the Figma Make export, kept intact —
all animations, glassmorphism, gradients, and layout are untouched. Wiring was
added *beneath* the interface by swapping local component state for live store
selectors; no visual element was redesigned or simplified.
