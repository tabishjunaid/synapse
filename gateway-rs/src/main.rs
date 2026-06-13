//! Synapse audio gateway — Phase 1 (Rust, Axum + tokio).
//!
//! Replaces the Phase 0 Python relay (`backend/.../gateway/ws.py`) behind the
//! same client protocol. The realtime concerns the concept doc assigns to Rust
//! — WS termination, VAD, audio framing, STT/TTS tiering, barge-in — live here;
//! the teaching brain stays in Python upstream and is never touched.
//!
//! First increment (this crate): WS termination + a transparent protocol proxy
//! to the Python brain, with the audio modules scaffolded as typed seams.

// The audio-path modules are scaffolds with seams not yet on the hot path.
#![allow(dead_code)]

mod barge_in;
mod config;
mod media;
mod protocol;
mod session;
mod vad;

use std::sync::Arc;

use axum::{
    extract::{State, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use tracing_subscriber::EnvFilter;

use config::Config;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("synapse_gateway=info")),
        )
        .init();

    let cfg = Arc::new(Config::from_env());
    tracing::info!(bind = %cfg.bind, brain = %cfg.brain_ws, "starting synapse gateway");

    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/ws/session", get(ws_handler))
        .with_state(cfg.clone());

    let listener = tokio::net::TcpListener::bind(&cfg.bind).await?;
    tracing::info!("listening on {}", cfg.bind);
    axum::serve(listener, app).await?;
    Ok(())
}

async fn healthz() -> impl IntoResponse {
    Json(serde_json::json!({"ok": true, "service": "synapse-gateway"}))
}

async fn ws_handler(ws: WebSocketUpgrade, State(cfg): State<Arc<Config>>) -> impl IntoResponse {
    let brain = cfg.brain_ws.clone();
    ws.on_upgrade(move |socket| session::handle(socket, brain))
}
