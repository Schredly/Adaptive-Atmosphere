/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
  readonly VITE_SPOTIFY_REDIRECT_URI?: string;
  readonly VITE_SPOTIFY_SCOPES?: string;
  readonly VITE_MOTION_SOURCE?: "mock" | "live";
  readonly VITE_POSE_MODEL_URL?: string;
  readonly VITE_POSE_DELEGATE?: "GPU" | "CPU";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
