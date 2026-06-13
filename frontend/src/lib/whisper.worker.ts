// Web worker running Whisper via transformers.js (tier 1 STT: on-device WebGPU).
// Messages in:  {type:"load"} | {type:"transcribe", audio: Float32Array, speechEndTs: number}
// Messages out: {type:"progress", ...} | {type:"ready", device, loadMs}
//               | {type:"transcript", text, sttMs, speechEndTs} | {type:"error", message}

import {
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";

const MODEL_ID = "onnx-community/whisper-base";

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let device: "webgpu" | "wasm" = "webgpu";

async function load(): Promise<void> {
  const started = performance.now();
  try {
    transcriber = await pipeline("automatic-speech-recognition", MODEL_ID, {
      device: "webgpu",
      progress_callback: (p: unknown) => self.postMessage({ type: "progress", info: p }),
    });
  } catch {
    // WebGPU init failed (no adapter, driver issue) — WASM CPU is 2-5x slower
    // than realtime but lets the spike still run; the page surfaces the tier.
    device = "wasm";
    transcriber = await pipeline("automatic-speech-recognition", MODEL_ID, {
      device: "wasm",
      progress_callback: (p: unknown) => self.postMessage({ type: "progress", info: p }),
    });
  }
  self.postMessage({ type: "ready", device, loadMs: performance.now() - started });
}

async function transcribe(audio: Float32Array, speechEndTs: number): Promise<void> {
  if (!transcriber) {
    self.postMessage({ type: "error", message: "model not loaded yet" });
    return;
  }
  const started = performance.now();
  const result = await transcriber(audio, { language: "english", task: "transcribe" });
  const text = (Array.isArray(result) ? result[0]?.text : result.text)?.trim() ?? "";
  self.postMessage({
    type: "transcript",
    text,
    sttMs: performance.now() - started,
    speechEndTs,
  });
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  const run = msg.type === "load" ? load() : msg.type === "transcribe" ? transcribe(msg.audio, msg.speechEndTs) : Promise.resolve();
  run.catch((err) => self.postMessage({ type: "error", message: String(err) }));
};
