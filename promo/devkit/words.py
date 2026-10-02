# Word timings for a narration take, for highlighting the word being spoken in the subtitles.
# Within each line, the audio's loudness envelope splits the speech into bursts at the pauses; the line's words are
# spread across the bursts by syllable count (a word goes to the burst its syllables fall in), then across each burst.
#   python3 words.py <video id>   ->  videos/<id>/words.json  [[{"w", "t0", "t1"}, ...] per line], times in the take
import json, math, os, re, sys, wave, array
D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "videos", sys.argv[1])
vo, script = json.load(open(os.path.join(D, "vo.json"))), json.load(open(os.path.join(D, "script.json")))
with wave.open(os.path.join(D, "vo.wav")) as w:
    rate = w.getframerate(); pcm = array.array("h", w.readframes(w.getnframes()))
HOP = int(rate * 0.01)
env = [math.sqrt(sum(x * x for x in pcm[i:i + HOP]) / HOP) for i in range(0, len(pcm) - HOP, HOP)]   # 10 ms RMS

def syll(word):
    w = re.sub(r"[^a-z0-9]", "", word.lower())
    if w.isdigit(): return max(2, len(w))
    n = len(re.findall(r"[aeiouy]+", w)) - (1 if w.endswith("e") and len(w) > 3 and not w.endswith("le") else 0)
    return max(1, n)

out = []
for line, sc in zip(vo["lines"], script):
    words = sc["say"].replace("<short pause>", " ").split()
    a, b = int(line["start"] * 100), int(line["end"] * 100) + 1
    seg = env[a:b]; thr = max(seg) * 0.08 if seg else 0
    bursts, cur, gap = [], None, 0
    for i, v in enumerate(seg):
        if v > thr:
            if cur is None: cur = [i, i]
            cur[1] = i; gap = 0
        elif cur is not None:
            gap += 1
            if gap >= 7: bursts.append(cur); cur = None   # a pause of 70 ms or more ends a burst
    if cur: bursts.append(cur)
    bursts = [x for x in bursts if x[1] - x[0] >= 4] or [[0, len(seg) - 1]]
    sy = [syll(w) for w in words]; S = sum(sy); dur = [x[1] - x[0] + 1 for x in bursts]; T = sum(dur)
    # give each word to the burst its syllables land in (by cumulative share)
    edges, acc = [], 0
    for d in dur: acc += d; edges.append(acc / T)
    groups = [[] for _ in bursts]; c = 0
    for i, s in enumerate(sy):
        mid = (c + s / 2) / S; c += s
        k = next(j for j, e in enumerate(edges) if mid <= e + 1e-9); groups[k].append(i)
    timed = [None] * len(words)
    for k, g in enumerate(groups):
        if not g: continue
        t0, t1 = bursts[k][0], bursts[k][1] + 1; tot = sum(sy[i] for i in g); x = t0
        for i in g:
            w0 = x; x += (t1 - t0) * sy[i] / tot
            timed[i] = {"w": words[i], "t0": round(line["start"] + w0 / 100, 3), "t1": round(line["start"] + x / 100, 3)}
    for i in range(len(timed)):   # a word that landed in an empty burst borrows its neighbour's time
        if timed[i] is None: timed[i] = dict(timed[i - 1] if i else timed[i + 1], w=words[i])
    out.append(timed)
json.dump(out, open(os.path.join(D, "words.json"), "w"), indent=1)
print(sys.argv[1], [len(x) for x in out])
