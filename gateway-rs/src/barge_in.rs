//! Barge-in arbitration — a Phase 1 realtime responsibility.
//!
//! When the learner starts speaking while the teacher is still talking, the
//! gateway must (a) stop forwarding the in-flight TTS/`speak_delta` stream to the
//! client and (b) signal the brain to abandon the current turn. This wants
//! consistent tail latency and no GC pauses — exactly why this module lives in
//! Rust rather than the Python relay.
//!
//! This is the arbiter's state machine; the wiring to an actual TTS stream and a
//! brain-cancel signal lands as Phase 1 fills in the audio path.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TeacherState {
    /// No active teacher turn.
    Idle,
    /// A turn is streaming out (`turn_start` seen, `turn_end` not yet).
    Speaking,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decision {
    /// Nothing to do.
    Ignore,
    /// Learner barged in mid-turn — cut the outbound stream and cancel the turn.
    Interrupt,
}

#[derive(Default)]
pub struct BargeIn {
    state: TeacherState,
}

impl Default for TeacherState {
    fn default() -> Self {
        TeacherState::Idle
    }
}

impl BargeIn {
    /// Call on each outbound server event so the arbiter tracks turn boundaries.
    pub fn on_server_turn_start(&mut self) {
        self.state = TeacherState::Speaking;
    }

    pub fn on_server_turn_end(&mut self) {
        self.state = TeacherState::Idle;
    }

    /// Call when the learner begins a new utterance (VAD `Active`, or a new
    /// inbound `transcript`). Returns whether to interrupt the teacher.
    pub fn on_learner_speech(&mut self) -> Decision {
        match self.state {
            TeacherState::Speaking => {
                self.state = TeacherState::Idle;
                Decision::Interrupt
            }
            TeacherState::Idle => Decision::Ignore,
        }
    }
}
