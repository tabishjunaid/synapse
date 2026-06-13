// Mirror of backend/synapse_backend/gateway/protocol.py — the narrow
// gateway <-> client contract. Keep the two in sync by hand for now;
// codegen from the pydantic models once the contract stabilizes.

export interface TranscriptEvent {
  type: "transcript";
  text: string;
  speech_end_ts?: number;
  stt_ms?: number;
}

export interface ResetEvent {
  type: "reset";
}

export type ClientEvent = TranscriptEvent | ResetEvent;

export interface TurnStart {
  type: "turn_start";
  turn_id: number;
  speech_end_ts?: number | null;
}

export interface SpeakDelta {
  type: "speak_delta";
  turn_id: number;
  text: string;
}

export interface TurnLatency {
  first_token_ms: number;
  total_ms: number;
  input_tokens?: number | null;
  output_tokens?: number | null;
}

export interface TurnEnd {
  type: "turn_end";
  turn_id: number;
  full_text: string;
  latency: TurnLatency;
  speech_end_ts?: number | null;
}

export interface ServerError {
  type: "error";
  message: string;
}

export type ServerEvent = TurnStart | SpeakDelta | TurnEnd | ServerError;
