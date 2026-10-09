"""Serve candidate bytes through the same release contract used by GitHub."""
import argparse
import functools
import http.server
import json
import pathlib

parser = argparse.ArgumentParser()
parser.add_argument('directory')
parser.add_argument('version')
parser.add_argument('port_file')
args = parser.parse_args()
root = pathlib.Path(args.directory).resolve()

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if pathlib.Path(args.port_file).with_name('corrupt').exists() and self.path.endswith('.tar.gz'):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'broken download')
            return
        if self.path.startswith('/releases'):
            release = {
                'tag_name': 'v' + args.version,
                'prerelease': '-' in args.version,
                'draft': False,
                'assets': [{'name': p.name, 'browser_download_url': f'http://127.0.0.1:{self.server.server_port}/{p.name}'}
                           for p in root.iterdir() if p.is_file()],
            }
            body = json.dumps(release if '/tags/' in self.path else [release]).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(root)))
pathlib.Path(args.port_file).write_text(str(server.server_port))
server.serve_forever()
