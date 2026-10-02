# A small procedural score: low drone, slow pad chords, sparse piano-like notes, low booms and a soft pulse, from a
# JSON score. Pure standard library; ffmpeg adds the room (reverb) afterwards.
#   python3 music.py score.json out.wav
# score: {"dur": s, "level": 0..1, "root": midi,
#         "chords": [{"at": s, "notes": [midi...], "level": 0..1}],
#         "notes":  [{"at": s, "m": midi, "v": 0..1, "decay": s}],
#         "booms":  [{"at": s, "v": 0..1}],
#         "pulse":  [{"from": s, "to": s, "every": s, "v": 0..1}],
#         "swells": [{"at": s, "len": s, "v": 0..1}]}
import array, json, math, random, subprocess, sys, wave, os

SR = 24000
sc = json.load(open(sys.argv[1])); OUT = sys.argv[2]
N = int(sc["dur"] * SR); buf = [0.0] * N
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
TAU = 2 * math.pi

def add(i0, samples):
    for k, v in enumerate(samples):
        j = i0 + k
        if 0 <= j < N: buf[j] += v

# drone: the root and its fifth, two octaves down, slowly beating, fading in and out
root = sc.get("root", 45)
f1, f2, f3 = hz(root - 12), hz(root - 12) * 1.5, hz(root - 12) * 1.003
dl = sc.get("drone", 0.16)
for i in range(N):
    t = i / SR
    env = min(1, t / 4) * min(1, (sc["dur"] - t) / 3)
    buf[i] += dl * env * (0.6 * math.sin(TAU * f1 * t) + 0.35 * math.sin(TAU * f3 * t) + 0.22 * math.sin(TAU * f2 * t) * (0.6 + 0.4 * math.sin(TAU * 0.07 * t)))

# pad: each chord crossfades into the next; soft sines with a little detune and tremolo
ch = sc.get("chords", [])
for ci, c in enumerate(ch):
    a = c["at"]; b = ch[ci + 1]["at"] if ci + 1 < len(ch) else sc["dur"]
    lv = c.get("level", 0.5) * sc.get("pad", 0.1)
    i0, i1 = int(a * SR), min(N, int((b + 2.5) * SR))
    fs = [hz(m) for m in c["notes"]]
    for i in range(i0, i1):
        t = i / SR; u = t - a
        env = min(1, u / 2.0) * (1 if t < b else max(0, 1 - (t - b) / 2.5)) * min(1, (sc["dur"] - t) / 2)
        s = 0.0
        for k, f in enumerate(fs):
            s += math.sin(TAU * f * t + k) + 0.5 * math.sin(TAU * f * 1.0025 * t + 2 * k)
        buf[i] += lv * env * s / len(fs) * (0.85 + 0.15 * math.sin(TAU * 0.23 * t + ci))

# piano-ish notes: a few slightly stretched partials, a soft hammer, exponential decay
for n in sc.get("notes", []):
    f = hz(n["m"]); v = n.get("v", 0.5) * sc.get("piano", 0.22); dec = n.get("decay", 3.0)
    L = int((dec * 2.2) * SR); out = [0.0] * L
    parts = [(1, 1.0), (2.002, 0.45), (3.006, 0.22), (4.012, 0.1), (5.02, 0.05)]
    for k in range(L):
        t = k / SR
        att = min(1, t / 0.004)
        s = 0.0
        for mult, amp in parts:
            s += amp * math.exp(-t * (1 / dec) * (1 + 0.6 * mult)) * math.sin(TAU * f * mult * t)
        out[k] = v * att * s
    add(int(n["at"] * SR), out)

# booms: a low sine with a falling pitch and a little noise
rnd = random.Random(7)
for b in sc.get("booms", []):
    v = b.get("v", 0.6) * sc.get("boom", 0.5); L = int(2.5 * SR); out = [0.0] * L; ph = 0.0
    for k in range(L):
        t = k / SR; f = 38 + 50 * math.exp(-t * 6); ph += TAU * f / SR
        out[k] = v * (math.sin(ph) * math.exp(-t * 1.6) + 0.08 * (rnd.random() * 2 - 1) * math.exp(-t * 20))
    add(int(b["at"] * SR), out)

# pulse: a soft heartbeat (two thumps)
for p in sc.get("pulse", []):
    t = p["from"]
    while t < p["to"]:
        for off, amp in ((0, 1.0), (0.22, 0.6)):
            v = p.get("v", 0.4) * amp * sc.get("beat", 0.35); L = int(0.35 * SR); out = [0.0] * L; ph = 0.0
            for k in range(L):
                tt = k / SR; f = 55 + 40 * math.exp(-tt * 25); ph += TAU * f / SR
                out[k] = v * math.sin(ph) * math.exp(-tt * 11)
            add(int((t + off) * SR), out)
        t += p["every"]

# swells: filtered noise rising and falling (a breath of air)
for s in sc.get("swells", []):
    v = s.get("v", 0.3) * sc.get("air", 0.12); L = int(s["len"] * SR); lp = 0.0; out = [0.0] * L
    for k in range(L):
        u = k / L; lp += (rnd.random() * 2 - 1 - lp) * 0.02
        out[k] = v * lp * math.sin(math.pi * u) ** 2 * 6
    add(int(s["at"] * SR), out)

peak = max(1e-6, max(abs(x) for x in buf)); g = min(1.0, 0.9 / peak) * sc.get("level", 1.0)
raw = OUT + ".dry.wav"
with wave.open(raw, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(array.array("h", (int(max(-1, min(1, x * g)) * 32767) for x in buf)).tobytes())
# the room: a long, soft multi-tap echo, then to 48 kHz stereo
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af",
                "aecho=0.8:0.75:73|149|293|557|911:0.42|0.33|0.25|0.18|0.12,highpass=f=28,lowpass=f=9000,aresample=48000",
                "-ac", "2", OUT], check=True)
os.remove(raw)
print("wrote", OUT)
