# Contact sheet of a composed video: every `step` seconds, 270x480 tiles, 8 per row.  python3 vsheet.py <id> out.jpg [step]
import os, subprocess, sys
vid, out = sys.argv[1], sys.argv[2]; step = float(sys.argv[3]) if len(sys.argv) > 3 else 3
fr = sorted(f for f in os.listdir(f"videos/{vid}/frames") if f.endswith(".jpg"))
pick = fr[int(step * 15)::int(step * 30)][:24]
inputs, filt = [], []
for i, f in enumerate(pick): inputs += ["-i", f"videos/{vid}/frames/{f}"]; filt.append(f"[{i}]scale=270:480[s{i}]")
n = len(pick); lay = "|".join(f"{(k % 8) * 270}_{(k // 8) * 480}" for k in range(n))
filt.append("".join(f"[s{k}]" for k in range(n)) + f"xstack=inputs={n}:layout={lay}:fill=black")
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(filt), out], check=True)
