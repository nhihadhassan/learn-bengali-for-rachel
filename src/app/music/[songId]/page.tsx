import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getSong, songs } from "@/lib/music";
import { createPageMetadata } from "@/lib/site-metadata";
import { LyricsPlayer } from "@/components/music/lyrics-player";

export function generateStaticParams() {
  return songs.map((song) => ({ songId: song.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ songId: string }>;
}): Promise<Metadata> {
  const { songId } = await params;
  const song = getSong(songId);

  if (!song) {
    return createPageMetadata({
      title: "Music",
      description: "Music practice on Learning for Rachel.",
      path: "/music",
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: song.title,
    description: `${song.blurb}. Follow the original practice lyrics line by line.`,
    path: `/music/${song.id}`,
  });
}

export default async function SongPage({
  params,
}: {
  params: Promise<{ songId: string }>;
}) {
  const { songId } = await params;
  const song = getSong(songId);

  if (!song) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
      <div className="flex items-center gap-3">
        <Link
          href="/music"
          aria-label="Back to music"
          className="inline-grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15 sm:size-10"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">
            {song.emoji} {song.artist}
          </p>
          <h1 className="truncate text-xl font-black leading-tight text-slate-950 dark:text-slate-50 sm:text-2xl">
            {song.title}
          </h1>
        </div>
      </div>

      <LyricsPlayer song={song} />
    </div>
  );
}
