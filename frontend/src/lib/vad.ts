// Energy-based VAD + utterance segmentation for the Phase 0 spike.
// Deliberately simple: RMS threshold opens an utterance, sustained silence
// closes it. The real gateway gets Silero VAD in Phase 1; this only needs to
// be good enough to measure the latency chain.

export interface VadConfig {
  sampleRate: number;
  /** RMS above this counts as speech. */
  openThreshold: number;
  /** ms of continuous silence that closes an utterance. */
  hangoverMs: number;
  /** ms of audio kept before the detected speech onset. */
  prerollMs: number;
  /** utterances shorter than this are dropped as noise blips. */
  minUtteranceMs: number;
}

export const DEFAULT_VAD: VadConfig = {
  sampleRate: 16000,
  openThreshold: 0.012,
  hangoverMs: 650,
  prerollMs: 240,
  minUtteranceMs: 350,
};

export type UtteranceHandler = (audio: Float32Array, speechEndTs: number) => void;

export class UtteranceSegmenter {
  private cfg: VadConfig;
  private onUtterance: UtteranceHandler;
  private preroll: Float32Array[] = [];
  private prerollSamples = 0;
  private active: Float32Array[] = [];
  private activeSamples = 0;
  private speaking = false;
  private silenceMs = 0;
  /** Live RMS of the last frame, for the UI level meter. */
  level = 0;

  constructor(onUtterance: UtteranceHandler, cfg: VadConfig = DEFAULT_VAD) {
    this.cfg = cfg;
    this.onUtterance = onUtterance;
  }

  push(frame: Float32Array): void {
    const frameMs = (frame.length / this.cfg.sampleRate) * 1000;
    const rms = computeRms(frame);
    this.level = rms;

    if (!this.speaking) {
      this.bufferPreroll(frame);
      if (rms >= this.cfg.openThreshold) {
        this.speaking = true;
        this.silenceMs = 0;
        this.active = [...this.preroll];
        this.activeSamples = this.prerollSamples;
        this.appendActive(frame);
      }
      return;
    }

    this.appendActive(frame);
    this.silenceMs = rms >= this.cfg.openThreshold ? 0 : this.silenceMs + frameMs;

    if (this.silenceMs >= this.cfg.hangoverMs) {
      this.close();
    }
  }

  /** Force-close any open utterance (e.g. on mic stop). */
  flush(): void {
    if (this.speaking) this.close();
  }

  private close(): void {
    this.speaking = false;
    const durationMs = (this.activeSamples / this.cfg.sampleRate) * 1000;
    const audio = concat(this.active, this.activeSamples);
    this.active = [];
    this.activeSamples = 0;
    // The trailing hangover is silence; end-of-speech was hangoverMs ago.
    const speechEndTs = performance.now() - this.cfg.hangoverMs;
    if (durationMs - this.cfg.hangoverMs >= this.cfg.minUtteranceMs) {
      this.onUtterance(audio, speechEndTs);
    }
  }

  private bufferPreroll(frame: Float32Array): void {
    this.preroll.push(frame);
    this.prerollSamples += frame.length;
    const maxSamples = (this.cfg.prerollMs / 1000) * this.cfg.sampleRate;
    while (this.prerollSamples - (this.preroll[0]?.length ?? 0) > maxSamples) {
      this.prerollSamples -= this.preroll.shift()!.length;
    }
  }

  private appendActive(frame: Float32Array): void {
    this.active.push(frame);
    this.activeSamples += frame.length;
  }
}

function computeRms(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

function concat(chunks: Float32Array[], total: number): Float32Array {
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
