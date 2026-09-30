"""Scan assets/<platform>/ for images and write the static browser manifest."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'assets'
ALIASES = {
    'google.com': ('google',),
    'youtube.com': ('youtube',),
    'facebook.com': ('facebook',),
    'instagram.com': ('instagram',),
    'chatgpt.com': ('chatgpt', 'chat gpt'),
    'x.com': ('x', 'twitter'),
    'reddit.com': ('reddit',),
    'bing.com': ('bing',),
    'tiktok.com': ('tiktok', 'tik tok'),
    'whatsapp.com': ('whatsapp', 'whats app'),
    'yahoo.co.jp': ('yahoo japan', 'yahoojp', 'yahoo co jp'),
    'amazon.com': ('amazon',),
    'yahoo.com': ('yahoo',),
    'yandex.ru': ('yandex',),
    'ads': ('adds', 'ads', 'advertising'),
}
EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg'}
normalize = lambda name: ''.join(char for char in name.casefold() if char.isalnum())
folders = {normalize(folder.name): folder for folder in ASSETS.iterdir() if folder.is_dir()}
manifest = {}
for website, names in ALIASES.items():
    folder = next((folders[normalize(name)] for name in names if normalize(name) in folders), None)
    images = [] if folder is None else sorted(
        file.relative_to(ROOT).as_posix()
        for file in folder.rglob('*')
        if file.is_file() and file.suffix.casefold() in EXTENSIONS
        and all(not part.startswith('.') and part != '__MACOSX' for part in file.relative_to(folder).parts)
    )
    manifest[website] = images
    print(f'{website:16} {len(images):3} images' + (f'  ({folder.name})' if folder else '  (folder missing)'))
output = ASSETS / 'content-manifest.json'
output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'\nWrote {output}')
