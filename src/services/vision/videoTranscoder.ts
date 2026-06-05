/**
 * videoTranscoder — in-browser HEVC/.mov → H.264 MP4 conversion via ffmpeg.wasm.
 *
 * Chrome/Firefox can't decode HEVC (the codec iPhones record .mov in), so those
 * clips fail in a <video> element. When that happens, the Video Analysis panel
 * falls back to here: we transcode to a browser-playable H.264 MP4 entirely
 * client-side — no server, no upload, no account.
 *
 * The ffmpeg core (~25-30MB wasm) is the single-thread build, loaded on demand
 * from a CDN as blob URLs. Single-thread avoids the SharedArrayBuffer/COOP-COEP
 * requirement, which would otherwise break the MediaPipe + Spotify CDN loads.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// Single-thread ESM core (the module worker import()s it). Pinned to 0.12.x.
const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<boolean> | null = null;

export function isTranscodeSupported(): boolean {
  return typeof WebAssembly === "object" && typeof Worker !== "undefined";
}

async function ensureLoaded(): Promise<FFmpeg> {
  if (!ffmpeg) ffmpeg = new FFmpeg();
  if (!loadPromise) {
    console.debug("[transcoder] downloading core (~32MB)…");
    loadPromise = (async () => {
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      ]);
      console.debug("[transcoder] core downloaded, initializing…");
      return ffmpeg!.load({ coreURL, wasmURL });
    })();
  }
  await loadPromise;
  console.debug("[transcoder] core ready");
  return ffmpeg;
}

export interface TranscodeOptions {
  /** 0..1 conversion progress. */
  onProgress?: (fraction: number) => void;
}

/**
 * Transcode any browser-unfriendly video file to an H.264 MP4 Blob. Downscales
 * to ≤1280px wide and drops audio (we only analyze video) to keep it fast.
 */
export async function transcodeToMp4(file: File, opts: TranscodeOptions = {}): Promise<Blob> {
  const f = await ensureLoaded();
  const onProgress = ({ progress }: { progress: number }) => {
    if (Number.isFinite(progress)) opts.onProgress?.(Math.max(0, Math.min(1, progress)));
  };
  f.on("progress", onProgress);
  const ext = file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? ".mov";
  const input = `input${ext}`;
  try {
    await f.writeFile(input, await fetchFile(file));
    console.debug("[transcoder] exec start", input);
    await f.exec([
      "-i", input,
      "-vf", "scale='min(1280,iw)':-2",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      "-an",
      "-movflags", "+faststart",
      "output.mp4",
    ]);
    console.debug("[transcoder] exec done, reading output");
    const data = await f.readFile("output.mp4");
    // data is a Uint8Array; wrap in a Blob for an object URL.
    return new Blob([data as unknown as BlobPart], { type: "video/mp4" });
  } finally {
    f.off("progress", onProgress);
    // Best-effort cleanup of the virtual FS so repeated conversions don't grow it.
    try {
      await f.deleteFile(input);
      await f.deleteFile("output.mp4");
    } catch {
      /* file may not exist if exec threw */
    }
  }
}
