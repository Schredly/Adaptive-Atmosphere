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
/** Ring buffer of recent ffmpeg log lines, for surfacing failure reasons. */
const logTail: string[] = [];

export class TranscodeError extends Error {
  constructor(
    message: string,
    readonly kind: "out-of-memory" | "failed",
    readonly detail: string,
  ) {
    super(message);
    this.name = "TranscodeError";
  }
}

export function isTranscodeSupported(): boolean {
  return typeof WebAssembly === "object" && typeof Worker !== "undefined";
}

async function ensureLoaded(): Promise<FFmpeg> {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => {
      logTail.push(message);
      if (logTail.length > 80) logTail.shift();
    });
  }
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

export type TranscodePhase = "loading" | "converting";

export interface TranscodeOptions {
  /** 0..1 conversion progress (only meaningful in the "converting" phase). */
  onProgress?: (fraction: number) => void;
  /** Coarse phase: downloading the converter vs. actually converting. */
  onPhase?: (phase: TranscodePhase) => void;
}

/**
 * Transcode any browser-unfriendly video file to an H.264 MP4 Blob. We only
 * need it for pose analysis, so we downscale hard (≤640px wide) and cap to 15fps
 * — this is dramatically faster and lighter on memory than a full-res convert,
 * which matters for the single-thread wasm encoder on real-length clips.
 */
export async function transcodeToMp4(file: File, opts: TranscodeOptions = {}): Promise<Blob> {
  opts.onPhase?.("loading");
  const f = await ensureLoaded();
  opts.onPhase?.("converting");
  const onProgress = ({ progress }: { progress: number }) => {
    if (Number.isFinite(progress)) opts.onProgress?.(Math.max(0, Math.min(1, progress)));
  };
  f.on("progress", onProgress);
  logTail.length = 0;
  const ext = file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? ".mov";
  const input = `input${ext}`;
  try {
    await f.writeFile(input, await fetchFile(file));
    console.debug("[transcoder] exec start", input);
    // exec resolves with ffmpeg's exit code (it does NOT reject on failure).
    const code = await f.exec([
      "-y",
      "-i", input,
      "-vf", "scale='min(640,iw)':-2",
      "-r", "15",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      "-an",
      "-movflags", "+faststart",
      "output.mp4",
    ]);
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
    console.debug("[transcoder] exec done, reading output");
    const data = await f.readFile("output.mp4");
    // data is a Uint8Array; wrap in a Blob for an object URL.
    return new Blob([data as unknown as BlobPart], { type: "video/mp4" });
  } catch (e) {
    const detail = logTail.slice(-15).join("\n");
    console.error(`[transcoder] conversion failed: ${String(e)}\n${detail}`);
    const oom = /(out of memory|memory access|table index is out of|abort|allocat|enomem)/i.test(
      `${detail} ${String(e)}`,
    );
    // Recover: a wedged instance must not poison the next attempt.
    try {
      f.terminate();
    } catch {
      /* already dead */
    }
    ffmpeg = null;
    loadPromise = null;
    throw new TranscodeError(
      oom ? "Out of memory during conversion" : "Conversion failed",
      oom ? "out-of-memory" : "failed",
      detail,
    );
  } finally {
    f.off("progress", onProgress);
    // Best-effort cleanup of the virtual FS so repeated conversions don't grow it.
    try {
      await f.deleteFile(input);
      await f.deleteFile("output.mp4");
    } catch {
      /* file may not exist / instance terminated */
    }
  }
}
