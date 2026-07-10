import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ExternalLink,
  Globe2,
  Music2,
} from "lucide-react";
import { spanishSongs } from "@/lib/content";

export function SongsSection() {
  const [featuredSong, ...otherSongs] = spanishSongs;

  return (
    <div className="space-y-8">
      <section className="relative isolate overflow-hidden rounded-[36px] bg-slate-950 px-5 py-8 text-white shadow-[0_28px_90px_rgba(15,23,42,0.22)] ring-1 ring-white/10 sm:px-8 sm:py-10 lg:px-10">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,rgba(217,70,239,0.32),transparent_32%),radial-gradient(circle_at_86%_18%,rgba(6,182,212,0.2),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.07),transparent_48%)]"
        />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)] lg:items-end">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-sm font-bold text-fuchsia-100">
              <Music2 size={16} /> Spanish listening lab
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.04] sm:text-5xl">
              Learn the Spanish people sing.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
              Use familiar songs to notice phrases, accents, and regional flavor. Each card gives you a safe learning gloss and a link to the official release.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-slate-300">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                <BookOpen size={15} /> {spanishSongs.length} song lessons
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                <Globe2 size={15} /> Latin America + Spain
              </span>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/12 bg-white/10 p-5 shadow-inner backdrop-blur-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-fuchsia-200">
              Start here
            </p>
            <p className="mt-3 text-3xl font-black">{featuredSong.title}</p>
            <p className="mt-1 font-bold text-slate-300">{featuredSong.artist}</p>
            <p className="mt-4 text-sm leading-6 text-slate-200">{featuredSong.description}</p>
            <Link
              href={featuredSong.officialUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-fuchsia-400 px-4 py-2 font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-fuchsia-300"
            >
              Open the song <ExternalLink size={16} />
            </Link>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
            Curated listening
          </p>
          <h2 className="mt-2 text-3xl font-black">A little music, a lot of context.</h2>
        </div>
        <Link
          href="/lessons"
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-violet-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 dark:border-white/10 dark:bg-white/10 dark:text-violet-200"
        >
          Back to lessons <ArrowRight size={17} />
        </Link>
      </div>

      <section className="grid gap-5 md:grid-cols-2" aria-label="Spanish song lessons">
        {spanishSongs.map((song, index) => (
          <article
            key={song.id}
            className={`rounded-[30px] border border-white/80 bg-white/95 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5 dark:border-white/10 dark:bg-slate-950/80 dark:shadow-[0_18px_55px_rgba(0,0,0,0.28)] dark:ring-white/10 sm:p-6 ${index === 0 ? "md:col-span-2" : ""}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-fuchsia-700 dark:text-fuchsia-300">
                  {index === 0 ? "Featured track" : `Track ${index + 1}`}
                </p>
                <h3 className="mt-2 text-2xl font-black">{song.title}</h3>
                <p className="mt-1 font-bold text-slate-500 dark:text-slate-300">{song.artist}</p>
                {song.album && <p className="mt-1 text-sm font-semibold text-slate-400 dark:text-slate-400">{song.album}</p>}
              </div>
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-400/15 dark:text-fuchsia-200">
                <Music2 size={22} />
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs font-black text-slate-600 dark:text-slate-300">
              <span className="rounded-full bg-violet-50 px-3 py-2 dark:bg-violet-400/12">{song.genre}</span>
              <span className="rounded-full bg-cyan-50 px-3 py-2 dark:bg-cyan-400/12">{song.region}</span>
              {song.year && <span className="rounded-full bg-amber-50 px-3 py-2 dark:bg-amber-400/12">{song.year}</span>}
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-600 dark:text-slate-300">{song.description}</p>
            <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700 dark:bg-white/[0.06] dark:text-slate-200">
              <span className="font-black text-slate-950 dark:text-white">Listen for:</span> {song.learningFocus}
            </p>

            <div className="mt-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
                Spanish in context
              </p>
              <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 dark:divide-white/10 dark:border-white/10">
                {song.lines.map((line) => (
                  <div key={`${song.id}-${line.spanish}`} className="grid gap-1 p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] sm:gap-4">
                    <p className="font-black text-slate-950 dark:text-slate-50">{line.spanish}</p>
                    <div>
                      <p className="font-bold text-emerald-700 dark:text-emerald-300">{line.english}</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{line.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                <CalendarDays size={14} /> Curated {song.curatedAt}
              </span>
              <div className="flex flex-wrap gap-3">
                <Link href={song.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-violet-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-violet-200">
                  {song.sourceLabel} <ExternalLink size={14} />
                </Link>
                <Link href={song.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white transition hover:bg-violet-500">
                  Listen officially <ExternalLink size={14} />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>

      <aside className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-100">
        <p className="font-black">A note about translations</p>
        <p className="mt-1">These cards use short learning glosses rather than reproducing full song lyrics. Open the official release to listen, then use the Spanish and English rows here to notice useful language.</p>
      </aside>
    </div>
  );
}
