//! Gateway configuration, read once from the environment at startup.
//!
//! Mirrors the Python side's `SYNAPSE_`-prefixed convention so the two services
//! share one mental model. Everything has a dev-friendly default.

use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    /// Address the gateway binds (client-facing WS + healthz).
    pub bind: String,
    /// Upstream Python brain WebSocket. The gateway proxies the protocol here;
    /// the brain (fast path + between-turns planner) stays in Python.
    pub brain_ws: String,
    /// CORS / origin note is handled by the brain today; kept here for parity.
    pub frontend_origin: String,
}

impl Config {
    pub fn from_env() -> Self {
        Config {
            bind: env::var("SYNAPSE_GATEWAY_BIND").unwrap_or_else(|_| "0.0.0.0:8770".into()),
            brain_ws: env::var("SYNAPSE_BRAIN_WS")
                .unwrap_or_else(|_| "ws://127.0.0.1:8765/ws/session".into()),
            frontend_origin: env::var("SYNAPSE_FRONTEND_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
        }
    }
}
