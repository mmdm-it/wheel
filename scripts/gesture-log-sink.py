#!/usr/bin/env python3
# GESTURE LOG SINK (O-153) — a bench-only receiver for the app's gesture log.
# The app, opened on the LAN with ?gesturelog=1, sends batches of its tap and
# stroke events here as text/plain beacons (no CORS preflight); each batch is
# appended as one JSON line to the file named on the command line.
#
#   python3 scripts/gesture-log-sink.py <out.jsonl> [port=8089]
import sys, json, time
from http.server import BaseHTTPRequestHandler, HTTPServer

OUT = sys.argv[1]
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8089

class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(n).decode('utf-8', 'replace')
        with open(OUT, 'a') as f:
            f.write(json.dumps({'recv': time.time(), 'ua': self.headers.get('User-Agent', '')[:80], 'batch': body}) + '\n')
        self.send_response(204); self._cors(); self.end_headers()
    def log_message(self, *a):
        pass

HTTPServer(('0.0.0.0', PORT), H).serve_forever()
