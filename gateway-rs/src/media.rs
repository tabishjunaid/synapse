//! Audio framing/resampling + STT/TTS tier routing — Phase 1 seams.
//!
//! Kept as traits so the realtime path can be filled in incrementally without
//! reshaping the session loop. None of this is active while the client does
//! on-device STT and browser TTS (Phase 0); it comes online with the server-side
//! tiers (`tier switching` in the roadmap).

/// Resample/frame arbitrary client audio into the 16 kHz mono i16 frames the VAD
/// and STT expect. TODO(phase1): implement against the actual client codec
/// (likely Opus/WebM) — `symphonia` for decode, a windowed resampler for rate.
pub trait AudioFramer: Send {
    /// Push raw client audio bytes; drain any complete 16 kHz mono frames.
    fn push(&mut self, bytes: &[u8]) -> Vec<Vec<i16>>;
}

/// Server-side speech-to-text tier (e.g. faster-whisper / a hosted API), used
/// when the client lacks WebGPU. Emits finalized transcript text.
pub trait Stt: Send {
    fn feed(&mut self, frame: &[i16]);
    /// Returns finalized transcript text once an utterance closes.
    fn take_final(&mut self) -> Option<String>;
}

/// Server-side text-to-speech tier. The gateway relays the audio stream to the
/// client and must be able to cut it instantly on barge-in.
pub trait Tts: Send {
    /// Begin synthesizing `text`; chunks are pulled via `next_chunk`.
    fn speak(&mut self, text: &str);
    fn next_chunk(&mut self) -> Option<Vec<u8>>;
    /// Stop synthesis immediately (barge-in).
    fn cancel(&mut self);
}

/// Which tier a given connection negotiated. Drives `tier switching`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SttTier {
    /// Client did on-device STT and sends text frames — the Phase 0 path.
    OnDevice,
    /// Gateway terminates audio and runs server-side STT.
    Server,
}
