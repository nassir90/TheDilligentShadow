# Transcribe a whole narration take in one go and diff its words against the script (extra / missing words).
#   GCP_PROJECT=<id> python3 check_take.py <key file> <take.wav> <script.json>
import base64, difflib, json, os, re, sys, urllib.request
KEY = open(sys.argv[1]).read().strip(); wav, script = sys.argv[2], json.load(open(sys.argv[3]))
url = f"https://aiplatform.googleapis.com/v1/projects/{os.environ['GCP_PROJECT']}/locations/global/publishers/google/models/gemini-2.5-flash:generateContent"
body = {"contents": [{"role": "user", "parts": [{"inlineData": {"mimeType": "audio/wav", "data": base64.b64encode(open(wav, "rb").read()).decode()}},
        {"text": "Transcribe this narration exactly, word for word, including any stray words, sounds or repeats. Reply with only the transcript."}]}],
        "generationConfig": {"temperature": 0, "thinkingConfig": {"thinkingBudget": 0}}}
d = json.load(urllib.request.urlopen(urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": "application/json", "x-goog-api-key": KEY}), timeout=180))
heard = "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"])
words = lambda s: re.findall(r"[a-z0-9']+", s.lower().replace("two hundred and forty", "240").replace("3d", "3 d"))
want, got = words(" ".join(l["say"] for l in script)), words(heard)
extra, missing = [], []
for op, a1, a2, b1, b2 in difflib.SequenceMatcher(None, want, got).get_opcodes():
    if op in ("insert", "replace"): extra.append(" ".join(got[b1:b2]))
    if op in ("delete", "replace"): missing.append(" ".join(want[a1:a2]))
print(json.dumps({"take": wav, "extra": extra, "missing": missing, "heard": heard}))
