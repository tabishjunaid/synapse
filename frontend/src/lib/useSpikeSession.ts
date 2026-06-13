"use client";

// Orchestrates the Phase 0 latency spike:
//   mic -> VAD -> Whisper worker (tier 1 STT) -> WS -> Haiku stream -> local TTS
// with per-stage timestamps captured at every hop.

import { useCallback, useEffect, useRef, useState } from "react";

import type { ServerEvent, TranscriptEvent } from "./protocol";
import { UtteranceSegmenter } from "./vad";

export interface TurnTimings {
  /** Whisper decode time in the worker. */
  sttMs?: number;
  /** WS send -> first speak_delta on the client (network + server first token). */
  clientFirstTokenMs?: number;
  /** Server-side: request start -> first token from the API. */
  serverFirstTokenMs?: number;
  /** Server-side: full model turn. */
  serverTotalMs?: number;
  /** End of speech -> first TTS audio. The number that must beat ~1.5s. */
  e2eMs?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
}

export interface Turn {
  id: number;
  learnerText: string;
  teacherText: string;
  done: boolean;
  timings: TurnTimings;
}

export interface SpikeState {
  sttStatus: "idle" | "loading" | "ready" | "error";
  sttDevice: "webgpu" | "wasm" | null;
  sttLoadMs: number | null;
  micStatus: "off" | "on" | "denied";
  wsStatus: "disconnected" | "connecting" | "connected";
  ttsVoice: string | null;
  ttsIsLocal: boolean;
  error: string | null;
  turns: Turn[];
}

interface PendingTiming {
  speechEndTs: number;
  sendTs: number;
  sttMs?: number;
  firstDeltaTs?: number;
  ttsStarted: boolean;
}

const WS_BASE =
  process.env.NEXT_PUBLIC_SYNAPSE_WS ?? "ws://localhost:8765/ws/session";

/**
 * The spike/lesson session hook. With no `lessonId` it's the generic Phase 0
 * loop (the /spike page). With a `lessonId` the WS carries it as a query param,
 * so the backend builds a lesson-directed system prompt instead of the generic
 * tutor one — the same machinery, now teaching a specific lesson.
 */
export function useSpikeSession(opts: { lessonId?: string } = {}) {
  const lessonId = opts.lessonId;
  const [state, setState] = useState<SpikeState>({
    sttStatus: "idle",
    sttDevice: null,
    sttLoadMs: null,
    micStatus: "off",
    wsStatus: "disconnected",
    ttsVoice: null,
    ttsIsLocal: false,
    error: null,
    turns: [],
  });

  const workerRef = useRef<Worker | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const segmenterRef = useRef<UtteranceSegmenter | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  // FIFO of client timings awaiting their server-assigned turn id.
  const pendingRef = useRef<PendingTiming[]>([]);
  const timingByTurnRef = useRef<Map<number, PendingTiming>>(new Map());
  const speakBufferRef = useRef<Map<number, string>>(new Map());
  /** Live mic RMS for the level meter — read via rAF, not React state. */
  const levelRef = useRef(0);
  /** Typed messages queued while the WS is still opening; flushed on connect. */
  const outboxRef = useRef<string[]>([]);

  const patch = useCallback((p: Partial<SpikeState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const patchTurn = useCallback((id: number, fn: (t: Turn) => Turn) => {
    setState((s) => ({
      ...s,
      turns: s.turns.map((t) => (t.id === id ? fn(t) : t)),
    }));
  }, []);

  // ---- TTS --------------------------------------------------------------

  useEffect(() => {
    const pickVoice = () => {
      const voices = window.speechSynthesis?.getVoices() ?? [];
      // Tier 1: strictly local voices (Chrome "Google" / Edge "Natural"
      // voices are server-backed and would silently break the privacy story).
      const local = voices.filter((v) => v.localService && v.lang.startsWith("en"));
      const voice = local[0] ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
      voiceRef.current = voice;
      patch({ ttsVoice: voice?.name ?? null, ttsIsLocal: voice?.localService ?? false });
    };
    pickVoice();
    window.speechSynthesis?.addEventListener("voiceschanged", pickVoice);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", pickVoice);
  }, [patch]);

  const speak = useCallback(
    (turnId: number, text: string) => {
      if (!text.trim()) return;
      const u = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) u.voice = voiceRef.current;
      u.onstart = () => {
        const timing = timingByTurnRef.current.get(turnId);
        if (timing && !timing.ttsStarted) {
          timing.ttsStarted = true;
          const e2eMs = performance.now() - timing.speechEndTs;
          patchTurn(turnId, (t) => ({ ...t, timings: { ...t.timings, e2eMs } }));
        }
      };
      window.speechSynthesis.speak(u);
    },
    [patchTurn],
  );

  /** Buffer streamed deltas, flush complete sentences to TTS as they form. */
  const speakDelta = useCallback(
    (turnId: number, delta: string) => {
      const buf = (speakBufferRef.current.get(turnId) ?? "") + delta;
      const match = buf.match(/^[\s\S]*?[.!?](?=\s|$)/);
      if (match) {
        speak(turnId, match[0]);
        speakBufferRef.current.set(turnId, buf.slice(match[0].length));
      } else {
        speakBufferRef.current.set(turnId, buf);
      }
    },
    [speak],
  );

  const speakFlush = useCallback(
    (turnId: number) => {
      const rest = speakBufferRef.current.get(turnId);
      speakBufferRef.current.delete(turnId);
      if (rest) speak(turnId, rest);
    },
    [speak],
  );

  // ---- WebSocket --------------------------------------------------------

  const handleServerEvent = useCallback(
    (event: ServerEvent) => {
      switch (event.type) {
        case "turn_start": {
          const timing = pendingRef.current.shift();
          if (timing) timingByTurnRef.current.set(event.turn_id, timing);
          setState((s) => ({
            ...s,
            turns: [
              ...s.turns,
              {
                id: event.turn_id,
                learnerText: "",
                teacherText: "",
                done: false,
                timings: { sttMs: timing?.sttMs },
              },
            ],
          }));
          break;
        }
        case "speak_delta": {
          const timing = timingByTurnRef.current.get(event.turn_id);
          if (timing && timing.firstDeltaTs === undefined) {
            timing.firstDeltaTs = performance.now();
            const clientFirstTokenMs = timing.firstDeltaTs - timing.sendTs;
            patchTurn(event.turn_id, (t) => ({
              ...t,
              timings: { ...t.timings, clientFirstTokenMs },
            }));
          }
          patchTurn(event.turn_id, (t) => ({
            ...t,
            teacherText: t.teacherText + event.text,
          }));
          speakDelta(event.turn_id, event.text);
          break;
        }
        case "turn_end": {
          speakFlush(event.turn_id);
          patchTurn(event.turn_id, (t) => ({
            ...t,
            done: true,
            teacherText: event.full_text,
            timings: {
              ...t.timings,
              serverFirstTokenMs: event.latency.first_token_ms,
              serverTotalMs: event.latency.total_ms,
              inputTokens: event.latency.input_tokens,
              outputTokens: event.latency.output_tokens,
            },
          }));
          break;
        }
        case "error":
          patch({ error: event.message });
          break;
      }
    },
    [patch, patchTurn, speakDelta, speakFlush],
  );

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;
    patch({ wsStatus: "connecting", error: null });
    const url = lessonId
      ? `${WS_BASE}?lesson_id=${encodeURIComponent(lessonId)}`
      : WS_BASE;
    const ws = new WebSocket(url);
    // Clear any prior (often transient, e.g. StrictMode double-mount) error on a
    // successful open so a stale banner doesn't linger over a working session.
    ws.onopen = () => patch({ wsStatus: "connected", error: null });
    ws.onclose = () => patch({ wsStatus: "disconnected" });
    ws.onerror = () => {
      // Only surface if we never actually connected — a working session that
      // briefly errors (reconnect, dev remount) shouldn't show a scary banner.
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        patch({ error: `Couldn't reach the teaching server at ${WS_BASE}.` });
      }
    };
    ws.onmessage = (e) => handleServerEvent(JSON.parse(e.data) as ServerEvent);
    wsRef.current = ws;
  }, [patch, handleServerEvent, lessonId]);

  const sendTranscript = useCallback(
    (text: string, speechEndTs: number, sttMs?: number) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        patch({ error: "Not connected to the backend." });
        return;
      }
      pendingRef.current.push({ speechEndTs, sendTs: performance.now(), sttMs, ttsStarted: false });
      const event: TranscriptEvent = {
        type: "transcript",
        text,
        speech_end_ts: speechEndTs,
        stt_ms: sttMs,
      };
      ws.send(JSON.stringify(event));
      // Show the learner's words immediately on the latest turn placeholder:
      // turn_start will create the row; stash the text to attach there.
      pendingTextRef.current.push(text);
    },
    [patch],
  );

  const pendingTextRef = useRef<string[]>([]);

  // Attach learner text when its turn row appears.
  useEffect(() => {
    const last = state.turns[state.turns.length - 1];
    if (last && last.learnerText === "" && pendingTextRef.current.length > 0) {
      const text = pendingTextRef.current.shift()!;
      patchTurn(last.id, (t) => ({ ...t, learnerText: text }));
    }
  }, [state.turns, patchTurn]);

  // ---- STT worker -------------------------------------------------------

  const loadStt = useCallback(() => {
    if (workerRef.current) return;
    patch({ sttStatus: "loading" });
    const worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === "ready") {
        patch({ sttStatus: "ready", sttDevice: msg.device, sttLoadMs: msg.loadMs });
      } else if (msg.type === "transcript") {
        if (msg.text) sendTranscript(msg.text, msg.speechEndTs, msg.sttMs);
      } else if (msg.type === "error") {
        // Lead with a plain-language line; keep the raw engine detail in parens
        // for whoever's debugging. Typed input still works — the WS is separate.
        patch({
          sttStatus: "error",
          error: `Speech model couldn't load in this browser — use Chrome/Edge, or type below. (${msg.message})`,
        });
      }
    };
    worker.postMessage({ type: "load" });
    workerRef.current = worker;
  }, [patch, sendTranscript]);

  // ---- Mic --------------------------------------------------------------

  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      await ctx.audioWorklet.addModule("/worklets/recorder.js");
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "recorder");

      const segmenter = new UtteranceSegmenter((audio, speechEndTs) => {
        workerRef.current?.postMessage({ type: "transcribe", audio, speechEndTs }, [
          audio.buffer,
        ]);
      });
      segmenterRef.current = segmenter;

      node.port.onmessage = (e) => {
        // Crude self-echo guard: don't listen while the teacher is speaking.
        // Real barge-in arbitration is a Phase 1 gateway requirement.
        if (window.speechSynthesis.speaking) {
          levelRef.current = 0;
          return;
        }
        segmenter.push(e.data as Float32Array);
        levelRef.current = segmenter.level;
      };
      source.connect(node);
      patch({ micStatus: "on" });
    } catch {
      patch({ micStatus: "denied", error: "Microphone permission denied — use typed input below (rung 3)." });
    }
  }, [patch]);

  const stopMic = useCallback(() => {
    segmenterRef.current?.flush();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    streamRef.current = null;
    audioCtxRef.current = null;
    levelRef.current = 0;
    patch({ micStatus: "off" });
  }, [patch]);

  // ---- Public API ---------------------------------------------------------

  const start = useCallback(() => {
    connect();
    loadStt();
  }, [connect, loadStt]);

  /**
   * Typed input — degradation rung 3; also handy for testing without a mic.
   * Must work without the speech pipeline: if the WS isn't open yet, queue the
   * message and open it on demand (the effect below flushes once connected), so
   * the user never has to "Start session" first or hit a silently-dead Send.
   */
  const sendTyped = useCallback(
    (text: string) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        sendTranscript(text, performance.now());
      } else {
        outboxRef.current.push(text);
        connect();
      }
    },
    [sendTranscript, connect],
  );

  // Flush typed messages that were queued while the WS was still connecting.
  useEffect(() => {
    if (state.wsStatus === "connected" && outboxRef.current.length > 0) {
      const queued = outboxRef.current.splice(0);
      queued.forEach((t) => sendTranscript(t, performance.now()));
    }
  }, [state.wsStatus, sendTranscript]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      workerRef.current?.terminate();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
      window.speechSynthesis?.cancel();
    };
  }, []);

  return { state, levelRef, start, connect, loadStt, startMic, stopMic, sendTyped };
}
