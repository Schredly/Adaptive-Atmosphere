# Adaptive Atmosphere

### Music that reads the room

An AI platform that senses a space through computer vision, infers its **mood**, and orchestrates music to match — in real time, no DJ.

**Why it's different**
- Reacts to **how a room actually moves**, not a fixed playlist or a clock.
- **Privacy-first** — reads motion and energy, never identity.
- **Transparent** — every choice shows its reasoning.
- **Self-improving** — it learns your taste and gets better the longer it runs.

<!-- Gamma: Create / Import from Markdown. Each `---` is a new card. -->

---

## How it works

A real-time pipeline of five modules: **Pose → Motion → Mood → Music**, with an optional AI brain over the top.

| Module | Job |
|---|---|
| **Vision & Motion** | See the room, measure its energy |
| **Atmosphere Engine** | Turn motion into a mood |
| **Music Orchestration** | Pick & transition the soundtrack |
| **Video Analysis** | Upload, replay & tune on real footage |
| **AI + Learning** | Enrich the read and learn corrections |

Ships **alive on first load** — no camera, no account needed.

---

## Vision & Motion

**What it sees, and how it measures energy.**

- On-device **pose tracking** (MediaPipe) finds bodies in the frame — webcam, iPhone/Continuity Camera, or uploaded video.
- A motion engine derives rich signals: **energy, velocity, rhythm, volatility, synchronization, crowd size**, plus pattern flags (repetitive reps, in-sync crowd, erratic spikes).
- Cinematic overlays — skeletons, motion trails, heat zones — render right on the feed.
- Resilient by design: auto **GPU→CPU fallback** and reconnect, so it keeps running in the real world.

---

## Atmosphere Engine

**Turning movement into meaning.**

- Maps motion into **seven moods** — idle · ambient · social · focused · active · intense · chaotic — each with a **confidence score**.
- **Six environment modes** re-bias the read: 🏋️ Gym · 🥋 Jujitsu · 🛋️ Lounge · 🛍️ Retail · 🛹 Surf/Skate · 🎉 Party.
- **Stability built in** — hysteresis + a tunable hold time so the vibe doesn't flicker on a stray movement.
- Always explainable: a plain-language **"why this mood"** for every read.

---

## Music Orchestration

**The right soundtrack, transitioned smoothly.**

- Moods map to **six energy bands**: ambient → chill → groove → hype → intense → chaotic.
- Smart transitions: **escalate** as energy builds, **ease back** as it settles, with crossfades and an idle auto-pause.
- **Playlist hold** control sets how long a vibe stays before it can change (stable ↔ reactive).
- Plays instantly in **demo mode** (built-in adaptive audio); connect **Spotify** for full-track playback.

---

## Video Analysis

**Tune the experience on real footage.**

- Upload a clip and **replay the full analysis** — pose overlays, live readouts, and a scrubbable **atmosphere timeline**.
- Handles messy real-world files: iPhone **HEVC `.mov`** converted in the browser, graceful decode-error and cloud-placeholder handling.
- Watch the soundtrack adapt to the video; **mute the clip** to focus on the music it picks.
- The fastest way to **dial in a venue** before going live.

---

## AI Capabilities

**An optional brain — and a system that learns.**

- **Bring-your-own-key LLM** (OpenAI *or* Anthropic) reads the motion summary and adds a richer, natural-language mood call. It **augments** the fast rule engine — never blocks it; works fully without it.
- **Human-in-the-loop learning** — correct a mood and similar scenes adapt **immediately** (local memory); your corrections also become **few-shot examples** that steer the model.
- **Training-ready** — every label exports as data for deeper, offline model training later.

---

## Why it matters

**The room sets the mood. The music keeps up.**

- 🏋️ Gyms · 🛍️ Retail · 🍸 Lounges · 🎉 Events — energy and sound, always in sync.
- Self-tuning, transparent, and privacy-first.
- Runs in the browser; live on day one.

**Live proof:** github.com/Schredly/Adaptive-Atmosphere · Cogent West, San Diego
