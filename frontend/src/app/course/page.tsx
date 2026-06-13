"use client";

// The course dashboard — the "semester syllabus" view. Modules and lessons with
// progress + mastery gating, and a single Continue CTA to the next open lesson.

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Spinner } from "@/components/ui/Spinner";
import { resetCourse } from "@/lib/api";
import { SHAPE_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/lessonMeta";
import type { LessonView } from "@/lib/types";
import { useCourse } from "@/lib/useCourse";

export default function CoursePage() {
  const router = useRouter();
  const { course, loading, error, refresh } = useCourse();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6 text-accent" />
      </main>
    );
  }

  if (error) {
    return (
      <Centered>
        <p className="text-sm text-danger">Couldn’t load your course: {error}</p>
        <Button variant="secondary" onClick={refresh}>
          Retry
        </Button>
      </Centered>
    );
  }

  if (!course) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">No course yet</h1>
        <p className="text-sm text-muted-foreground">Tell the teacher what you want to learn.</p>
        <Link href="/onboarding">
          <Button>Start a course</Button>
        </Link>
      </Centered>
    );
  }

  const all = course.modules.flatMap((m) => m.lessons);
  const mastered = all.filter((l) => l.status === "mastered").length;
  const overall = all.length ? mastered / all.length : 0;

  async function reset() {
    await resetCourse();
    router.push("/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your course
            </p>
            <h1 className="text-2xl font-semibold">{course.title}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            New course
          </Button>
        </div>
        {course.summary && <p className="text-sm text-muted-foreground">{course.summary}</p>}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge tone="muted">
            <span aria-hidden="true">🎯</span> {course.target_outcome || "—"}
          </Badge>
          <Badge tone="muted">
            <span aria-hidden="true">🗓</span> {course.pacing.sessions_per_week}× / week ·{" "}
            {course.pacing.minutes_per_session} min
          </Badge>
          <Badge tone="muted">
            <span aria-hidden="true">⏱</span> ~{Math.round(course.est_hours)}h total
          </Badge>
          {course.reviews_due > 0 && (
            <Badge tone="warning">
              <span aria-hidden="true">🔁</span> {course.reviews_due} due for review
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Progress value={overall} className="max-w-xs" />
          <span className="text-xs text-muted-foreground">
            {mastered}/{all.length} lessons mastered
          </span>
        </div>
        {course.next_lesson_id && (
          <div className="flex items-center gap-2">
            <Link href="/classroom" className="self-start">
              <Button size="lg">Enter the classroom →</Button>
            </Link>
            <Link href={`/lesson/${course.next_lesson_id}`} className="self-start">
              <Button variant="secondary" size="lg">Text mode</Button>
            </Link>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-5">
        {course.modules.map((module, mi) => (
          <section key={module.id} className="flex flex-col gap-2">
            <div>
              <h2 className="text-sm font-semibold">
                <span className="text-muted-foreground">Module {mi + 1} ·</span> {module.title}
              </h2>
              {module.goal && <p className="text-xs text-muted-foreground">{module.goal}</p>}
            </div>
            <div className="flex flex-col gap-2">
              {module.lessons.map((lesson) => (
                <LessonRow key={lesson.id} lesson={lesson} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function LessonRow({ lesson }: { lesson: LessonView }) {
  const locked = lesson.status === "locked";
  const body = (
    <Card
      className={
        locked
          ? "opacity-60"
          : "transition hover:border-accent/40 hover:shadow-sm"
      }
    >
      <CardBody className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{lesson.title}</span>
            {lesson.grounded && <Badge tone="accent">grounded</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {SHAPE_LABEL[lesson.shape]} · {lesson.est_minutes} min · {lesson.objectives.length}{" "}
            objectives
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {lesson.status === "mastered" && (
            <span className="text-xs text-muted-foreground">{Math.round(lesson.mastery * 100)}%</span>
          )}
          <Badge tone={STATUS_TONE[lesson.status]}>{STATUS_LABEL[lesson.status]}</Badge>
        </div>
      </CardBody>
    </Card>
  );
  return locked ? body : <Link href={`/lesson/${lesson.id}`}>{body}</Link>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      {children}
    </main>
  );
}
