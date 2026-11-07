#!/usr/bin/env python3
"""THE LAN'S SERVER (Howell 2026-11-04): the room's manners on the LAN.

`python3 -m http.server` sent the phone every edition's charts raw — 73 MB
under ?uncleared=true, against the room's precompressed copies — and no
cache header, so Chrome kept yesterday's bundle on a guess. On the Moto G
the late editions were still arriving, drawn hollow, minutes after the
room had filled the same ring. This serves the `.gz` beside a file when the
browser accepts gzip (the files precompress already writes for the room),
and says `no-cache` as the room does, so every build is fetched fresh.

Usage: lan-server.py PORT DIRECTORY
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        gz = path + '.gz'
        if ('gzip' in self.headers.get('Accept-Encoding', '')
                and os.path.isfile(path) and os.path.isfile(gz)
                and os.path.getmtime(gz) >= os.path.getmtime(path)):   # a stale .gz is never served
            try:
                f = open(gz, 'rb')
            except OSError:
                return super().send_head()
            fs = os.fstat(f.fileno())
            self.send_response(200)
            self.send_header('Content-Type', self.guess_type(path))
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Vary', 'Accept-Encoding')
            self.send_header('Content-Length', str(fs.st_size))
            self.send_header('Last-Modified', self.date_time_string(fs.st_mtime))
            self.end_headers()
            return f
        return super().send_head()


if __name__ == '__main__':
    port, directory = int(sys.argv[1]), sys.argv[2]
    ThreadingHTTPServer(('0.0.0.0', port), partial(Handler, directory=directory)).serve_forever()
