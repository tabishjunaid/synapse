//! Voice-activity detection — a Phase 1 audio responsibility.
//!
//! In Phase 0, STT runs on-device (WebGPU Whisper) and the client sends finalized
//! `transcript` frames, so the gateway never sees audio. Phase 1 adds a
//! server-side STT tier for clients without WebGPU; when that path is active the
//! gateway terminates raw audio and must detect speech boundaries itself.
//!
//! The concept doc designates **Silero VAD via `ort`/ONNX** for this. That model
//! is not wired yet; this trait is the seam it plugs into, with a trivial
//! energy-gate placeholder so the pipeline type-checks end-to-end.

/// A speech-boundary decision for one audio frame.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Speech {
    /// Speech is ongoing.
    Active,
    /// Silence — and long enough to count as end-of-utterance.
    EndOfUtterance,
    /// Silence, but not yet long enough to finalize.
    Idle,
}

pub trait Vad: Send {
    /// Feed one 16 kHz mono PCM frame; get a speech-boundary decision.
    fn push(&mut self, frame: &[i16]) -> Speech;
    fn reset(&mut self);
}

/// Placeholder energy-gate VAD. Real deployments swap in `SileroVad` (ONNX).
/// Tuned conservatively; it exists to exercise the seam, not to ship.
pub struct EnergyVad {
    threshold: i64,
    silence_frames: u32,
    end_after: u32,
}

impl Default for EnergyVad {
    fn default() -> Self {
        // ~600 ms of silence at 30 ms frames ends an utterance.
        EnergyVad { threshold: 500, silence_frames: 0, end_after: 20 }
    }
}

impl Vad for EnergyVad {
    fn push(&mut self, frame: &[i16]) -> Speech {
        if frame.is_empty() {
            return Speech::Idle;
        }
        let energy = frame.iter().map(|s| (*s as i64).abs()).sum::<i64>() / frame.len() as i64;
        if energy >= self.threshold {
            self.silence_frames = 0;
            Speech::Active
        } else {
            self.silence_frames += 1;
            if self.silence_frames >= self.end_after {
                Speech::EndOfUtterance
            } else {
                Speech::Idle
            }
        }
    }

    fn reset(&mut self) {
        self.silence_frames = 0;
    }
}

// TODO(phase1): `SileroVad { session: ort::Session }` implementing `Vad` by
// running the Silero ONNX graph per frame. Gate behind a `silero` cargo feature
// so the energy placeholder stays the zero-dependency default.
