import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Page Not Found | Learning for Rachel" },
};

export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl rounded-[30px] border border-slate-200 bg-white p-7 text-center shadow-sm dark:border-white/10 dark:bg-slate-950/80 sm:p-10">
      <div
        aria-hidden="true"
        className="mx-auto grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-violet-600 to-cyan-500 text-3xl text-white shadow-[0_14px_30px_rgba(124,58,237,0.24)]"
      >
        ✦
      </div>
      <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
        Learning for Rachel
      </p>
      <h1 className="mt-2 text-4xl font-black text-slate-950 dark:text-slate-50">
        Page not found
      </h1>
      <p className="mx-auto mt-3 max-w-md text-slate-600 dark:text-slate-300">
        This path does not lead to a lesson or learning space. Let&apos;s get you
        back to something useful.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-12 items-center rounded-2xl bg-violet-600 px-5 py-3 font-black text-white shadow-[0_5px_0_#5b21b6] transition hover:-translate-y-0.5 hover:bg-violet-500"
        >
          Browse courses
        </Link>
        <Link
          href="/lessons"
          className="inline-flex min-h-12 items-center rounded-2xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15"
        >
          Continue learning
        </Link>
      </div>
    </section>
  );
}
