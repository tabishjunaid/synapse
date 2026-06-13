//! One client connection: terminate the client WS, dial the Python brain WS, and
//! pump the protocol both ways.
//!
//! This is the Phase 1 extraction's first increment: the gateway now *owns* the
//! client connection (the seam the audio path, VAD, barge-in, and tier switching
//! grow into) while the brain — fast path + between-turns planner — stays in
//! Python upstream, untouched, behind the same JSON contract.
//!
//! Today frames are forwarded verbatim; the barge-in arbiter already observes
//! turn boundaries so the interrupt path can be wired without reshaping the loop.

use axum::extract::ws::{Message as AxumMsg, WebSocket};
use futures_util::{SinkExt, StreamExt};
use std::sync::{Arc, Mutex};
use tokio_tungstenite::tungstenite::Message as TungMsg;

use crate::barge_in::{BargeIn, Decision};
use crate::protocol::{parse_client, parse_server, ClientEvent, ServerEvent};

pub async fn handle(mut client: WebSocket, brain_ws: String) {
    let upstream = match tokio_tungstenite::connect_async(brain_ws.as_str()).await {
        Ok((stream, _resp)) => stream,
        Err(err) => {
            tracing::error!(%err, url = %brain_ws, "brain upstream unreachable");
            let body = serde_json::to_string(&ServerEvent::Error {
                message: "gateway: brain upstream unavailable".into(),
            })
            .unwrap_or_else(|_| "{\"type\":\"error\",\"message\":\"gateway\"}".into());
            let _ = client.send(AxumMsg::Text(body)).await;
            return;
        }
    };

    let (mut client_tx, mut client_rx) = client.split();
    let (mut up_tx, mut up_rx) = upstream.split();
    let arbiter = Arc::new(Mutex::new(BargeIn::default()));

    // client -> brain
    let a_in = arbiter.clone();
    let mut c2b = tokio::spawn(async move {
        while let Some(Ok(msg)) = client_rx.next().await {
            match msg {
                AxumMsg::Text(text) => {
                    if let Some(ClientEvent::Transcript { .. }) = parse_client(&text) {
                        if a_in.lock().unwrap().on_learner_speech() == Decision::Interrupt {
                            // TODO(phase1): cut the outbound TTS stream and signal
                            // the brain to abandon the in-flight turn.
                            tracing::debug!("barge-in: learner spoke during teacher turn");
                        }
                    }
                    if up_tx.send(TungMsg::Text(text)).await.is_err() {
                        break;
                    }
                }
                AxumMsg::Binary(bytes) => {
                    // Phase 1 audio path: frame -> VAD -> STT lives here. Forward
                    // for now so a binary-capable client still round-trips.
                    if up_tx.send(TungMsg::Binary(bytes)).await.is_err() {
                        break;
                    }
                }
                AxumMsg::Close(_) => {
                    let _ = up_tx.send(TungMsg::Close(None)).await;
                    break;
                }
                _ => {}
            }
        }
    });

    // brain -> client
    let a_out = arbiter.clone();
    let mut b2c = tokio::spawn(async move {
        while let Some(Ok(msg)) = up_rx.next().await {
            match msg {
                TungMsg::Text(text) => {
                    match parse_server(&text) {
                        Some(ServerEvent::TurnStart { .. }) => {
                            a_out.lock().unwrap().on_server_turn_start()
                        }
                        Some(ServerEvent::TurnEnd { .. }) => {
                            a_out.lock().unwrap().on_server_turn_end()
                        }
                        _ => {}
                    }
                    if client_tx.send(AxumMsg::Text(text)).await.is_err() {
                        break;
                    }
                }
                TungMsg::Binary(bytes) => {
                    if client_tx.send(AxumMsg::Binary(bytes)).await.is_err() {
                        break;
                    }
                }
                TungMsg::Close(_) => {
                    let _ = client_tx.send(AxumMsg::Close(None)).await;
                    break;
                }
                _ => {}
            }
        }
    });

    // Either side closing tears down the other.
    tokio::select! {
        _ = &mut c2b => b2c.abort(),
        _ = &mut b2c => c2b.abort(),
    }
}
