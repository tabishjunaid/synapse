# Graph Report - synapse  (2026-06-13)

## Corpus Check
- 142 files · ~50,164 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 759 nodes · 1560 edges · 59 communities (47 shown, 12 thin omitted)
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 300 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e0e2b28a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]

## God Nodes (most connected - your core abstractions)
1. `GoalSpec` - 40 edges
2. `Lesson` - 37 edges
3. `CoursePlan` - 31 edges
4. `get_settings()` - 26 edges
5. `Goal` - 26 edges
6. `Course` - 24 edges
7. `build_backend()` - 23 edges
8. `CorpusChunk` - 22 edges
9. `LearnerState` - 19 edges
10. `QuizQuestion` - 18 edges

## Surprising Connections (you probably didn't know these)
- `_fake_generate()` --calls--> `_assign_ids()`  [INFERRED]
  backend/tests/test_courses.py → backend/synapse_backend/brain/planner.py
- `Lesson` --uses--> `Lesson`  [INFERRED]
  backend/synapse_backend/brain/writing.py → backend/synapse_backend/brain/schemas.py
- `ndarray` --uses--> `CorpusChunk`  [INFERRED]
  backend/synapse_backend/stores/vectors.py → backend/synapse_backend/stores/documents.py
- `TeacherSession` --uses--> `Usage`  [INFERRED]
  backend/synapse_backend/brain/teacher.py → backend/synapse_backend/brain/backends.py
- `LLMBackend` --uses--> `Usage`  [INFERRED]
  backend/synapse_backend/brain/teacher.py → backend/synapse_backend/brain/backends.py

## Import Cycles
- 1-file cycle: `backend/synapse_backend/courses.py -> backend/synapse_backend/courses.py`
- 1-file cycle: `backend/synapse_backend/main.py -> backend/synapse_backend/main.py`
- 1-file cycle: `backend/synapse_backend/stores/documents.py -> backend/synapse_backend/stores/documents.py`
- 1-file cycle: `gateway-rs/src/main.rs -> gateway-rs/src/main.rs`

## Communities (59 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.20
Nodes (10): BetweenTurnsUpdate, Brain, Brain, LLMBackend, OpenAICompatBackend, Yield text deltas, then exactly one final ``Usage``., One-shot structured generation — returns parsed JSON (not streamed).          Us, Streams from an OpenAI-compatible chat-completions endpoint.      Works against (+2 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (22): dependencies, @huggingface/transformers, next, react, react-dom, devDependencies, eslint, eslint-config-next (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (11): ClientEvent, ResetEvent, ServerError, ServerEvent, SpeakDelta, TranscriptEvent, TurnEnd, TurnLatency (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (39): WebSocket, BaseModel, Grounding, Pacing, Recap, add_corpus(), complete(), CompleteRequest (+31 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (16): 1. The core idea in one sentence, 2. The teaching loop — Sense → Reason → Act, 3. The teaching method — grounded in learning science, 4. Knowledge — sourced safely, 5. Technology stack — Claude brain + tiered open modalities, 5a. Module language decisions — Rust vs Python, 5b. Design system, 6. The MVP — what v1 ships (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (58): CoursePlan, GoalSpec, QuizQuestion, CoursePlan, datetime, GoalSpec, Lesson, QuizQuestion (+50 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (10): `anthropic` — Claude, the product's real brain, Layout, `local` (default) — free, no API key, Phase 0 — the latency spike, Run the backend, Run the frontend, Synapse, The classroom — immersive lecture-hall view (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 9 - "Community 9"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (13): cn(), CompletionResult, LessonDetail, LEVELS, Question, Card(), CardBody(), Field() (+5 more)

### Community 14 - "Community 14"
Cohesion: 0.21
Nodes (10): Arc, Config, eslintConfig, IntoResponse, Result, healthz(), main(), ws_handler() (+2 more)

### Community 21 - "Community 21"
Cohesion: 0.17
Nodes (12): CaptionStrip(), CaptionStripProps, EngagementCheckIn(), EngagementCheckInProps, ClassroomPage(), OrbMode, Phase, WritingCanvas() (+4 more)

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (20): px(), py(), SkillConstellation(), Star(), Diagram(), drawn(), Whiteboard(), WhiteboardProps (+12 more)

### Community 23 - "Community 23"
Cohesion: 0.09
Nodes (46): Course, _cached_artifact(), complete_lesson(), constellation(), corpus_stats(), course_view(), create_goal(), current_course() (+38 more)

### Community 24 - "Community 24"
Cohesion: 0.05
Nodes (51): Any, AsyncMongoClient, Embedder, make_embedder(), Embeddings for RAG — pluggable, default local & free via Ollama.  Mirrors the LL, _chunk(), ground(), _hard_window() (+43 more)

### Community 26 - "Community 26"
Cohesion: 0.31
Nodes (4): PresenceOrb(), PresenceOrbProps, ringStyle(), usePrefersReducedMotion()

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (3): fake_backend(), FakeBackend, Planner: structured course generation + tolerant parsing, no live model.

### Community 29 - "Community 29"
Cohesion: 0.31
Nodes (5): DeepenText(), PackSwitcher(), PackSwitcherProps, Persona, useDismissable()

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (6): DebugHUD(), DebugHUDProps, RungIndicator(), RungIndicatorProps, SpikeState, Turn

### Community 31 - "Community 31"
Cohesion: 0.15
Nodes (15): Home(), CoursePage(), SHAPE_LABEL, STATUS_LABEL, STATUS_TONE, CourseView, GoalSpec, LessonShape (+7 more)

### Community 33 - "Community 33"
Cohesion: 0.47
Nodes (4): _course(), Spaced-review scheduling + due computation (pure, no DB)., test_due_review_excludes_current_lesson(), test_due_review_names_only_past_due_mastered()

### Community 36 - "Community 36"
Cohesion: 0.21
Nodes (18): completeLesson(), createGoal(), generateCourse(), getBoard(), getConstellation(), getCourse(), getGlossary(), getKnowledgePacks() (+10 more)

### Community 37 - "Community 37"
Cohesion: 0.13
Nodes (11): LessonPage(), useSpikeSession(), SpikePage(), Badge(), Tone, TONES, Button(), Size (+3 more)

### Community 38 - "Community 38"
Cohesion: 0.19
Nodes (9): BaseSettings, Settings, _patch(), make_backend() dispatch — verifies each brain builds the right backend with the, test_active_model_tracks_brain(), test_deepseek_backend(), test_hosted_backend_without_key_fails_fast(), test_local_is_default() (+1 more)

### Community 39 - "Community 39"
Cohesion: 0.20
Nodes (12): String, String, WebSocket, Option, Protocol, ClientEvent, LearnerSkill, parse_client() (+4 more)

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (8): board(), constellation(), glossary(), REST endpoints powering the immersive Classroom view.  Backs the components that, (course, module, lesson, state) for the current learner, or 404., _resolve(), writing_check(), WritingCheckRequest

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (12): Lesson, AnthropicBackend, Streams from Claude via the official Anthropic SDK.      Auth resolves the SDK's, generate_quiz(), grade_quiz(), Score 0..1 of objective mastery from quiz answers., build_backend(), make_backend() (+4 more)

### Community 42 - "Community 42"
Cohesion: 0.23
Nodes (6): computeRms(), concat(), DEFAULT_VAD, UtteranceHandler, UtteranceSegmenter, VadConfig

### Community 43 - "Community 43"
Cohesion: 0.23
Nodes (8): Lesson, generate_board(), generate_glossary(), Generators for the immersive classroom: whiteboard board + tap-to-deepen glossar, Only pass through a complete, well-formed-looking <math> element., _safe_mathml(), Pre/post micro-quizzes — the falsifiable 'did it teach?' signal.  A short quiz o, The teaching brain — conversation state + the fast path.  Phase 0 ships the fast

### Community 47 - "Community 47"
Cohesion: 0.25
Nodes (6): FakeEmbedder, Corpus ingestion → grounding round-trip, against a test Mongo.  The embedder is, test_corpus_stats_and_delete(), test_ingest_explicit_pack_scope(), test_ingest_then_ground_round_trip(), test_ingest_unknown_goal_returns_none()

### Community 48 - "Community 48"
Cohesion: 0.24
Nodes (6): Lesson, extract_json(), Pluggable LLM backends for the teaching brain.  The brain is transport-agnostic, Best-effort parse of a model's JSON reply (tolerates ```json fences/prose)., check_writing(), Writing-canvas review — the learner draws/writes; the professor reads it.  The c

### Community 49 - "Community 49"
Cohesion: 0.24
Nodes (5): Default, Self, BargeIn, Decision, TeacherState

### Community 50 - "Community 50"
Cohesion: 0.24
Nodes (6): Default, Self, Send, EnergyVad, Speech, Vad

### Community 51 - "Community 51"
Cohesion: 0.33
Nodes (8): BetweenTurnsUpdate, Lesson, _format_transcript(), plan_between_turns(), The between-turns planner — the live, stronger-model coach.  Phase 1's between-t, Re-read the live session into a learner-model update + focus steer.      Best-ef, BetweenTurnsUpdate, The between-turns planner's live re-read of the running session.      Produced o

### Community 52 - "Community 52"
Cohesion: 0.28
Nodes (4): Re-read the live session on the planner brain, every `coach_cadence`         tur, Run one in-round-trip turn. Yields text deltas, then a final TurnResult., One learner's conversation state + the fast path.      `system` defaults to the, TeacherSession

### Community 54 - "Community 54"
Cohesion: 0.48
Nodes (6): Lesson, assess_lesson(), _format_transcript(), Lesson assessment — score each skill from the session transcript.  A structured, LessonAssessment, LessonAssessment

### Community 55 - "Community 55"
Cohesion: 0.38
Nodes (5): Between-turns planner: cadence, focus injection, live learner-model updates.  Th, _session(), test_coach_runs_only_on_cadence(), test_focus_folds_into_next_system_prompt(), test_no_coach_without_lesson()

### Community 56 - "Community 56"
Cohesion: 0.47
Nodes (5): Send, AudioFramer, Stt, SttTier, Tts

### Community 57 - "Community 57"
Cohesion: 0.40
Nodes (4): Architecture, Build & run, Next steps (Phase 1), synapse-gateway (Rust, Axum + tokio)

### Community 58 - "Community 58"
Cohesion: 0.40
Nodes (3): Self, String, Config

## Knowledge Gaps
- **116 isolated node(s):** `Any`, `AsyncMongoClient`, `eslintConfig`, `nextConfig`, `name` (+111 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GoalSpec` connect `Community 6` to `Community 27`, `Community 4`, `Community 47`, `Community 23`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `Lesson` connect `Community 6` to `Community 0`, `Community 4`, `Community 41`, `Community 43`, `Community 48`, `Community 51`, `Community 52`, `Community 54`, `Community 23`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `get_settings()` connect `Community 24` to `Community 6`, `Community 38`, `Community 41`, `Community 43`, `Community 48`, `Community 51`, `Community 52`, `Community 54`, `Community 23`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `GoalSpec` (e.g. with `CoursePlan` and `GoalSpec`) actually correct?**
  _`GoalSpec` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Are the 26 inferred relationships involving `Lesson` (e.g. with `BetweenTurnsUpdate` and `Lesson`) actually correct?**
  _`Lesson` has 26 INFERRED edges - model-reasoned connections that need verification._
- **Are the 27 inferred relationships involving `CoursePlan` (e.g. with `CoursePlan` and `GoalSpec`) actually correct?**
  _`CoursePlan` has 27 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Pluggable LLM backends for the teaching brain.  The brain is transport-agnostic`, `Yield text deltas, then exactly one final ``Usage``.`, `One-shot structured generation — returns parsed JSON (not streamed).          Us` to the rest of the system?**
  _199 weakly-connected nodes found - possible documentation gaps or missing edges._