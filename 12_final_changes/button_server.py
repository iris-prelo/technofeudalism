"""Serve the project and the two Raspberry Pi 5 button states on one origin."""

import argparse
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


PROJECT = Path(__file__).resolve().parent


def make_handler(up_button, down_button):
    class ButtonHandler(SimpleHTTPRequestHandler):
        def do_GET(self):
            path = urlsplit(self.path).path
            if path in ('/', '/index.html'):
                html = (PROJECT / 'index.html').read_bytes()
                html = html.replace(b'<meta name="gpio-bridge" content="off" />',
                                    b'<meta name="gpio-bridge" content="on" />')
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(html)))
                self.end_headers()
                self.wfile.write(html)
                return
            if path != '/buttons':
                return super().do_GET()

            body = json.dumps({
                'up': bool(up_button.is_pressed),
                'down': bool(down_button.is_pressed),
            }).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    return partial(ButtonHandler, directory=str(PROJECT))


def main():
    parser = argparse.ArgumentParser(description='Pi 5 GPIO button web server')
    parser.add_argument('--host', default='127.0.0.1', help='Use 0.0.0.0 to access the Pi from another computer')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()

    from gpiozero import Button
    from gpiozero.pins.lgpio import LGPIOFactory
    # Pi 5 uses lgpio; the buttons connect their BCM GPIO pins to GND.
    pin_factory = LGPIOFactory()
    up_button = Button(17, pull_up=True, bounce_time=0.02, pin_factory=pin_factory)
    down_button = Button(5, pull_up=True, bounce_time=0.02, pin_factory=pin_factory)
    up_button.when_pressed = lambda: print('GPIO17 / UP pressed', flush=True)
    up_button.when_released = lambda: print('GPIO17 / UP released', flush=True)
    down_button.when_pressed = lambda: print('GPIO5 / DOWN pressed', flush=True)
    down_button.when_released = lambda: print('GPIO5 / DOWN released', flush=True)
    try:
        with ThreadingHTTPServer((args.host, args.port), make_handler(up_button, down_button)) as server:
            print(f'Open http://{args.host}:{args.port}/index.html')
            server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        up_button.close()
        down_button.close()
        pin_factory.close()


if __name__ == '__main__':
    main()
