# Line timings for a narration take, by aligning the whole transcript to the whole script in order.
# The take is cut into chunks at its pauses (silencedetect); each chunk's transcript (vo.json "heard", in order) is
# laid end to end and matched word-for-word against the script with difflib, so each line starts at the chunk holding
# its first word. Matching in sequence means a later line that shares words ("frames", "steps") can't steal a chunk.
#   python3 align.py <video id>      (rewrites videos/<id>/vo.json "lines"; keeps "heard")
import difflib, json, os, re, subprocess, sys, wave
D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "videos", sys.argv[1])
VO, script, vo = os.path.join(D, "vo.wav"), json.load(open(os.path.join(D, "script.json"))), json.load(open(os.path.join(D, "vo.json")))

def chunks(path):
    with wave.open(path) as w: dur = w.getnframes() / w.getframerate()
    log = subprocess.run(["ffmpeg", "-i", path, "-af", "silencedetect=noise=-38dB:d=0.18", "-f", "null", "-"], capture_output=True, text=True).stderr
    s0 = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]; s1 = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    gaps = [(a, b) for a, b in zip(s0, s1) if a > .05 and b < dur - .05]
    cuts = [0.0] + [(a + b) / 2 for a, b in gaps] + [dur]
    starts = [0.0] + [b for a, b in gaps]          # speech in chunk k starts at the end of the pause before it
    return dur, gaps, list(zip(starts, cuts[1:])), s0, s1

def align(heard, script, dur, gaps, spans, s0, s1):
    words = lambda s: re.findall(r"[a-z0-9']+", s.lower().replace("%", " percent"))
    hw, hc = [], []                                # transcript words and the chunk each came from
    for k, h in enumerate(heard):
        if h.lower().startswith("transcribe this"): continue   # the transcriber echoing its prompt: no speech there
        for w in words(h): hw.append(w); hc.append(k)
    sw, first = [], []                             # script words, and each line's first word index
    for l in script: first.append(len(sw)); sw += words(l["say"].replace("<short pause>", " "))
    sm = difflib.SequenceMatcher(None, sw, hw, autojunk=False)
    m = {}
    for a, b, n in sm.get_matching_blocks():
        for i in range(n): m[a + i] = b + i
    lines = []
    for li, f in enumerate(first):
        last = first[li + 1] if li + 1 < len(first) else len(sw)
        hit = next((m[i] for i in range(f, last) if i in m), None)
        k = hc[hit] if hit is not None else None
        lines.append({"line": script[li]["say"], "start": round(spans[k][0], 3) if k is not None else None})
    lines[0]["start"] = 0.0
    for i, tm in enumerate(lines):                 # a line ends where the pause before the next one begins
        nxt = lines[i + 1]["start"] if i + 1 < len(lines) else None
        if nxt is not None: tm["end"] = round(max([a for a, b in gaps if tm["start"] < a < nxt] or [nxt]), 3)
        else:
            tail = [a for a, b in zip(s0, s1 + [dur] * (len(s0) - len(s1))) if b >= dur - 0.05 and a > tm["start"]]
            tm["end"] = round(tail[0] if tail else dur, 3)
    return lines

if __name__ == "__main__":
    dur, gaps, spans, s0, s1 = chunks(VO)
    assert len(spans) == len(vo["heard"]), (len(spans), len(vo["heard"]))
    vo["lines"] = align(vo["heard"], script, dur, gaps, spans, s0, s1)
    json.dump(vo, open(os.path.join(D, "vo.json"), "w"), indent=1)
    print(json.dumps([(round(l["start"], 2), round(l["end"], 2), l["line"][:40]) for l in vo["lines"]], indent=0))
