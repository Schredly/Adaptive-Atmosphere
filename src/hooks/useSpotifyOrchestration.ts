/**
 * useSpotifyOrchestration — bridges the atmosphere engine to music.
 *
 * Mounted once in Layout. It:
 *   • completes the OAuth redirect (if we just came back from Spotify)
 *   • initializes the spotifyManager for the persisted mode (demo/live)
 *   • feeds atmosphere-state changes to the manager (which decides transitions)
 *   • re-evaluates on a slow interval so cooldown expiry / resume still fire
 *     when the atmosphere is stable
 *
 * All playback state flows back into the store via the manager, so the UI stays
 * realtime without this hook re-rendering anything itself.
 */

import { useEffect } from "react";

import { spotifyManager } from "@/services/spotify/spotifyManager";
import * as auth from "@/services/spotify/spotifyAuth";
import { useAtmosphereStore } from "@/store/useAtmosphereStore";

export function useSpotifyOrchestration() {
  const atmosphereState = useAtmosphereStore((s) => s.atmosphereState);

  // Boot: handle redirect, init manager, periodic re-evaluation.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (auth.isRedirectCallback()) {
        const ok = await auth.handleRedirectCallback();
        if (ok && !cancelled) useAtmosphereStore.getState().setSpotifyMode("live");
      }
      if (cancelled) return;
      const mode = useAtmosphereStore.getState().spotifyMode;
      await spotifyManager.init(mode);
      if (!cancelled && auth.isAuthenticated()) await spotifyManager.refreshProfile();
    })();

    const interval = window.setInterval(() => {
      const s = useAtmosphereStore.getState();
      void spotifyManager.onAtmosphere(s.atmosphereState, s.motionEnergyScore, s.confidenceScore);
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  // React immediately to atmosphere-state transitions.
  useEffect(() => {
    const s = useAtmosphereStore.getState();
    void spotifyManager.onAtmosphere(s.atmosphereState, s.motionEnergyScore, s.confidenceScore);
  }, [atmosphereState]);
}
