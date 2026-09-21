# Renders every clip in a clips.json with Kyutai Pocket TTS, ONE model load for all of them.
# Driven by voice.sh; not run on its own.
#
# clips.json is [["clip-id", "text as it should be SPOKEN"], ...]. The spoken text is not the
# text the page displays: "Tap 14" on screen is "Tap fourteen." here, because the model reads
# digits and abbreviations the way they are written.
#
# The voice state is encoded once and reused for every clip, and the run is seeded, so the same
# clips.json and voice produce the same audio. A changed clip means changed text, not a changed die.
import json
import sys
from pathlib import Path

import torch
from pocket_tts import TTSModel
from pocket_tts.data.audio import stream_audio_chunks

clips_path, out_dir = sys.argv[1:3]
voice_name = sys.argv[3] if len(sys.argv) > 3 else "alba"

clips = json.loads(Path(clips_path).read_text())
if not clips:
    raise SystemExit(f"render: {clips_path} holds no clips")

seen = set()
for entry in clips:
    if len(entry) != 2:
        raise SystemExit(f"render: every clip must be [id, text]; got {entry!r}")
    clip_id, text = entry
    if clip_id in seen:
        raise SystemExit(f"render: duplicate clip id {clip_id!r}")
    if not text.strip():
        raise SystemExit(f"render: clip {clip_id!r} has no text")
    seen.add(clip_id)

out = Path(out_dir)
out.mkdir(parents=True, exist_ok=True)

model = TTSModel.load_model(language="english")
model.to("cpu")
voice = model.get_state_for_audio_prompt(voice_name)
torch.manual_seed(0)

with torch.no_grad():
    for clip_id, text in clips:
        wav = out / f"{clip_id}.wav"
        chunks = model.generate_audio_stream(model_state=voice, text_to_generate=text)
        stream_audio_chunks(str(wav), chunks, model.config.mimi.sample_rate)
        print(f"rendered {clip_id}", flush=True)
