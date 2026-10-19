"""CADET PERSONĀLS — pārbūvē TIKAI stabilo kanālu (repo sakne) no src/.
Lietošana: python3 src/_buvesana/build_stable.py [repo_mape]
Pārraksta index.html, app.bundle.js, sw.js, version.json. test/, vendor/, docs/, src/ paliek.
Neizdzēš citus failus (atšķirībā no build_web.py)."""
import os, re, sys, json
here = os.path.dirname(os.path.abspath(__file__))
repo = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', '..'))
src, out = f'{repo}/src', repo
ver = re.search(r"CP.VERSION = '([^']+)'", open(f'{src}/js/core.js', encoding='utf-8').read()).group(1)

bw = open(os.path.join(here, 'build_web.py'), encoding='utf-8').read()
env = {}
exec(re.search(r'^CSP = \(.*?\)\n', bw, re.S | re.M).group(0), env)
CSP = env['CSP']

html = open(f'{src}/index.html', encoding='utf-8').read()
scripts = re.findall(r'<script src="(js/[^"]+)"></script>', html)
bundle = [f'/* CADET PERSONĀLS — apvienots no {len(scripts)} failiem (avots: mape js/). Nelabo šo failu — labo js/ un būvē no jauna. */']
for s in scripts:
    bundle.append(f'\n/* ==== {s} ==== */\n' + open(f'{src}/{s}', encoding='utf-8').read())
state = {'js': True, 'css': True}
def js_repl(m):
    r = f'<script src="app.bundle.js?v={ver}"></script>' if state['js'] else ''
    state['js'] = False; return r
html = re.sub(r'<script src="js/[^"]+"></script>\n?', js_repl, html)
links = re.findall(r'<link rel="stylesheet" href="(css/[^"]+)">\n?', html)
css = '\n'.join(open(f'{src}/{l}', encoding='utf-8').read() for l in links)
def css_repl(m):
    r = '<style>\n' + css + '\n</style>\n' if state['css'] else ''
    state['css'] = False; return r
html = re.sub(r'<link rel="stylesheet" href="css/[^"]+">\n?', css_repl, html)
head = (f'<meta http-equiv="Content-Security-Policy" content="{CSP}">\n'
        f'<meta name="cp-channel" content="stable">\n<meta name="cp-vendor" content="vendor/">\n'
        '<meta name="theme-color" content="#0b1219">\n<link rel="manifest" href="manifest.webmanifest">\n'
        '<link rel="icon" href="icons/icon-192.png">\n<link rel="apple-touch-icon" href="icons/icon-192.png">\n')
html = html.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n' + head, 1)

open(f'{out}/app.bundle.js', 'w', encoding='utf-8').write('\n'.join(bundle))
open(f'{out}/index.html', 'w', encoding='utf-8').write(html)
sw = open(os.path.join(here, 'sw.template.js'), encoding='utf-8').read()
open(f'{out}/sw.js', 'w', encoding='utf-8').write(sw.replace('__CACHE__', f'cadet-stable-{ver}').replace('__PREFIX__', 'cadet-stable-'))
json.dump({'version': ver}, open(f'{out}/version.json', 'w', encoding='utf-8'))
print('stabilā versija', ver, '·', len(scripts), 'faili →', os.path.getsize(f'{out}/app.bundle.js'), 'B')
