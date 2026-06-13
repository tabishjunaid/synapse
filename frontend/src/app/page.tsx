"use client";

import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useCourse } from "@/lib/useCourse";

export default function Home() {
  const { course, loading } = useCourse();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 p-6">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">Synapse</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          A virtual professor. Tell it your goal; it drafts a syllabus and teaches you
          through it, lesson by lesson, until you’ve mastered each one.
        </p>
      </div>

      <div className="flex items-center gap-3">
        {loading ? (
          <Spinner className="size-5 text-accent" />
        ) : course ? (
          <>
            <Link href="/course">
              <Button size="lg">Continue “{course.title}”</Button>
            </Link>
            <Link href="/onboarding">
              <Button variant="secondary" size="lg">
                New course
              </Button>
            </Link>
          </>
        ) : (
          <Link href="/onboarding">
            <Button size="lg">Start learning</Button>
          </Link>
        )}
      </div>

      <Link href="/spike" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        Phase 0 latency spike →
      </Link>
    </main>
  );
}
