# Contact sheet: 3 frames (20/50/80%) from each named clip, 240px tiles, 6 per row.  python3 sheet.py out.jpg clip...
import os, subprocess, sys
out, names = sys.argv[1], sys.argv[2:]
inputs, filt, n = [], [], 0
for c in names:
    fr = sorted(f for f in os.listdir(f"clips/{c}") if f.endswith(".jpg"))
    for k in (0.2, 0.5, 0.8):
        inputs += ["-i", f"clips/{c}/{fr[int(len(fr) * k)]}"]
        filt.append(f"[{n}]scale=240:240:force_original_aspect_ratio=decrease,pad=240:240:(ow-iw)/2:(oh-ih)/2[s{n}]"); n += 1
lay = "|".join(f"{(k % 6) * 240}_{(k // 6) * 240}" for k in range(n))
filt.append("".join(f"[s{k}]" for k in range(n)) + f"xstack=inputs={n}:layout={lay}:fill=black")
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(filt), out], check=True)
