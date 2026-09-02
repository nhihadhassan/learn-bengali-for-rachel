"use client";

/**
 * The lesson path, at two very different scales.
 *
 * Bengali has 16 lessons; the full Spanish course has 131 units and 786
 * lessons. Rendering both the same way means either a cramped small course or
 * an unusable wall of scroll for the big one, so the path picks a presentation:
 *
 *  - **Small courses** show every unit and lesson, as before.
 *  - **Large courses** show one section at a time, a window of units around
 *    where the learner is, the current unit expanded, and a jump box — so
 *    "continue", "where am I", "look around" and "skip ahead" are all one tap.
 *
 * It reads the lightweight course outline (`@/lib/course-index`), never the full
 * curriculum, so browsing a huge course costs no lesson content.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  getCourseSections,
  isLargeCourse,
  type LessonOutline,
  type SectionGroup,
  type UnitOutline,
} from "@/lib/course-index";
import { getCourse } from "@/lib/courses";
import { cn } from "@/lib/utils";
import type { CurriculumId } from "@/types/learning";
import { HistoryIcon } from "@/components/lesson/history-icon";

/** How many units of a large course are listed at once. */
const UNIT_WINDOW = 8;

export function CoursePath({
  completedLessonIds,
  courseId,
  currentLessonId,
}: {
  completedLessonIds: Set<string>;
  courseId: CurriculumId;
  currentLessonId?: string;
}) {
  const sections = getCourseSections(courseId);
  const large = isLargeCourse(courseId);

  if (large) {
    return (
      <SectionedPath
        completedLessonIds={completedLessonIds}
        courseId={courseId}
        currentLessonId={currentLessonId}
        sections={sections}
      />
    );
  }

  return (
    <div className="space-y-4">
      {sections.flatMap((section) =>
        section.units.map((unit) => (
          <UnitCard
            key={unit.id}
            completedLessonIds={completedLessonIds}
            courseId={courseId}
            currentLessonId={currentLessonId}
            defaultOpen
            unit={unit}
          />
        )),
      )}
    </div>
  );
}

function SectionedPath({
  completedLessonIds,
  courseId,
  currentLessonId,
  sections,
}: {
  completedLessonIds: Set<string>;
  courseId: CurriculumId;
  currentLessonId?: string;
  sections: SectionGroup[];
}) {
  const currentUnitIndexBySection = useMemo(() => {
    return sections.map((section) => {
      const index = section.units.findIndex((unit) =>
        unit.lessons.some((lesson) => lesson.id === currentLessonId),
      );
      return index >= 0 ? index : 0;
    });
  }, [currentLessonId, sections]);

  const activeSectionIndex = Math.max(
    0,
    sections.findIndex((section) =>
      section.units.some((unit) =>
        unit.lessons.some((lesson) => lesson.id === currentLessonId),
      ),
    ),
  );

  const [sectionIndex, setSectionIndex] = useState(activeSectionIndex);
  const [windowStart, setWindowStart] = useState(() =>
    clampWindowStart(
      currentUnitIndexBySection[activeSectionIndex] - 1,
      sections[activeSectionIndex]?.units.length ?? 0,
    ),
  );
  const [jumpValue, setJumpValue] = useState("");
  const [jumpError, setJumpError] = useState("");

  const section = sections[sectionIndex];
  const units = section?.units ?? [];
  const visibleUnits = units.slice(windowStart, windowStart + UNIT_WINDOW);
  const hasEarlier = windowStart > 0;
  const hasLater = windowStart + UNIT_WINDOW < units.length;

  function goToSection(nextIndex: number) {
    const clamped = Math.min(Math.max(nextIndex, 0), sections.length - 1);
    setSectionIndex(clamped);
    setWindowStart(
      clampWindowStart(
        currentUnitIndexBySection[clamped] - 1,
        sections[clamped]?.units.length ?? 0,
      ),
    );
  }

  /** Jump straight to a unit number anywhere in the course. */
  function jumpToUnit(event: React.FormEvent) {
    event.preventDefault();
    const target = Number(jumpValue);

    if (!Number.isInteger(target)) {
      setJumpError("Enter a unit number.");
      return;
    }

    for (let index = 0; index < sections.length; index += 1) {
      const unitIndex = sections[index].units.findIndex(
        (unit) => unit.number === target,
      );

      if (unitIndex >= 0) {
        setSectionIndex(index);
        setWindowStart(
          clampWindowStart(unitIndex - 1, sections[index].units.length),
        );
        setJumpError("");
        setJumpValue("");
        return;
      }
    }

    setJumpError("No unit with that number.");
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.05]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous section"
            disabled={sectionIndex === 0}
            onClick={() => goToSection(sectionIndex - 1)}
            className="inline-grid size-11 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-white/10"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-600 dark:text-violet-300">
              Section {section?.number} of {sections.length}
            </p>
            <p className="truncate text-base font-black text-slate-900 dark:text-slate-50">
              {section?.title}
            </p>
            {section?.description && (
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                {section.description}
              </p>
            )}
          </div>

          <button
            type="button"
            aria-label="Next section"
            disabled={sectionIndex >= sections.length - 1}
            onClick={() => goToSection(sectionIndex + 1)}
            className="inline-grid size-11 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-white/10"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={jumpToUnit}
          className="mt-3 flex items-center justify-center gap-2 border-t border-slate-100 pt-3 dark:border-white/10"
        >
          <label
            className="text-xs font-black uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500"
            htmlFor="jump-to-unit"
          >
            Jump to unit
          </label>
          <input
            id="jump-to-unit"
            inputMode="numeric"
            value={jumpValue}
            onChange={(event) => {
              setJumpValue(event.target.value);
              setJumpError("");
            }}
            placeholder="#"
            className="h-11 w-20 rounded-xl border border-slate-200 bg-white px-3 text-center text-sm font-black outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-white/10 dark:text-slate-50 dark:focus:ring-violet-400/20"
          />
          <button
            type="submit"
            className="inline-flex h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-700 dark:bg-white/15 dark:hover:bg-white/25"
          >
            Go
          </button>
        </form>
        {jumpError && (
          <p className="mt-2 text-center text-xs font-bold text-rose-600 dark:text-rose-300">
            {jumpError}
          </p>
        )}
      </section>

      {hasEarlier && (
        <WindowButton
          label={`Earlier units in this section`}
          onClick={() => setWindowStart(Math.max(0, windowStart - UNIT_WINDOW))}
        />
      )}

      <div className="space-y-3">
        {visibleUnits.map((unit) => (
          <UnitCard
            key={unit.id}
            completedLessonIds={completedLessonIds}
            courseId={courseId}
            currentLessonId={currentLessonId}
            defaultOpen={unit.lessons.some(
              (lesson) => lesson.id === currentLessonId,
            )}
            unit={unit}
          />
        ))}
      </div>

      {hasLater && (
        <WindowButton
          label="More units in this section"
          onClick={() =>
            setWindowStart(
              clampWindowStart(windowStart + UNIT_WINDOW, units.length),
            )
          }
        />
      )}
    </div>
  );
}

function clampWindowStart(start: number, total: number) {
  return Math.max(0, Math.min(start, Math.max(0, total - UNIT_WINDOW)));
}

function WindowButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 text-sm font-black text-slate-500 transition hover:border-violet-300 hover:bg-white hover:text-violet-700 dark:border-white/15 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-violet-200"
    >
      {label}
    </button>
  );
}

/**
 * A unit: always shows its title and how much is done; expands to its lessons.
 * Collapsed by default in a large course so the page stays scannable.
 */
function UnitCard({
  completedLessonIds,
  courseId,
  currentLessonId,
  defaultOpen,
  unit,
}: {
  completedLessonIds: Set<string>;
  courseId: CurriculumId;
  currentLessonId?: string;
  defaultOpen: boolean;
  unit: UnitOutline;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const course = getCourse(courseId);
  const isHistory = course.capabilities.kind === "history";
  const doneCount = unit.lessons.filter((lesson) =>
    completedLessonIds.has(lesson.id),
  ).length;
  const isUnitComplete =
    unit.lessons.length > 0 && doneCount === unit.lessons.length;
  const percent =
    unit.lessons.length > 0
      ? Math.round((doneCount / unit.lessons.length) * 100)
      : 0;
  const hasCurrent = unit.lessons.some((lesson) => lesson.id === currentLessonId);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border bg-white transition-colors dark:bg-white/[0.05]",
        hasCurrent
          ? "border-violet-300 dark:border-violet-400/40"
          : "border-slate-200 dark:border-white/10",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full min-w-0 items-center gap-3 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
      >
        <UnitProgressRing
          isComplete={isUnitComplete}
          label={String(unit.number)}
          percent={percent}
        />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-base font-black text-slate-900 dark:text-slate-50">
              {unit.title}
            </span>
            {hasCurrent && (
              <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-violet-700 dark:bg-violet-400/20 dark:text-violet-200">
                Here
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
            {doneCount}/{unit.lessons.length} {course.nouns.lessons}
            {/* Some packs use the unit title as its goal; don't say it twice. */}
            {unit.description && unit.description !== unit.title
              ? ` · ${unit.description}`
              : ""}
          </span>
        </span>
        <ChevronRight
          size={18}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-slate-400 transition-transform",
            open && "rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="grid min-w-0 grid-cols-1 gap-2 border-t border-slate-100 p-3 dark:border-white/10">
          {unit.lessons.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
              More {course.nouns.lessons} are on the way for this {course.nouns.unit}.
            </p>
          ) : (
            unit.lessons.map((lesson) => (
              <LessonRow
                key={lesson.id}
                isCompleted={completedLessonIds.has(lesson.id)}
                isCurrent={lesson.id === currentLessonId}
                isHistory={isHistory}
                lesson={lesson}
              />
            ))
          )}

          {isUnitComplete && !isHistory && unit.lessons.length > 0 && (
            <Link
              href={`/unit-review/${unit.id}`}
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 transition hover:bg-cyan-100 dark:border-cyan-300/25 dark:bg-cyan-400/10 dark:hover:bg-cyan-400/20"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-600 text-white">
                <RefreshCw size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-slate-900 dark:text-slate-50">
                  Review this {course.nouns.unit}
                </span>
                <span className="block truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Mix everything from {unit.title} together.
                </span>
              </span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function LessonRow({
  isCompleted,
  isCurrent,
  isHistory,
  lesson,
}: {
  isCompleted: boolean;
  isCurrent: boolean;
  isHistory: boolean;
  lesson: LessonOutline;
}) {
  return (
    <Link
      href={`/practice/${lesson.id}`}
      aria-current={isCurrent ? "step" : undefined}
      className={cn(
        "group flex min-h-16 min-w-0 items-center gap-3 rounded-2xl border px-3 py-2 transition active:scale-[0.995]",
        isCurrent
          ? "border-violet-300 bg-violet-50 shadow-[0_4px_0_#ddd6fe] hover:bg-violet-100 dark:border-violet-400/40 dark:bg-violet-400/15 dark:shadow-[0_4px_0_rgba(167,139,250,0.22)]"
          : isCompleted
            ? "border-transparent bg-emerald-50/70 hover:bg-emerald-50 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/15"
            : "border-transparent bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.06] dark:hover:bg-white/10",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl text-white transition group-hover:scale-105",
          isCompleted
            ? "bg-emerald-600"
            : isCurrent
              ? "bg-violet-600"
              : "bg-slate-300 text-slate-600 dark:bg-white/15 dark:text-slate-200",
        )}
      >
        {isCompleted ? (
          <Check size={19} aria-hidden="true" />
        ) : isHistory ? (
          <HistoryIcon name={lesson.icon} size={19} />
        ) : isCurrent ? (
          <Play size={17} fill="currentColor" aria-hidden="true" />
        ) : (
          <Circle size={15} aria-hidden="true" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-slate-900 dark:text-slate-50">
          {lesson.title}
        </span>
        <span className="block truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
          {lesson.summary}
        </span>
      </span>

      {isCurrent && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white">
          <Sparkles size={12} aria-hidden="true" />
          Next
        </span>
      )}
    </Link>
  );
}

/** A compact ring so unit progress reads at a glance without a full bar. */
function UnitProgressRing({
  isComplete,
  label,
  percent,
}: {
  isComplete: boolean;
  label: string;
  percent: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="relative grid size-11 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(${
          isComplete ? "#10b981" : "#7c3aed"
        } ${percent * 3.6}deg, rgba(148,163,184,0.25) 0deg)`,
      }}
    >
      <span className="grid size-9 place-items-center rounded-full bg-white text-sm font-black text-slate-700 dark:bg-[#221d38] dark:text-slate-200">
        {isComplete ? (
          <Check size={16} aria-hidden="true" className="text-emerald-600 dark:text-emerald-300" />
        ) : (
          label
        )}
      </span>
    </span>
  );
}
