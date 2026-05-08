"""
Jira Proxy — forwards requests to Jira using your browser session cookie.

RUN:
  python jira-proxy.py

Then open the Work Task Tracker in your browser, go to Settings, and paste
your Jira cookie there. No file editing needed — the UI handles everything.

STOP:
  Ctrl+C
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import URLError
import json
import os

PORT        = 3333
JIRA_HOST   = 'https://telushealth.atlassian.net'
COOKIE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'jira-cookie.txt')


def get_cookie():
    try:
        with open(COOKIE_FILE, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except FileNotFoundError:
        return None


def save_cookie(cookie):
    with open(COOKIE_FILE, 'w', encoding='utf-8') as f:
        f.write(cookie)


class JiraProxy(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == '/_status':
            self._status()
        else:
            self._proxy()

    def do_POST(self):
        if self.path == '/_set-cookie':
            self._handle_set_cookie()
        else:
            self._proxy()

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept')

    def _json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ── Special endpoints ─────────────────────────────────────────────────────

    def _status(self):
        cookie = get_cookie()
        self._json(200, {'running': True, 'hasCookie': bool(cookie)})

    def _handle_set_cookie(self):
        length = int(self.headers.get('Content-Length', 0))
        body   = self.rfile.read(length)
        try:
            data   = json.loads(body)
            cookie = data.get('cookie', '').strip()
            if not cookie:
                self._json(400, {'error': 'Cookie value is empty'}); return
            save_cookie(cookie)
            print(f'  Cookie updated ({len(cookie)} chars) → {COOKIE_FILE}')
            self._json(200, {'ok': True})
        except Exception as e:
            self._json(500, {'error': str(e)})

    # ── Proxy ─────────────────────────────────────────────────────────────────

    def _proxy(self):
        cookie = get_cookie()
        if not cookie:
            self._json(503, {'error': 'No cookie set. Open the tracker → Settings → paste your Jira cookie.'})
            return

        url  = JIRA_HOST + self.path
        body = None
        if self.command == 'POST':
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length) if length else None

        req = Request(url, data=body, method=self.command)
        req.add_header('Cookie',       cookie)
        req.add_header('Accept',       self.headers.get('Accept',       'application/json'))
        req.add_header('Content-Type', self.headers.get('Content-Type', 'application/json'))
        req.add_header('User-Agent',   'Mozilla/5.0')

        try:
            with urlopen(req) as resp:
                data = resp.read()
                print(f'  {self.command} {self.path} → {resp.status}')
                self.send_response(resp.status)
                self._cors()
                self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/json'))
                self.end_headers()
                self.wfile.write(data)
        except URLError as e:
            print(f'  Error: {e}')
            self._json(502, {'error': str(e)})

    def log_message(self, *args):
        pass  # suppress default access log noise


if __name__ == '__main__':
    cookie = get_cookie()
    print(f'\n  Jira proxy running → http://localhost:{PORT}')
    print(f'  Forwarding to {JIRA_HOST}')
    if cookie:
        print(f'  Cookie loaded from file ({len(cookie)} chars)')
    else:
        print('  No cookie yet — open the tracker Settings to add yours')
    print('  Press Ctrl+C to stop.\n')
    HTTPServer(('', PORT), JiraProxy).serve_forever()
