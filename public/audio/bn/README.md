# Bengali Audio Files

Place recorded Bengali pronunciation files here and reference them from lesson
content with `audioUrl`.

Example:

```json
{
  "romanized": "kemon acho",
  "bengaliScript": "কেমন আছো",
  "english": "how are you",
  "audioUrl": "/audio/bn/kemon-acho.mp3"
}
```

When `audioUrl` exists and the file loads, the app plays it first. If the file
is missing or playback fails, the app falls back to Bengali-script browser TTS.

Current sample phrases with Bengali-script TTS fallback:

```json
[
  {
    "romanized": "nomoskar",
    "bengaliScript": "নমস্কার",
    "english": "hello / respectful greeting"
  },
  {
    "romanized": "dhonnobad",
    "bengaliScript": "ধন্যবাদ",
    "english": "thank you"
  },
  {
    "romanized": "tumi kemon acho?",
    "bengaliScript": "তুমি কেমন আছো?",
    "english": "how are you?"
  },
  {
    "romanized": "ami bhalo achi",
    "bengaliScript": "আমি ভালো আছি",
    "english": "I am good"
  },
  {
    "romanized": "ami pani chai",
    "bengaliScript": "আমি পানি চাই",
    "english": "I want water"
  }
]
```

To add real recordings later, drop MP3 files into this folder and add
`"audioUrl": "/audio/bn/file-name.mp3"` to the matching phrase in
`content/learn-bengali.json`.
