import Link from "next/link";
import { ArrowRight, ExternalLink, Music } from "lucide-react";
import { listenAlong, songDurationSeconds, songs } from "@/lib/music";

export const metadata = {
  title: "Music",
};

export default function MusicPage() {
  return (
    <div className="space-y-6">
      <section className="relative isolate overflow-hidden rounded-[28px] bg-slate-950 px-5 py-6 text-white shadow-[0_22px_70px_rgba(15,23,42,0.2)] ring-1 ring-white/10 sm:px-7 sm:py-7">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(124,58,237,0.3),transparent_38%),radial-gradient(circle_at_86%_16%,rgba(6,182,212,0.18),transparent_36%)]"
        />
        <div className="relative">
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-violet-200">
            <Music size={14} /> Music
          </p>
          <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
            Learn Spanish through song
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-300">
            Follow the lyrics line by line, with the English right below.
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {songs.map((song) => {
          const minutes = Math.round(songDurationSeconds(song) / 60);
          return (
            <Link
              key={song.id}
              href={`/music/${song.id}`}
              className="group flex items-center gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-violet-300 dark:border-white/10 dark:bg-white/[0.05] dark:hover:border-violet-400/50"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-3xl shadow-inner">
                {song.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-black text-slate-950 dark:text-slate-50">
                  {song.title}
                </h2>
                <p className="truncate text-sm font-semibold text-slate-500 dark:text-slate-300">
                  {song.blurb} · {song.lines.length} lines
                  {minutes > 0 ? ` · ~${minutes} min` : ""}
                </p>
              </div>
              <ArrowRight
                size={18}
                className="shrink-0 text-violet-600 transition group-hover:translate-x-0.5 dark:text-violet-300"
              />
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">
            Listen along
          </h2>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">
            Real songs for listening practice — they open in your music app.
          </p>
        </div>

        {listenAlong.map((album) => (
          <div
            key={album.id}
            className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05]"
          >
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-3xl shadow-inner">
                {album.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-black text-slate-950 dark:text-slate-50">
                  {album.title}
                </h3>
                <p className="truncate text-sm font-semibold text-slate-500 dark:text-slate-300">
                  {album.artist}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
              {album.note}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {album.links.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15"
                >
                  {link.label}
                  <ExternalLink size={14} />
                </a>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
