# Malayalam Recorded Audio

Place custom human-recorded Malayalam pronunciation files in this folder.

Use lowercase kebab-case filenames, for example `ningal-sukhamano.mp3`, then
add the path to the matching phrase object:

```json
{
  "romanized": "Ningal Sukhamano?",
  "audioFile": "/audio/malayalam/ningal-sukhamano.mp3"
}
```

If a recording is missing or fails to play, the app falls back to the existing
pronunciation system.
