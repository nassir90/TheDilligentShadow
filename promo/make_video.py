# Assembles the promo: frames/ (from director.js) + the voice take placed line by line + synthesized switch/kick/stomp
# sounds from events.json, mixed and loudness-normalised. Usage: python3 make_video.py  ->  promo.mp4
import json, os, re, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
FPS, TOTAL = 30, 63.0
src = open("director.js").read()
LINES = [tuple(float(x) for x in m) for m in re.findall(r"\{ a: ([\d.]+), b: ([\d.]+), at: ([\d.]+),", src)]
events = json.load(open("events.json"))

def synth(name, expr, d):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"aevalsrc='{expr}':s=48000:d={d}", f"sfx_{name}.wav"], check=True)
synth("click", "0.55*sin(2*PI*2900*t)*exp(-t*220)+0.35*(random(0)*2-1)*exp(-t*420)+0.25*sin(2*PI*900*t)*exp(-t*120)", 0.09)
synth("tap", "0.35*sin(2*PI*520*t)*exp(-t*70)+0.18*(random(0)*2-1)*exp(-t*500)", 0.15)
synth("stomp", "0.8*sin(2*PI*62*t)*exp(-t*16)+0.25*sin(2*PI*130*t)*exp(-t*30)+0.15*(random(0)*2-1)*exp(-t*90)", 0.4)
kind = {"on": ("click", 0.8), "off": ("click", 0.8), "kickoff": ("click", 1.0), "thud": ("tap", 0.7), "stomp": ("stomp", 0.9)}

inputs, filt, labels = ["-i", "vo.wav"], [], []
for i, (a, b, at) in enumerate(LINES):
    d = int(at * 1000)
    filt.append(f"[0:a]atrim={a - 0.04}:{b + 0.12},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d=0.03,afade=t=out:st={b - a + 0.08}:d=0.08,adelay={d}|{d}[v{i}]")
    labels.append(f"[v{i}]")
for j, e in enumerate(events):
    name, vol = kind[e["type"]]
    k = inputs.count("-i"); inputs += ["-i", f"sfx_{name}.wav"]; d = int(e["t"] * 1000)
    filt.append(f"[{k}:a]volume={vol},adelay={d}|{d}[e{j}]"); labels.append(f"[e{j}]")
k = inputs.count("-i"); inputs += ["-f", "lavfi", "-t", str(TOTAL), "-i", "anoisesrc=color=brown:amplitude=0.012:r=48000"]
filt.append(f"[{k}:a]lowpass=f=400,afade=t=in:d=1.5,afade=t=out:st={TOTAL - 1.5}:d=1.5[room]"); labels.append("[room]")
filt.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=longest,atrim=0:{TOTAL},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[out]")
subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(filt), "-map", "[out]", "-ac", "2", "audio.wav"], check=True)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-framerate", str(FPS), "-i", "frames/f%05d.jpg", "-i", "audio.wav",
                "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                "-c:a", "aac", "-b:a", "192k", "-shortest", "promo.mp4"], check=True)
print("wrote promo.mp4")
