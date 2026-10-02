# Assembles one video: videos/<id>/frames (from compose.js) + its narration placed line by line + sound effects
# + an optional procedural score (music.py), music ducked under the voice, loudness-normalised.
#   python3 build.py <id> <output.mp4>
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); PROMO = os.path.dirname(HERE)
vid, OUT = sys.argv[1], sys.argv[2]
D = os.path.join(PROMO, "videos", vid)
tl = json.load(open(os.path.join(D, "timeline.json"))); TOTAL = tl["total"]
run = lambda *a: subprocess.run(["ffmpeg", "-y", "-v", "error", *a], check=True)

SFX = {
    "click": "0.55*sin(2*PI*2900*t)*exp(-t*220)+0.35*(random(0)*2-1)*exp(-t*420)+0.25*sin(2*PI*900*t)*exp(-t*120)",
    "tap": "0.35*sin(2*PI*520*t)*exp(-t*70)+0.18*(random(0)*2-1)*exp(-t*500)",
    "stomp": "0.8*sin(2*PI*62*t)*exp(-t*16)+0.25*sin(2*PI*130*t)*exp(-t*30)+0.15*(random(0)*2-1)*exp(-t*90)",
    "blip": "0.22*sin(2*PI*1320*t)*exp(-t*40)+0.12*sin(2*PI*1980*t)*exp(-t*60)",
    "whoosh": "0.25*(random(0)*2-1)*sin(PI*t/0.5)*sin(PI*t/0.5)",
}
for k, e in SFX.items():
    p = os.path.join(D, f"sfx_{k}.wav")
    if not os.path.exists(p): run("-f", "lavfi", "-i", f"aevalsrc='{e}':s=48000:d={0.5 if k == 'whoosh' else 0.4}", p)

inputs, filt, voice, rest = [], [], [], []
def inp(*a): inputs.extend(a); return inputs.count("-i") - 1
vo = inp("-i", os.path.join(D, "vo.wav")) if any("text" in c for c in tl["cues"]) else None
for i, c in enumerate(tl["cues"]):
    d = int(c["at"] * 1000)
    if "text" in c:
        filt.append(f"[{vo}:a]atrim={c['a'] - 0.04}:{c['b'] + 0.12},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d=0.03,afade=t=out:st={c['b'] - c['a'] + 0.08}:d=0.08,adelay={d}|{d}[v{i}]")
        voice.append(f"[v{i}]")
    else:
        k = inp("-i", os.path.join(D, f"sfx_{c['sfx']}.wav"))
        filt.append(f"[{k}:a]volume={c.get('vol') or 0.7},adelay={d}|{d}[e{i}]"); rest.append(f"[e{i}]")
k = inp("-f", "lavfi", "-t", str(TOTAL), "-i", "anoisesrc=color=brown:amplitude=0.01:r=48000")
filt.append(f"[{k}:a]lowpass=f=400,afade=t=in:d=1:st=0,afade=t=out:st={TOTAL - 1}:d=1[room]"); rest.append("[room]")
if voice: filt.append(f"{''.join(voice)}amix=inputs={len(voice)}:normalize=0:duration=longest,apad=whole_dur={TOTAL},asplit=2[vox][key]")
if tl.get("music"):
    score = dict(tl["music"]); score["dur"] = TOTAL
    sp = os.path.join(D, "score.json"); json.dump(score, open(sp, "w"))
    mp = os.path.join(D, "music.wav"); subprocess.run([sys.executable, os.path.join(HERE, "music.py"), sp, mp], check=True)
    m = inp("-i", mp); mv = score.get("mix", 0.5)
    if voice: filt.append(f"[{m}:a]volume={mv}[mu];[mu][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]")
    else: filt.append(f"[{m}:a]volume={mv}[duck]")
    rest.append("[duck]")
elif voice: filt.append("[key]anullsink")
mixin = (["[vox]"] if voice else []) + rest
filt.append(f"{''.join(mixin)}amix=inputs={len(mixin)}:normalize=0:duration=longest,atrim=0:{TOTAL},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[out]")
audio = os.path.join(D, "audio.wav")
run(*inputs, "-filter_complex", ";".join(filt), "-map", "[out]", "-ac", "2", audio)
run("-framerate", "30", "-i", os.path.join(D, "frames", "f%05d.jpg"), "-i", audio, "-c:v", "libx264", "-preset", "slow", "-crf", "19",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k", "-shortest", OUT)
print("wrote", OUT)
