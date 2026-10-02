# Local helper for the video tooling. Serves files under promo/ (and the exhibit's source as /src/exhibit.js) to
# the pages that record and compose frames, and writes the frames and data they POST back.
#   POST /batch            body: lines of "<path under promo/> <base64>"
#   POST /<path>           body: raw bytes, written to promo/<path>
#   GET  /<path>           a file under promo/
import base64, http.server, mimetypes, os, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "..", "public", "games", "thedilligentshadow", "exhibit.js")

def safe(rel):
    p = os.path.normpath(os.path.join(ROOT, rel.lstrip("/")))
    if not p.startswith(ROOT): raise ValueError(rel)
    return p

class H(http.server.BaseHTTPRequestHandler):
    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
    def do_OPTIONS(self): self.send_response(204); self.cors(); self.end_headers()
    def write(self, rel, data):
        p = safe(rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "wb").write(data)
    def do_POST(self):
        rel = self.path.split("?")[0]
        data = self.rfile.read(int(self.headers["Content-Length"]))
        if rel == "/batch":
            for line in data.decode().split("\n"):
                if line: name, b64 = line.split(" ", 1); self.write(name, base64.b64decode(b64))
        else:
            # old director.js posts bare frame names: those go to frames/
            self.write(rel if "/" in rel.strip("/") or not rel.endswith(".jpg") else "frames" + rel, data)
        self.send_response(200); self.cors(); self.end_headers(); self.wfile.write(b"ok")
    def do_GET(self):
        rel = self.path.split("?")[0]
        try: p = SRC if rel == "/src/exhibit.js" else safe(rel)
        except ValueError: p = None
        if not p or not os.path.isfile(p): self.send_response(404); self.cors(); self.end_headers(); return
        self.send_response(200); self.cors()
        self.send_header("Content-Type", mimetypes.guess_type(p)[0] or "application/octet-stream")
        self.send_header("Cache-Control", "no-store"); self.end_headers()
        self.wfile.write(open(p, "rb").read())
    def log_message(self, *a): pass

http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8781), H).serve_forever()
