# Concept & Ideation — "Synapse": a virtual professor — **v5 (final, validated)**

> v5 changes from v4: per-module **Rust vs Python decisions** (§5a) — teaching service stays Python, audio gateway is the designated Rust component from Phase 1; **design-system refinements** (§5b) — design tokens as the per-pack theming unit, RTL-safe conventions from day one.
>
> v4 changes from v3: (1) removed the unsupported `effort: "low"` setting from the Haiku fast path — the effort parameter 400s on Haiku 4.5; (2) corrected the Nickow et al. figure to the published AERJ 2024 number (0.288 SD; the ~0.37 figure was from the 2020 NBER working paper); (3) added the incremental cache-write nuance. All other claims verified against the current Claude API reference and external sources.

## Context

A brand-new app that behaves like a **real 1:1 teacher** for any subject. The teacher:

- is deeply knowledgeable in the subject (knowledge sourced from vetted material + bounded web),
- **speaks** to the learner and **listens** to spoken answers,
- **asks questions**, gives **feedback**, and assigns **tasks**,
- **reads the learner's writing** (canvas/stylus input),
- **watches the learner through the camera** and senses engagement — steps in unprompted and **simplifies** when the learner is struggling,
- is a faithful **clone of how an expert human tutor adapts**.

**Decisions locked:**
- **Platform:** Web app (browser) first — camera + mic via `getUserMedia` (Media Capture API; WebRTC peer connections are *not* needed for single-user local capture).
- **Scope:** A **pluggable any-subject "teacher engine"**; each subject is a *knowledge pack*. **Language-agnostic** — the same engine teaches English improvement, Arabic, calculus, anything.
- **First pack (MVP): English improvement** — conversation fluency, writing feedback, vocabulary. Every modality (STT, TTS, recognition) has strong on-device support for English, so v1 ships with the cleanest privacy story. **Arabic is the second pack** and the deliberate stress test (RTL, diacritics, dialect choice, weaker on-device model support).
- **Build vs buy:** Integrate APIs, constrained to a **Claude-only license for the brain** (§5). Voice/camera modalities are open-source/on-device or commodity services — Claude has no audio modality.
- **Camera sensing:** Core MVP feature — as an **engagement heuristic**, not a confusion classifier (§3, §7).
- **Target learner:** Configurable (beginner → advanced), set at onboarding, refined by a placement diagnostic.
- **Privacy:** **Camera is strictly on-device — absolute rule.** Raw video never leaves the machine; only a derived engagement score does. **Audio and writing are tiered**: on-device preferred, cloud fallback disclosed.
- **Name:** **"Synapse"**. Runners-up: *Grove*, *Trellis*, *Bloom*. Final branding TBD.
- **Monetization:** out of scope — Phase 2.

---

## 1. The core idea in one sentence

> A real-time, multimodal AI tutor that **sees, hears, and reads** the learner, runs an
> **evidence-based pedagogy engine** that reproduces how an expert 1:1 tutor adapts, and
> **speaks + writes** back — driven by a swappable per-subject *knowledge pack* so the same
> engine can teach English, Arabic, calculus, or anything else.

Two layers: a generic **Teacher Engine** (sense→reason→act loop + learner model + pedagogy) and **Knowledge Packs** (per-subject curriculum, vetted knowledge, voice, exercises, capability requirements).

---

## 2. The teaching loop — Sense → Reason → Act

```
        ┌─────────────────────────  SENSE  ─────────────────────────┐
        │  Mic → STT (tiered: on-device → server)  — what was said   │
        │  Webcam → Face Landmarker (on-device,    — engagement      │
        │           strictly local)                   score only     │
        │  Canvas → stroke capture                 — what was written│
        │  Interaction signals                     — hesitation,     │
        │    latency, retries, "I don't get it"                      │
        └────────────────────────────┬──────────────────────────────┘
                                      ▼  (derived signals + text/strokes only)
        ┌──────────────  REASON (Teacher Brain = Claude)  ───────────┐
        │  • Learner model     (mastery per skill, error patterns)   │
        │  • Lesson planner    (mastery-gated skill graph)           │
        │  • Knowledge layer   (RAG over the pack's vetted corpus)   │
        │  • Pedagogy engine   (picks the next evidence-based move)  │
        │  • Affect fusion     (engagement + answer quality +        │
        │      latency → check in / simplify / slow down)            │
        └────────────────────────────┬──────────────────────────────┘
                                      ▼
        ┌─────────────────────────  ACT  ───────────────────────────┐
        │  Speech out → TTS (tiered: local voice → cloud voice)      │
        │  Whiteboard → text, script rendering, diagrams             │
        │  Tasks/exercises generated on the fly                      │
        └────────────────────────────────────────────────────────────┘
```

Streaming end-to-end; target round-trip **< ~1.5s** for conversational turns.

**Privacy boundary:** the **camera** stream is processed and discarded on-device — only an engagement score leaves the browser, ever. **Mic audio** is processed on-device when the hardware supports it; otherwise audio chunks go to *our* STT server (disclosed in-product), never to a third party. **Writing** is captured as stroke data and rendered to an image read by Claude vision.

---

## 3. The teaching method — grounded in learning science

North star: **Bloom's "2-sigma" finding** — stated honestly. Bloom (1984) reported ~2 SD gains from 1:1 tutoring + mastery learning. That figure came from two small dissertations, conflated tutoring with a higher mastery bar, and **never replicated**: VanLehn's (2011) meta-analysis puts human tutoring at **d ≈ 0.79** — and step-based intelligent tutoring systems at **d ≈ 0.76, nearly matching humans** — while field RCTs of real tutoring programs pool at **≈ 0.29 SD** (Nickow et al. 2024, AERJ; the earlier 2020 NBER working paper reported ~0.37). **We treat 2σ as the aspirational ceiling and d ≈ 0.8 as the realistic benchmark the evaluation loop is tuned against.** That an AI tutor can plausibly reach the human-tutor effect size is the actual evidence-backed pitch.

The engine composes these evidence-backed moves:

| Move | Why (evidence) | How Synapse does it |
|---|---|---|
| **Mastery learning** | Half of Bloom's effect; don't advance until the skill is genuinely mastered (≈90% bar). | Skill-graph **gates** progression. |
| **Retrieval practice** | One of only two "high-utility" techniques in Dunlosky et al. (2013, *PSPI*); replicated by Donoghue & Hattie (2021). | The teacher *asks*, the learner *recalls/produces* — not re-reads. |
| **Spaced practice** | The other "high-utility" technique; best long-term retention. | SRS schedule resurfaces past skills across sessions. |
| **Worked examples → faded practice** | Cognitive Load Theory: novices learn more from worked examples (Sweller & Cooper 1985); fade as expertise grows — expertise-reversal effect (Kalyuga et al. 2003). | "I do → we do → you do." Manage working-memory load explicitly. |
| **Formative assessment + feedback** | Hattie & Timperley (2007) d ≈ 0.79; conservative revision Wisniewski, Zierer & Hattie (2020) d ≈ 0.48. Directionally robust. | Constant low-stakes checks; specific, actionable feedback. |
| **Push up the ICAP ladder** | Learning rises Passive→Active→**Constructive→Interactive** (Chi & Wylie 2014). | Make the learner **explain back**, **produce**, **teach the concept**. |
| **Deliberate practice** | Targeted practice at the edge of ability with immediate feedback. | Drill the learner's *specific* weak spots. |

**The synthesis:** a **mastery-gated, tutoring-style dialogue** that keeps the learner at the Interactive/Constructive level, manages cognitive load, drives each concept to mastery, and schedules retrieval + spacing — wrapped in continuous formative feedback.

**The camera feature, honestly framed.** Inferring "confusion" from a face is not reliable. The camera signal is a **low-stakes engagement heuristic, fused** with answer quality and response latency — when the fused signal crosses a threshold, the teacher **asks** ("Want me to take that slower?") and applies the CLT response: drop to a worked example, simplify language, switch modality. The intervention is evidence-based; the trigger is humble. A wrong guess costs one polite question.

---

## 4. Knowledge — sourced safely

- **Offline ingestion (per pack):** curate vetted sources → chunk → embed → **RAG index**.
- **Bounded live web:** for current/edge questions the brain may call a web-search tool at teach-time; answers grounded and verified before being taught.
- **Verification pass:** lesson claims checked against the vetted corpus.

A **knowledge pack** is the unit of pluggability — including a **capability-tier declaration**:

```
knowledge-pack/
  pack.yaml         # capability requirements — STT tier (on-device ok /
                    #   server-large required), TTS tier (local ok / cloud-quality
                    #   required), script needs (RTL? diacritics?), handwriting needed?
  curriculum.yaml   # skill graph: prerequisites, ordering, mastery criteria (≈90%)
  corpus/           # vetted sources → embedded into the RAG index
  pedagogy.yaml     # methodology weights, pacing, age/level tuning
  persona.yaml      # teacher name, voice, personality, languages
  exercises/        # generators + grading rubrics
  assets/           # diagrams, fonts, audio samples
```

The engine reads `pack.yaml` at session start and selects the right rung of each modality ladder (§6). Teaching a new subject = authoring a pack; the engine is untouched.

**Arabic pack note (second pack):** spoken dialect + MSA for reading/writing mirrors real diglossia. Default dialect **Egyptian** with **Levantine as an equally defensible, planned alternative** (the academic integrated curricula, e.g. Younes/Cornell, pair MSA with Levantine). Configurable per learner.

---

## 5. Technology stack — Claude brain + tiered open modalities

Two constraints:

1. **Subscription boundary.** A Max plan covers **interactive** use — fine for **prototyping** (an `ant auth login` OAuth profile drives the SDK locally with no static key). A shipped **multi-user app** serves Claude programmatically and needs the **usage-based Anthropic API**. Budget for it at launch; nothing is blocked meanwhile.
2. **Claude's modalities.** Claude is **text + vision in, text out** — no native STT/TTS/realtime audio. Claude is the *brain*; voice and camera are separate on-device/open-source components.

### The stack (verified June 2026)

| Layer | Choice | Notes |
|---|---|---|
| **Teacher brain / planner** | **Claude Opus 4.8** (`claude-opus-4-8`) | Lesson planning, pedagogy decisions, rich feedback. `thinking: {type: "adaptive"}` + tool use. Runs *between* conversational turns — a high-effort Opus call does not fit the 1.5s speech budget. ($5/$25 per MTok. Fable 5, `claude-fable-5`, $10/$50, is the top tier above Opus if the brain ever needs the ceiling.) |
| **Fast turns** | **Claude Haiku 4.5** (`claude-haiku-4-5`) | In-round-trip calls: grading a short answer, quick hints, correctness checks. Streaming, small `max_tokens` to bound latency. **Note: the `effort` parameter is not supported on Haiku 4.5 (400)** — Haiku is the speed tier by construction; if explicit effort control is ever needed, that's Sonnet's job. ($1/$5 per MTok.) |
| **Mid tier (optional)** | **Claude Sonnet 4.6** (`claude-sonnet-4-6`) | Balance point when Opus is overkill; supports `effort: "low"` if a tunable in-loop model is wanted. ($3/$15.) |
| **Structured outputs** | `output_config.format` / strict tools | Learner-model updates (mastery scores, error tags) as guaranteed-valid JSON — no prose parsing. |
| **Cost control** | **Prompt caching** | Cache the curriculum + persona system prompt on the **Opus path** (caches are model-scoped — Haiku gets its own slim prompt). Reads ≈ 0.1×; default TTL **5 minutes** — pay the 1.25× write once per session, then ~0.1× per turn plus small incremental writes for newly appended turns (1-hour TTL at 2× write if sessions have gaps). Minimum cacheable prefix on Opus 4.8 is 4096 tokens — the curriculum prompt clears it; a slim Haiku prompt may not (fine — it silently won't cache). |
| **Capture** | **`getUserMedia`** (Media Capture API) + AudioWorklet | NOT WebRTC — no peer connections, signaling, or TURN needed for single-user local capture. Requires HTTPS. |
| **Speech-to-text** | **Tiered.** Tier 1: **transformers.js Whisper over WebGPU** in-browser (English tiny/base/small is genuinely good). Tier 2: **faster-whisper (large-v3-turbo) on our server**. | Pure-WASM CPU Whisper is 2–5× slower than real time — WebGPU is required for the on-device tier; a capability probe at session start picks the tier. Arabic needs large models (small zero-shot ≈ 50% WER; dialects hard even for large) → the Arabic pack declares `stt: server` in `pack.yaml`. |
| **Text-to-speech** | **Tiered.** Tier 1: browser `SpeechSynthesis` filtered on **`voice.localService === true`** (Chrome "Google" and Edge "Natural" voices are server-backed). Tier 2: cloud/quality TTS per pack. | English local voices acceptable for MVP. Packs needing pronunciation modeling (Arabic) declare `tts: cloud`. Self-hosted **Piper** (OHF-Voice/piper1-gpl, **GPL-3.0**) is a server-side option — GPL is fine when not distributed to the client. Arabic Piper coverage is ~1 voice — insufficient for a language product. |
| **Camera affect** | **MediaPipe Face Landmarker** (`@mediapipe/tasks-vision`), in-browser | Maintained successor to deprecated FaceMesh; 478 landmarks + **52 expression blendshapes** natively. Emits only an engagement score — raw frames never leave the device. Strictly on-device, no fallback tier. |
| **Writing input** | **Canvas stroke capture** → render strokes to image → **Claude vision** | On-device handwriting OCR (esp. Arabic) doesn't exist off-the-shelf in the browser — stroke capture sidesteps it. The rendered image goes to Claude (server), disclosed; typed input is always the fallback rung. |
| **Knowledge / RAG** | **Postgres + pgvector** | One vector index per pack. One database technology for both RAG and app state. |
| **Backend — teaching service** | **FastAPI (Python)** | Claude orchestration (official SDK), pedagogy engine, learner-model updates, RAG query, session/SRS CRUD. Permanently Python — it is SDK-bound to Claude. |
| **Backend — audio gateway** | **Rust (Axum + tokio)** from Phase 1; thin Python relay inside the FastAPI process for the Phase 0 spike | WebSocket termination, VAD (Silero via `ort`/ONNX), audio framing/resampling, STT routing, TTS stream relay, barge-in arbitration. Realtime guarantees (no GC jitter, per-connection memory) live here; it never touches the Claude SDK. |
| **Frontend** | **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** | Whiteboard + video tile + writing canvas + transcript. Design tokens as CSS variables, themeable per pack persona; **Tailwind logical properties only** (`ms-*`/`me-*`, `ps-*`/`pe-*`) for free RTL when the Arabic pack lands. |
| **Persistence** | **Postgres** | Learner model, mastery per skill, error patterns, SRS schedule, sessions. |

### 5a. Module language decisions — Rust vs Python

Decision rule: **Rust where the module needs realtime guarantees and doesn't touch the Claude SDK; Python where the module is SDK-bound, inference-glue, or offline.** There is no official Anthropic Rust SDK (official: Python, TS, Java, Go, Ruby, C#, PHP), and this stack leans on the newest API surface (adaptive thinking, `output_config.format`, prompt caching, strict tools) — so anything Claude-facing stays Python.

| Module | Language | Judgement |
|---|---|---|
| Teaching service (Claude orchestration, pedagogy engine, learner-model structured-output updates) | **Python** — permanent | Official SDK; prompt-iteration speed is the bottleneck, not CPU. Rewriting this in Rust is never justified. |
| Audio gateway (WS termination, VAD, framing, STT routing, TTS relay, barge-in) | **Rust** (Axum + tokio) from Phase 1 | The one module with realtime requirements: barge-in arbitration and audio framing want consistent tail latency and no GC pauses; per-connection memory matters at scale. Zero Claude dependency. Small, stable scope — cheap to own in Rust. |
| Phase 0 spike relay | **Python** (inside FastAPI) | The spike measures *model-dominated* latency (STT, Claude TTFT, TTS); the relay contributes single-digit ms either way. A ~200-line Python relay gets to the measurement fastest; the Rust gateway is built in Phase 1 against *known* requirements instead of guessed ones. |
| Server STT (faster-whisper large-v3-turbo) | **Python** — permanent | The engine is CTranslate2 (C++/CUDA); Python is glue with negligible overhead. Rust alternatives (whisper-rs, Candle) are less proven for streaming this model. |
| Server TTS (Piper, cloud-voice adapters) | **Python** | Same shape as STT: native inference engine, Python glue. |
| RAG ingestion pipeline (chunk → embed → index, per pack) | **Python** — permanent | Offline; ecosystem (loaders, embedding clients) is Python-native. Performance irrelevant. |
| Evaluation loop / analytics (pre/post quiz stats, retention rollups) | **Python** — permanent | Offline batch; pandas/stats territory. |
| Browser-side compute (Whisper WebGPU, Face Landmarker, SpeechSynthesis, canvas) | **TypeScript** (existing libs) | transformers.js and MediaPipe already ship the WASM/WebGPU runtimes. Custom Rust→WASM is reserved for one future case: bespoke browser DSP (e.g. echo-cancellation tuning for barge-in) if off-the-shelf falls short. |

Architectural commitment that makes this work: **gateway and teaching service are separate services from day one** (separate processes in production, separable modules in the Phase 0 monolith). The interface between them is a narrow message contract (transcript events in, speak/act events out) — so the Phase 1 Rust gateway replaces the Python relay without touching the brain.

### 5b. Design system

Keep **Tailwind + shadcn/ui** (copy-in ownership, Radix-grade a11y, CSS-variable theming). Full component libraries (Mantine/Chakra/HeroUI) were evaluated and rejected: Synapse's high-value UI (whiteboard, canvas, video tile, engagement indicator) is bespoke regardless — the design system only covers the chrome, so lock-in buys nothing. Watch item: the primitives ecosystem is shifting Radix → Base UI; shadcn's copy-in model keeps that migration contained.

Three disciplines from day one:

1. **Design-token layer** — color/typography/spacing/radius as CSS variables; the **pack persona is the theming unit**: `persona.yaml` carries a token override set (accent, display font, density) applied at session start. "Each teacher feels different" becomes data, not CSS forks.
2. **RTL-safe conventions now** — logical properties only, `dir` plumbed from the pack's script declaration, direction-sensitive icons audited from the start. Costs nothing today; saves the Arabic-pack retrofit.
3. **Typography as a pack capability** — fonts declared in `pack.yaml` assets (Arabic needs a Naskh-class face with correct diacritic rendering and line-height); the whiteboard renderer honors the pack's font stack.

### Latency budget (what runs where)

| Path | Budget | What |
|---|---|---|
| Inside the speech round-trip | < ~1.5s | STT (streaming partials) → **Haiku, streaming, small `max_tokens`** → TTS (streaming). Short grading/hint/ack turns. |
| Between turns (parallel) | seconds | **Opus 4.8, adaptive thinking**: next-move planning, exercise generation, learner-model update (structured output), RAG retrieval. Results ready before the learner finishes responding. |
| Session boundaries | async | Recap generation, SRS scheduling, mastery rollup. |

**Privacy story that falls out:** Claude only ever sees **derived signals + text + the writing image**. The camera stream never leaves the device, period. Audio leaves the device only on the server-STT tier, only to our backend, and the product says so.

---

## 6. The MVP — what v1 ships

A web app where a learner has a **live spoken lesson with the English-improvement teacher**, end to end:

1. **Onboarding + placement** — level selection; short diagnostic seeds the learner model and entry point in the skill graph.
2. **Live session** with voice in/out (tiered STT/TTS), camera sensing (on-device engagement score → check-in/simplify), writing canvas (strokes → Claude vision), whiteboard, mastery-gated tasks with retrieval + spaced review.
3. **Persistent learner model** — mastery per skill + error patterns + SRS schedule; next session resumes intelligently.
4. **Session recap** — covered, to-practise, next-time plan.
5. **One English knowledge pack** proving the pack format (incl. `pack.yaml` capability declaration) end to end.
6. **Evaluation loop (first-class)** — pre/post micro-quizzes per concept + cross-session retention checks, reported against the **d ≈ 0.8** benchmark.

**Graceful-degradation ladders (MVP requirement — the engine must teach acceptably at every rung):**

| Modality | Rung 1 | Rung 2 | Rung 3 |
|---|---|---|---|
| STT | On-device WebGPU Whisper | Server faster-whisper | Typed input |
| TTS | Local browser voice | Cloud voice | Text-only (captions) |
| Camera | Engagement score on | — | Camera off: interaction signals only |
| Writing | Canvas + Claude vision | — | Typed input |

**Failure modes handled in v1:** permission denied (fall to lower rung + explain); WebGPU absent or model download slow (server tier); network loss mid-session (local notice, resume); affect false positive (check-in phrasing makes a wrong guess cost nothing).

**Explicitly v2+:** monetization; talking-head avatar; the Arabic pack; mobile app; group/classroom mode; community pack marketplace.

---

## 7. Hardest problems

1. **Latency / "feels alive."** Streaming + barge-in. The latency budget table (§5) is the design answer; the Phase-0 spike proves it.
2. **Per-language on-device speech quality.** A *designed-for* constraint: packs declare their STT/TTS tiers; English MVP stays mostly on-device; Arabic ships server-tier audio with disclosure.
3. **Affect accuracy + consent.** Engagement heuristic + verbal check-in, never a silent trigger; camera strictly on-device; explicit consent; no raw-video storage.
4. **Teaching wrong things confidently.** RAG grounding + verification pass + citations in the lesson plan.
5. **Writing recognition.** Stroke capture + Claude vision (server). Revisit on-device recognizers when they mature.
6. **Cost & the subscription boundary.** Prototype on Max; launch on the API. Levers: prompt-cache the curriculum (Opus path), route in-round-trip turns to Haiku, structured outputs to avoid retry-parsing. §9 cost spike puts numbers on $/30-min session.
7. **Proving real learning gains.** The evaluation loop against d ≈ 0.8 — honest benchmark, falsifiable claim.

---

## 8. Phased roadmap

- **Phase 0 — Prototype the loop:** `getUserMedia` → tiered STT → Claude (streaming, Haiku fast path) → tiered TTS, plus Face Landmarker engagement score logged. Prove latency + the check-in trigger. **All-Python backend (single FastAPI process, gateway/brain kept as separable modules)** — fastest path to the latency gate.
- **Phase 1 — MVP (§6):** full English session, camera sensing, writing canvas, mastery-gated learner model + SRS, recap, evaluation loop. Single pack. **Extract the audio gateway into Rust (Axum + tokio)** against the requirements Phase 0 surfaced (barge-in, tier switching, reconnection); teaching service stays Python.
- **Phase 2 — Monetization + pack framework:** pricing/plans; formalize the pack spec (incl. capability tiers); author the **Arabic pack**.
- **Phase 3 — Richer presence:** talking-head avatar, pronunciation scoring, barge-in polish.
- **Phase 4 — Scale:** more packs, mobile app, community pack authoring, classroom mode.

---

## 9. De-risking spikes (gate the MVP on 1, 2, and 4)

1. **Latency spike:** WebGPU Whisper → Claude Haiku (streaming) → local TTS on a mid-range laptop, *and* the server-STT tier on a low-end one. Gate: conversation feels natural on both tiers.
2. **Affect spike:** Face Landmarker blendshapes → engagement score; eyeball engaged vs. disengaged sessions. Gate: usable as *one input* to the fused check-in trigger.
3. **Writing spike:** canvas strokes → rendered image → Claude vision feedback quality (English first; Arabic script as a stretch). Gate: feedback is specific and correct.
4. **Pedagogy spike:** script a 10-minute micro-lesson; Claude runs mastery + the check-in/simplify intervention on a confederate "struggling learner." Gate: feels like a tutor pitching in, *and* a tiny pre/post quiz shows a gain.
5. **Cost spike:** measure $/30-min session on the API with caching + Haiku routing (Opus 4.8 $5/$25, Haiku $1/$5 per MTok, cache reads ≈0.1×, 5-min TTL); confirm the subscription-vs-API boundary for the launch shape.

---

## Sources (corrected in v4)

- Bloom (1984), *The 2 Sigma Problem*, Educational Researcher 13(6) — [SAGE](https://journals.sagepub.com/doi/10.3102/0013189X013006004) · critical review: [Nintil](https://nintil.com/bloom-sigma/)
- VanLehn (2011), *The Relative Effectiveness of Human Tutoring, Intelligent Tutoring Systems, and Other Tutoring Systems*, Educational Psychologist 46(4) — human tutoring d ≈ 0.79; ITS d ≈ 0.76
- Nickow, Oreopoulos & Quan (2024), *The Promise of Tutoring for PreK–12 Learning*, AERJ 61(1) — pooled effect **0.288 SD** — [AERJ](https://journals.sagepub.com/doi/10.3102/00028312231208687) · earlier working paper (~0.37 SD): [NBER w27476 (2020)](https://www.nber.org/papers/w27476)
- Dunlosky et al. (2013), *Improving Students' Learning With Effective Learning Techniques*, PSPI 14(1) — [SAGE](https://journals.sagepub.com/doi/abs/10.1177/1529100612453266); replication: Donoghue & Hattie (2021) — [Frontiers](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2021.581216/full)
- Hattie & Timperley (2007), *The Power of Feedback*, RER 77(1) — d ≈ 0.79; revision: Wisniewski, Zierer & Hattie (2020) — d ≈ 0.48 — [PubMed](https://pubmed.ncbi.nlm.nih.gov/32038429/)
- Chi & Wylie (2014), *The ICAP Framework*, Educational Psychologist 49(4) — [DOI](https://www.tandfonline.com/doi/abs/10.1080/00461520.2014.965823)
- Sweller & Cooper (1985); Kalyuga, Ayres, Chandler & Sweller (2003), *The Expertise Reversal Effect*; Sweller, van Merriënboer & Paas (2019), EPR 31
- MediaPipe Face Landmarker — [guide](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)
- Whisper in-browser: [whisper.cpp WASM](https://ggml.ai/whisper.cpp/stream.wasm/) · [realtime WebGPU demo](https://huggingface.co/spaces/Xenova/realtime-whisper-webgpu)
- `SpeechSynthesisVoice.localService` — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService) · Piper continuation: [OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl) (GPL-3.0)
- `getUserMedia` / Media Capture and Streams — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) · [W3C](https://www.w3.org/TR/mediacapture-streams/)
