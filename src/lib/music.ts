// Original, copyright-free practice "songs" for the Music section. The lyrics
// here are written for this app (simple, repetitive beginner Spanish that reuses
// course vocabulary) — deliberately NOT real songs, so nothing is infringed.
// Text-only for now: each line has a duration so the lyric view can advance
// like a karaoke read-along without any audio.

export type LyricLine = {
  es: string;
  en: string;
  /** How long this line stays highlighted, in seconds. */
  seconds: number;
};

export type Song = {
  id: string;
  title: string;
  artist: string;
  emoji: string;
  /** One-line description for the song list. */
  blurb: string;
  lines: LyricLine[];
};

export const songs: Song[] = [
  {
    id: "hola-buenos-dias",
    title: "Hola, Buenos Días",
    artist: "Practice song",
    emoji: "🌞",
    blurb: "Greetings and introductions",
    lines: [
      { es: "Hola, hola, buenos días", en: "Hello, hello, good morning", seconds: 4 },
      { es: "¿Cómo estás? Muy bien", en: "How are you? Very well", seconds: 4 },
      { es: "Me llamo Sol, ¿y tú?", en: "My name is Sol, and you?", seconds: 4 },
      { es: "Mucho gusto, amiga", en: "Nice to meet you, friend", seconds: 4 },
      { es: "Hola, hola, buenos días", en: "Hello, hello, good morning", seconds: 4 },
      { es: "El sol dice buenos días", en: "The sun says good morning", seconds: 4 },
      { es: "Buenas tardes por la tarde", en: "Good afternoon in the afternoon", seconds: 4 },
      { es: "Buenas noches, a dormir", en: "Good night, time to sleep", seconds: 4 },
      { es: "Hasta luego, hasta mañana", en: "See you later, see you tomorrow", seconds: 4 },
      { es: "Adiós, adiós, mi amiga", en: "Goodbye, goodbye, my friend", seconds: 5 },
    ],
  },
  {
    id: "en-el-cafe",
    title: "En el Café",
    artist: "Practice song",
    emoji: "☕",
    blurb: "Ordering at a café",
    lines: [
      { es: "Un café, por favor", en: "A coffee, please", seconds: 4 },
      { es: "Con leche y azúcar", en: "With milk and sugar", seconds: 4 },
      { es: "¿Cuánto cuesta? Dos euros", en: "How much is it? Two euros", seconds: 4 },
      { es: "Está muy caliente hoy", en: "It is very hot today", seconds: 4 },
      { es: "Un café, por favor", en: "A coffee, please", seconds: 4 },
      { es: "Para mí, un té", en: "For me, a tea", seconds: 4 },
      { es: "Con un poco de leche", en: "With a little milk", seconds: 4 },
      { es: "La cuenta, por favor", en: "The bill, please", seconds: 4 },
      { es: "Muchas gracias, señor", en: "Thank you very much, sir", seconds: 4 },
      { es: "Hasta luego, buen día", en: "See you later, have a good day", seconds: 5 },
    ],
  },
];

export function getSong(id: string): Song | undefined {
  return songs.find((song) => song.id === id);
}

export function songDurationSeconds(song: Song): number {
  return song.lines.reduce((total, line) => total + line.seconds, 0);
}
