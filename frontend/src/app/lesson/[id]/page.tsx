"use client";

// A lesson session — the existing voice/chat loop, now directed at a specific
// lesson's objectives. Text-first (works with no mic); voice is opt-in.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Spinner } from "@/components/ui/Spinner";
import { completeLesson, getLesson, getLessonQuiz, submitPreQuiz } from "@/lib/api";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { SHAPE_LABEL } from "@/lib/lessonMeta";
import type { CompletionResult, LessonDetail } from "@/lib/types";
import { useSpikeSession } from "@/lib/useSpikeSession";

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, levelRef, connect, loadStt, startMic, stopMic, sendTyped } = useSpikeSession({
    lessonId: id,
  });

  const [detail, setDetail] = useState<LessonDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<CompletionResult | null>(null);
  // A short pre-quiz gates the lesson so we can measure pre→post learning gain.
  const [stage, setStage] = useState<"loading" | "prequiz" | "lesson">("loading");
  const [quiz, setQuiz] = useState<{ id: string; prompt: string }[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const kicked = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load the lesson + its pre-quiz; mastered lessons skip straight to chat.
  useEffect(() => {
    getLesson(id)
      .then((d) => {
        setDetail(d);
        if (d.lesson.status === "mastered") {
          setStage("lesson");
          return;
        }
        getLessonQuiz(id)
          .then((q) => {
            setQuiz(q.questions);
            setStage(q.questions.length > 0 ? "prequiz" : "lesson");
          })
          .catch(() => setStage("lesson"));
      })
      .catch((e) => setLoadError(String(e.message ?? e)));
  }, [id]);

  // Connect the WS only once the learner is in the lesson (past the pre-quiz).
  useEffect(() => {
    if (stage === "lesson") connect();
  }, [stage, connect]);

  // The teacher drives: kick off the lesson once connected.
  useEffect(() => {
    if (stage === "lesson" && state.wsStatus === "connected" && !kicked.current) {
      kicked.current = true;
      sendTyped("Hi, I'm ready — please begin this lesson.");
    }
  }, [stage, state.wsStatus, sendTyped]);

  async function startLesson(skip: boolean) {
    if (!skip) {
      try {
        await submitPreQuiz(
          id,
          quiz.map((q) => ({ question: q.prompt, answer: quizAnswers[q.id] ?? "" })),
        );
      } catch {
        /* pre-quiz is best-effort; don't block the lesson on it */
      }
    }
    setStage("lesson");
  }

  // Start the mic once the STT model is ready (after the user opts into voice).
  useEffect(() => {
    if (voiceOn && state.sttStatus === "ready" && state.micStatus === "off") startMic();
  }, [voiceOn, state.sttStatus, state.micStatus, startMic]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state.turns]);

  async function checkUnderstanding() {
    setGrading(true);
    const transcript = state.turns.flatMap((t) => [
      { role: "user", content: t.learnerText },
      { role: "assistant", content: t.teacherText },
    ]).filter((m) => m.content.trim());
    try {
      setResult(await completeLesson(id, transcript));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setGrading(false);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-danger">{loadError}</p>
        <Link href="/course"><Button variant="secondary">Back to course</Button></Link>
      </main>
    );
  }
  if (!detail || stage === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6 text-accent" />
      </main>
    );
  }

  if (stage === "prequiz") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6">
        <header>
          <p className="text-xs text-muted-foreground">{detail.lesson.title}</p>
          <h1 className="text-2xl font-semibold">Before we start — what do you already know?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A quick check so we can measure how much you learn. Answer what you can, or skip.
          </p>
        </header>
        <Card>
          <CardBody className="flex flex-col gap-4">
            {quiz.map((q, i) => (
              <Field key={q.id} label={`${i + 1}. ${q.prompt}`}>
                <Textarea
                  value={quizAnswers[q.id] ?? ""}
                  onChange={(e) => setQuizAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="Your answer (optional)"
                />
              </Field>
            ))}
            <div className="flex gap-2">
              <Button size="lg" className="flex-1" onClick={() => startLesson(false)}>
                Start the lesson
              </Button>
              <Button variant="secondary" size="lg" onClick={() => startLesson(true)}>
                Skip
              </Button>
            </div>
          </CardBody>
        </Card>
      </main>
    );
  }

  const lesson = detail.lesson;
  const exchanges = state.turns.filter((t) => t.id > 1 || t.teacherText).length;

  return (
    <main className="mx-auto flex h-screen max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <Link href="/course" className="text-xs text-muted-foreground hover:underline">
          ← {detail.course_title}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{detail.module.title}</p>
            <h1 className="text-xl font-semibold">{lesson.title}</h1>
          </div>
          <Badge tone="muted">{SHAPE_LABEL[lesson.shape]}</Badge>
        </div>
        {lesson.objectives.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {lesson.objectives.map((o, i) => (
              <li key={i} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                <span aria-hidden="true">◯</span> {o}
              </li>
            ))}
          </ul>
        )}
        {lesson.skills.length > 0 && (
          <LiveMastery skills={lesson.skills} mastery={state.live.mastery} />
        )}
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-[var(--radius-card)] border border-border bg-surface p-4"
      >
        {state.turns.map((turn) => (
          <div key={turn.id} className="space-y-2">
            {turn.learnerText && turn.id > 1 && (
              <Bubble who="you">{turn.learnerText}</Bubble>
            )}
            {turn.teacherText && (
              <Bubble who="teacher">
                {turn.teacherText}
                {!turn.done && <span className="animate-pulse" aria-hidden="true"> ▍</span>}
              </Bubble>
            )}
          </div>
        ))}
        {state.turns.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {state.wsStatus === "connected" ? "Starting the lesson…" : "Connecting…"}
          </p>
        )}
      </div>

      {result ? (
        <CompletionCard result={result} onNext={() => router.push("/course")} />
      ) : (
        <div className="flex flex-col gap-2">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) {
                sendTyped(typed.trim());
                setTyped("");
              }
            }}
          >
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type your answer…"
              aria-label="Type your answer"
              className="flex-1"
            />
            <Button type="submit" disabled={!typed.trim()}>Send</Button>
          </form>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {!voiceOn ? (
                <Button variant="secondary" size="sm" onClick={() => { setVoiceOn(true); loadStt(); }}>
                  <span aria-hidden="true">🎤</span> Use voice
                </Button>
              ) : state.micStatus === "on" ? (
                <Button variant="secondary" size="sm" onClick={() => { stopMic(); setVoiceOn(false); }}>
                  <span aria-hidden="true">◼</span> Stop voice
                </Button>
              ) : (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner className="size-3" /> loading speech…
                </span>
              )}
              {state.micStatus === "on" && <LevelMeter levelRef={levelRef} />}
            </div>
            <div className="flex items-center gap-2">
              {state.live.readyToCheck && !grading && (
                <Badge tone="success">Ready to check ✓</Badge>
              )}
              <Button
                onClick={checkUnderstanding}
                disabled={grading || exchanges < 2}
                className={state.live.readyToCheck && !grading ? "ring-2 ring-success/50" : undefined}
              >
                {grading ? <><Spinner className="size-4" /> Assessing…</> : "Check my understanding"}
              </Button>
            </div>
          </div>
          {state.error && <p className="text-xs text-warning">{state.error}</p>}
        </div>
      )}
    </main>
  );
}

// Live learner model — fills in as the between-turns planner re-estimates mastery
// mid-lesson (every few turns), so progress is visible before the final check.
function LiveMastery({
  skills,
  mastery,
}: {
  skills: { id: string; name: string }[];
  mastery: Record<string, number>;
}) {
  const seen = skills.some((s) => mastery[s.id] != null);
  return (
    <div className="mt-1 space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Live mastery {seen ? "" : "· updates as you go"}
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {skills.map((s) => {
          const m = mastery[s.id] ?? 0;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">{s.name}</span>
              <Progress value={m} />
              <span className="w-8 shrink-0 text-end text-[10px] text-muted-foreground">
                {Math.round(m * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Bubble({ who, children }: { who: "you" | "teacher"; children: React.ReactNode }) {
  const mine = who === "you";
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm " +
          (mine
            ? "bg-accent text-accent-foreground rounded-ee-sm"
            : "bg-card border border-border rounded-es-sm")
        }
      >
        {!mine && <span className="mb-0.5 block text-xs font-medium text-muted-foreground">Teacher</span>}
        {children}
      </div>
    </div>
  );
}

function CompletionCard({ result, onNext }: { result: CompletionResult; onNext: () => void }) {
  return (
    <Card className={result.passed ? "border-success/40" : "border-warning/40"}>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={result.passed ? "success" : "warning"}>
            {result.passed ? "Lesson mastered ✓" : "Keep practising"}
          </Badge>
          {result.gain != null && (
            <Badge tone={result.gain > 0 ? "success" : "muted"}>
              learning gain {result.gain >= 0 ? "+" : ""}
              {Math.round(result.gain * 100)}% (pre {Math.round((result.pre_score ?? 0) * 100)}% →
              post {Math.round((result.post_score ?? 0) * 100)}%)
            </Badge>
          )}
        </div>
        <div className="space-y-1 text-sm">
          {result.recap.covered && <p><span className="text-muted-foreground">Covered:</span> {result.recap.covered}</p>}
          {result.recap.to_practise && <p><span className="text-muted-foreground">To practise:</span> {result.recap.to_practise}</p>}
          {result.recap.next_time && <p><span className="text-muted-foreground">Next time:</span> {result.recap.next_time}</p>}
        </div>
        <div className="space-y-1.5">
          {result.skills.map((s) => (
            <div key={s.skill_id} className="flex items-center gap-2">
              <span className="w-40 shrink-0 truncate text-xs">{s.name}</span>
              <Progress value={s.mastery} />
              <span className="w-9 shrink-0 text-end text-xs text-muted-foreground">
                {Math.round(s.mastery * 100)}%
              </span>
            </div>
          ))}
        </div>
        <Button onClick={onNext} className="w-full">
          {result.passed && result.next_lesson_id ? "Continue to next lesson →" : "Back to course"}
        </Button>
      </CardBody>
    </Card>
  );
}

function LevelMeter({ levelRef }: { levelRef: React.RefObject<number> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (ref.current) ref.current.style.inlineSize = `${Math.min(100, (levelRef.current / 0.15) * 100)}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);
  return (
    <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
      <div ref={ref} className="h-full bg-success" />
    </div>
  );
}
