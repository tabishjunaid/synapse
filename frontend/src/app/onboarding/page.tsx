"use client";

// Goal intake → the teacher drafts a syllabus. The first step that makes Synapse
// a teacher rather than a chat box: it asks what you want before teaching.

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { createGoal, generateCourse, getPlacement } from "@/lib/api";
import type { GoalSpec, Level } from "@/lib/types";

const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

type Question = { id: string; prompt: string };

export default function OnboardingPage() {
  const router = useRouter();
  const [spec, setSpec] = useState<GoalSpec>({
    subject: "",
    target_outcome: "",
    level: "beginner",
    minutes_per_week: 120,
    horizon: "6 weeks",
    motivation: "",
  });
  const [phase, setPhase] = useState<"form" | "placement" | "generating">("form");
  const [error, setError] = useState<string | null>(null);
  const [goalId, setGoalId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const set = <K extends keyof GoalSpec>(k: K, v: GoalSpec[K]) =>
    setSpec((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("generating");
    try {
      const { goal_id } = await createGoal(spec);
      setGoalId(goal_id);
      const { questions } = await getPlacement(goal_id);
      if (questions.length > 0) {
        setQuestions(questions);
        setPhase("placement");
      } else {
        await generateCourse(goal_id);
        router.push("/course");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("form");
    }
  }

  async function finishPlacement(skip: boolean) {
    setError(null);
    setPhase("generating");
    try {
      const payload = skip
        ? []
        : questions.map((q) => ({ question: q.prompt, answer: answers[q.id] ?? "" }));
      await generateCourse(goalId, payload);
      router.push("/course");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("placement");
    }
  }

  if (phase === "generating") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
        <Spinner className="size-8 text-accent" />
        <h1 className="text-xl font-semibold">Designing your course…</h1>
        <p className="text-sm text-muted-foreground">
          The teacher is drafting a syllabus for{" "}
          <span className="font-medium text-foreground">{spec.subject || "your goal"}</span> —
          modules, lessons, and a mastery path. This takes a few seconds.
        </p>
      </main>
    );
  }

  if (phase === "placement") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6">
        <header>
          <h1 className="text-2xl font-semibold">Quick placement check</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A few questions so the teacher starts at the right level. Answer what you can —
            or skip and it’ll use your stated level.
          </p>
        </header>
        <Card>
          <CardBody className="flex flex-col gap-4">
            {questions.map((q, i) => (
              <Field key={q.id} label={`${i + 1}. ${q.prompt}`}>
                <Textarea
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="Your answer (optional)"
                />
              </Field>
            ))}
            {error && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button size="lg" className="flex-1" onClick={() => finishPlacement(false)}>
                Draft my course
              </Button>
              <Button variant="secondary" size="lg" onClick={() => finishPlacement(true)}>
                Skip
              </Button>
            </div>
          </CardBody>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">What do you want to learn?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell your teacher the goal. It will draft a syllabus and teach it lesson by lesson.
        </p>
      </header>

      <Card>
        <CardBody>
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <Field label="Subject">
              <Input
                required
                placeholder="e.g. Conversational Spanish, Intro to chess, Calculus I"
                value={spec.subject}
                onChange={(e) => set("subject", e.target.value)}
              />
            </Field>
            <Field label="Your goal" hint="What should you be able to do by the end?">
              <Textarea
                required
                placeholder="e.g. Hold a 10-minute travel conversation without freezing"
                value={spec.target_outcome}
                onChange={(e) => set("target_outcome", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Current level">
                <Select value={spec.level} onChange={(e) => set("level", e.target.value as Level)}>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l[0].toUpperCase() + l.slice(1)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Minutes per week">
                <Input
                  type="number"
                  min={30}
                  step={15}
                  value={spec.minutes_per_week}
                  onChange={(e) => set("minutes_per_week", Number(e.target.value))}
                />
              </Field>
            </div>
            <Field label="Time horizon">
              <Input
                value={spec.horizon}
                onChange={(e) => set("horizon", e.target.value)}
                placeholder="e.g. 6 weeks"
              />
            </Field>
            <Field label="Motivation (optional)" hint="Helps the teacher tailor examples.">
              <Input
                value={spec.motivation}
                onChange={(e) => set("motivation", e.target.value)}
                placeholder="e.g. Trip to Mexico City in two months"
              />
            </Field>

            {error && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={!spec.subject || !spec.target_outcome}>
              Draft my course
            </Button>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}
