# Spanish Recorded Audio

Place custom human-recorded Spanish pronunciation files in this folder.

Use lowercase kebab-case filenames, for example `buenos-dias.mp3`, then add the
path to the matching phrase object:

```json
{
  "romanized": "buenos dias",
  "audioFile": "/audio/spanish/buenos-dias.mp3"
}
```

If a recording is missing or fails to play, the app falls back to the existing
pronunciation system.
