# Video pipeline: status and how to rebuild

Hand-off notes for the promo and devlog videos, so the work doesn't depend on anyone's memory of the conversation.

## Where things live

| What | Where | In git? |
|---|---|---|
| Tooling | `devkit/` (rec.js, clips.js, clips_ink.js, compose.js, build.py, music.py, words.py, cdp.mjs, …), `framesink.py`, `voice.py`, `director.js` (promo) | yes |
| Per video: script, timings, edit list | `videos/<id>/script.json`, `vo.json`, `words.json`, `edl.js` (`edl.classic.js` = previous version) | yes (not `vo.wav`) |
| Narration audio | `videos/<id>/vo.wav` | no, regenerate with `voice.py` |
| Recorded clips | `clips/<name>/` (frames + `meta.json`) | no, re-record with `rec.js` |
| Composited frames | `videos/<id>/frames/` | no, re-compose |
| Finished videos | `out/*.mp4` (`*-light.mp4` = under 30 MB copies) | no |

## Status

| Video | Style | Notes |
|---|---|---|
| 01 promo | original (director.js) | re-render against the current exhibit in the final pass |
| 02 Planted feet | **ink** | done; script still opens with "Devlog." |
| 03 The cloak that wouldn't sit still | **ink** | done; script still opens with "Devlog."; "before" shots need the old build (see below) |
| 04 Her hair is cloth | **ink** | done; script rewritten in plain sentences (the model for the rest) |
| 05 The visitor's hand | **ink** | done; script still opens with "How it works:" |
| 06 The invisible cast, 07 Rigging her, 08 Smoothing her out, 09 Her brain is a state machine | classic | not yet restyled (their clips have labels baked in: they need ink clip versions with annotation data) |
| 10 The Visitor, 11 The Shadow | cinematic | done; procedural score |

**Next: the final re-render of everything.** Before it:
- Rewrite every script in plain, complete sentences (see the hair script): no spoken "Devlog." / "How it works:" openers, no punchy fragments, accurate words for what's on screen, no disclaimers.
- Restyle 06–09 in the ink style.
- Re-record all clips against the current exhibit (foot fix `ee64692` and later).

## Ink style (agreed)

- Full-bleed video. The title is inked Times New Roman (black over light, white over dark, per pixel) at the start, then fades.
- Subtitles are inked Times New Roman, at most two lines per page, paged over time, breaking at sentences, then commas. The spoken word is cut out of an inked block.
- "before" / "after": lowercase, regular-weight, square inked blocks with the word cut out. No divider between the halves.
- Code: translucent black box, white **Menlo** (no line numbers), placed just above the subtitles.
- Graphs: same black box; white lines, solid for before, dashed for after.
- Callouts: a small circle on the feature; a leader that runs on to underline a Times New Roman label. No arrowheads. Labels stay put and glide only when the feature moves far, and they fade in and out.
- Checks run on every compose: text crowding (`STATUS.crowd`, must be 0) and clip overruns (`STATUS.overrun`, must be empty, otherwise lengthen the clip).

## Rebuild steps

```sh
cd promo
python3 framesink.py 8781 &                                  # serves devkit/ and receives frames
node devkit/cdp.mjs launch <scratch>/chrome-profile          # headless Chrome (the hidden app pane is throttled)
# narration (key file + project from the environment)
GCP_PROJECT=<project> STYLE="clear, warm, friendly, unhurried" python3 voice.py <key> videos/<id>/vo.wav videos/<id>/script.json
GCP_PROJECT=<project> python3 devkit/check_take.py <key> videos/<id>/vo.wav videos/<id>/script.json   # extra/missing words
#   then set lines[0].start = 0 in vo.json, and:
python3 devkit/words.py <id>
# clips (ink): open the exhibit, then
node devkit/cdp.mjs open "http://localhost:8780/games/thedilligentshadow/?h=1"
node devkit/cdp.mjs eval -e "window.INK=true; window.GROUPS='<id>'; window.NAMES=''; return 1"
node devkit/cdp.mjs eval devkit/run_named.js
# compose and build
node devkit/cdp.mjs open "http://127.0.0.1:8781/devkit/compose.html"
node devkit/cdp.mjs eval -e "await COMPOSE.run('<id>'); return JSON.stringify({crowd: STATUS.crowd, overrun: STATUS.overrun})"
python3 devkit/build.py <id> out/<id>.mp4
```

The exhibit itself is served by the `site` preview (`python3 -m http.server 8780 --directory public`).

The cloak's "before" clips (`03-cloak-old` group) must be recorded in the build before the boot and friction fixes. To get it:
`git show e17f029:public/games/thedilligentshadow/exhibit.js > public/games/thedilligentshadow/exhibit-e17f029.js` and a copy of `index.html` pointing at it (`old-e17f029.html`). Delete both afterwards.
