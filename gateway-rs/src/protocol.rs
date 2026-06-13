//! The gateway <-> client message contract — a Rust mirror of the Python
//! `gateway/protocol.py`. This is the narrow boundary the audio gateway owns:
//! transcript events in, speak/act events out.
//!
//! The gateway can parse these to make transport decisions (barge-in on a new
//! transcript while speaking, surfacing latency, etc.) without ever touching the
//! Claude SDK. Today the proxy forwards frames verbatim; these types are the
//! seam the Phase 1 audio handling builds on.

use serde::{Deserialize, Serialize};

// ---- client -> server ------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientEvent {
    /// A finalized utterance from the client's STT tier.
    Transcript {
        text: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        speech_end_ts: Option<f64>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        stt_ms: Option<f64>,
    },
    /// Clear conversation history (new lesson segment).
    Reset,
}

// ---- server -> client ------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TurnLatency {
    pub first_token_ms: f64,
    pub total_ms: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input_tokens: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LearnerSkill {
    pub skill_id: String,
    pub mastery: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerEvent {
    TurnStart {
        turn_id: i64,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        speech_end_ts: Option<f64>,
    },
    SpeakDelta {
        turn_id: i64,
        text: String,
    },
    TurnEnd {
        turn_id: i64,
        full_text: String,
        latency: TurnLatency,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        speech_end_ts: Option<f64>,
    },
    LearnerUpdate {
        turn_id: i64,
        #[serde(default)]
        skills: Vec<LearnerSkill>,
        #[serde(default)]
        focus: String,
        #[serde(default)]
        ready_to_check: bool,
    },
    Error {
        message: String,
    },
}

/// Best-effort classification of a client frame, for transport decisions. Falls
/// back to `None` for frames we don't model so the proxy still forwards them.
pub fn parse_client(text: &str) -> Option<ClientEvent> {
    serde_json::from_str(text).ok()
}

/// Best-effort classification of a server frame (e.g. to detect turn boundaries
/// for barge-in arbitration).
pub fn parse_server(text: &str) -> Option<ServerEvent> {
    serde_json::from_str(text).ok()
}
