# Receives frames POSTed by the director (director.js) and writes them to frames/; also accepts events.json.
import base64, http.server, os, sys
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frames")
os.makedirs(OUT, exist_ok=True)
class H(http.server.BaseHTTPRequestHandler):
    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
    def do_OPTIONS(self): self.send_response(204); self.cors(); self.end_headers()
    def do_POST(self):
        name = os.path.basename(self.path)
        data = self.rfile.read(int(self.headers["Content-Length"]))
        if name == "batch":   # lines of "<file name> <base64 jpeg>"
            for line in data.decode().split("\n"):
                fn, b64 = line.split(" ", 1)
                open(os.path.join(OUT, os.path.basename(fn)), "wb").write(base64.b64decode(b64))
            self.send_response(200); self.cors(); self.end_headers(); self.wfile.write(b"ok"); return
        open(os.path.join(OUT if name.endswith(".jpg") else os.path.dirname(OUT), name), "wb").write(data)
        self.send_response(200); self.cors(); self.end_headers(); self.wfile.write(b"ok")
    def do_GET(self):   # serves director.js to the page
        p = os.path.join(os.path.dirname(OUT), os.path.basename(self.path.split("?")[0]))
        if not p.endswith(".js") or not os.path.exists(p): self.send_response(404); self.end_headers(); return
        self.send_response(200); self.cors(); self.send_header("Content-Type", "text/javascript"); self.end_headers()
        self.wfile.write(open(p, "rb").read())
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8781), H).serve_forever()
