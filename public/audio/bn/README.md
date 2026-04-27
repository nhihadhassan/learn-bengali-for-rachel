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
