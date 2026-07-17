#!/usr/bin/env python3
"""LAN dev server: http.server + Cache-Control: no-store, so phones can
never test a stale bundle (the C.2 Moto G incident). Usage:
    python3 scripts/lan-server.py [port]     (default 8080)"""
import http.server, socketserver, sys

class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
with socketserver.ThreadingTCPServer(('0.0.0.0', port), NoStoreHandler) as httpd:
    print(f'LAN server (no-store) on 0.0.0.0:{port}')
    httpd.serve_forever()
