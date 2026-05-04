# Bengali Recorded Audio

Place custom human-recorded Bengali pronunciation files in this folder.

How to add a new recording:

1. Record the phrase as `.mp3` or `.m4a`.
2. Rename the file using lowercase kebab-case, for example `tumi-kemon-acho.mp3`.
3. Place it in `public/audio/bengali/`.
4. Add the public path to the matching phrase object in `content/learn-bengali.json`:

```json
{
  "romanized": "tumi kemon acho?",
  "english": "how are you?",
  "pronunciation": "too-mee keh-mon ah-cho",
  "audioFile": "/audio/bengali/tumi-kemon-acho.mp3"
}
```

The app tries `audioFile` first. If the file is missing or playback fails, it
falls back to the existing pronunciation system.

Sample Bengali paths already wired in lesson data:

- `/audio/bengali/assalamualaikum.mp3`
- `/audio/bengali/walaikum-assalam.mp3`
- `/audio/bengali/tumi-kemon-acho.mp3`
- `/audio/bengali/ami-bhalo-achi.mp3`
