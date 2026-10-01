# Voiceover for the promo: one Gemini TTS take on Vertex AI, then line start times
# (silence detection + a transcript check). Usage: GCP_PROJECT=<id> python3 voice.py <key file> vo.wav
import base64, io, json, os, re, subprocess, sys, time, urllib.request, urllib.error, wave

KEY = open(sys.argv[1]).read().strip()
OUT = sys.argv[2]
BASE = f"https://aiplatform.googleapis.com/v1/projects/{os.environ['GCP_PROJECT']}/locations/global/publishers/google/models/"
VOICE, STYLE = "Laomedeia", "soft, gentle storyteller, unhurried"
LINES = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "script.json")))

def post(model, body):
    req = urllib.request.Request(BASE + model + ":generateContent", json.dumps(body).encode(),
                                 {"Content-Type": "application/json", "x-goog-api-key": KEY})
    for attempt in range(6):
        try: return json.load(urllib.request.urlopen(req, timeout=180))
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 5: raise RuntimeError(f"HTTP {e.code} {e.read()[:300]}")
            time.sleep(5 * (attempt + 1))

parts = []
for line in LINES:
    text, style = line["say"], line.get("style") or STYLE
    if parts and parts[-1]["speechMetadata"]["style"] == style: parts[-1]["text"] += "\n\n" + text
    else: parts.append({"text": text, "speechMetadata": {"style": style}})
d = post("gemini-3.8-flash-tts", {"contents": [{"role": "user", "parts": parts}], "generationConfig": {
    "responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}}}})
raw = base64.b64decode(next(p for p in d["candidates"][0]["content"]["parts"] if "inlineData" in p)["inlineData"]["data"])
open(OUT, "wb").write(raw)
with wave.open(io.BytesIO(raw)) as w: rate, pcm = w.getframerate(), w.readframes(w.getnframes())
dur = len(pcm) / 2 / rate

log = subprocess.run(["ffmpeg", "-i", OUT, "-af", "silencedetect=noise=-38dB:d=0.18", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
s0 = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
s1 = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
gaps = [(a, b) for a, b in zip(s0, s1) if a > .05 and b < dur - .05]
cuts = [0.0] + [(a + b) / 2 for a, b in gaps] + [dur]

def transcribe(a, b):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as o: o.setnchannels(1); o.setsampwidth(2); o.setframerate(rate); o.writeframes(pcm[int(a * rate) * 2:int(b * rate) * 2])
    d = post("gemini-2.5-flash", {"contents": [{"role": "user", "parts": [
        {"inlineData": {"mimeType": "audio/wav", "data": base64.b64encode(buf.getvalue()).decode()}},
        {"text": "Transcribe this speech exactly. Reply with only the words spoken."}]}],
        "generationConfig": {"temperature": 0, "thinkingConfig": {"thinkingBudget": 0}}})
    return "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"]).strip()

words = lambda s: re.findall(r"[a-z']+", s.lower())
lw = [set(words(l["say"])) for l in LINES]; cur, starts, heard = 0, {}, []
for a, b in zip(cuts, cuts[1:]):
    t = transcribe(a, b); heard.append(t); tw = words(t)
    if not tw: continue
    best = max(range(cur, min(len(LINES), cur + 3)), key=lambda i: (sum(w in lw[i] for w in tw), -i))
    if sum(w in lw[best] for w in tw) == 0: continue
    cur = best; starts.setdefault(best, next((g1 for g0, g1 in gaps if abs((g0 + g1) / 2 - a) < 1e-3), a))
timing = [{"line": l["say"], "start": round(starts[i], 3) if i in starts else None} for i, l in enumerate(LINES)]
json.dump({"duration": round(dur, 3), "lines": timing, "heard": heard}, open(OUT.replace(".wav", ".json"), "w"), indent=1)
print(json.dumps(timing, indent=1)); print("duration", round(dur, 2)); print("heard:", " | ".join(heard))
print("missing lines:", [i + 1 for i, t in enumerate(timing) if t["start"] is None])
