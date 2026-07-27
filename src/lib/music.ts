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
  {
    id: "mi-familia",
    title: "Mi Familia",
    artist: "Practice song",
    emoji: "👨‍👩‍👧",
    blurb: "Family words",
    lines: [
      { es: "Esta es mi familia", en: "This is my family", seconds: 4 },
      { es: "Mi madre y mi padre", en: "My mother and my father", seconds: 4 },
      { es: "Mi hermano y mi hermana", en: "My brother and my sister", seconds: 4 },
      { es: "Todos juntos en casa", en: "All together at home", seconds: 4 },
      { es: "Mi abuela hace la comida", en: "My grandmother makes the food", seconds: 4 },
      { es: "Mi abuelo cuenta historias", en: "My grandfather tells stories", seconds: 4 },
      { es: "Yo quiero a mi familia", en: "I love my family", seconds: 4 },
      { es: "Y mi familia me quiere", en: "And my family loves me", seconds: 5 },
    ],
  },
  {
    id: "donde-esta",
    title: "¿Dónde Está?",
    artist: "Practice song",
    emoji: "🧭",
    blurb: "Places and directions",
    lines: [
      { es: "¿Dónde está el baño?", en: "Where is the bathroom?", seconds: 4 },
      { es: "A la derecha, por favor", en: "To the right, please", seconds: 4 },
      { es: "¿Dónde está la estación?", en: "Where is the station?", seconds: 4 },
      { es: "Todo recto y a la izquierda", en: "Straight ahead and to the left", seconds: 4 },
      { es: "¿Está lejos o cerca?", en: "Is it far or near?", seconds: 4 },
      { es: "Está muy cerca de aquí", en: "It is very close to here", seconds: 4 },
      { es: "Muchas gracias, muy amable", en: "Thank you, very kind", seconds: 4 },
      { es: "De nada, buen viaje", en: "You're welcome, have a good trip", seconds: 5 },
    ],
  },
];

// "Listen along" pointers to real albums on streaming services. We only store
// the album title and outbound links — never the lyrics, which stay in the
// licensed streaming apps. Use these tracks for listening practice alongside the
// in-app learning songs.
export type ListenAlongLink = { label: string; url: string };

export type ListenAlong = {
  id: string;
  title: string;
  artist: string;
  emoji: string;
  note: string;
  links: ListenAlongLink[];
};

const searchQuery = "Bad Bunny DeBÍ TiRAR MáS FoToS";

export const listenAlong: ListenAlong[] = [
  {
    id: "dtmf",
    title: "DeBÍ TiRAR MáS FoToS",
    artist: "Bad Bunny",
    emoji: "🎧",
    note: "Great listening practice. Opens in your music app — lyrics live there.",
    links: [
      {
        label: "Spotify",
        url: `https://open.spotify.com/search/${encodeURIComponent(searchQuery)}`,
      },
      {
        label: "Apple Music",
        url: `https://music.apple.com/us/search?term=${encodeURIComponent(searchQuery)}`,
      },
      {
        label: "YouTube",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
      },
    ],
  },
];

export function getSong(id: string): Song | undefined {
  return songs.find((song) => song.id === id);
}

export function songDurationSeconds(song: Song): number {
  return song.lines.reduce((total, line) => total + line.seconds, 0);
}
