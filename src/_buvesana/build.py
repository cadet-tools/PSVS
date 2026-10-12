import re, sys, os, shutil
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
html = open(f'{src}/index.html', encoding='utf-8').read()
scripts = re.findall(r'<script src="(js/[^"]+)"></script>', html)
bundle = [f'/* CADET PERSONĀLS — apvienots no {len(scripts)} failiem (avots: mape js/). Nelabo šo failu — labo js/ un būvē no jauna. */']
for s in scripts:
    bundle.append(f'\n/* ==== {s} ==== */\n' + open(f'{src}/{s}', encoding='utf-8').read())
open(f'{out}/app.bundle.js', 'w', encoding='utf-8').write('\n'.join(bundle))
first = True
def repl(m):
    global first
    r = '<script src="app.bundle.js"></script>' if first else ''
    first = False; return r
html = re.sub(r'<script src="js/[^"]+"></script>\n?', repl, html)
css = open(f'{src}/css/app.css', encoding='utf-8').read()
html = html.replace('<link rel="stylesheet" href="css/app.css">', '<style>\n' + css + '\n</style>')
open(f'{out}/index.html', 'w', encoding='utf-8').write(html)
im = Image.open(f'{src}/PS_LOGO.png'); im.thumbnail((192, 192), Image.LANCZOS)
im = im.quantize(colors=256, method=Image.FASTOCTREE) if im.mode == 'RGBA' else im
im.save(f'{out}/PS_LOGO.png', optimize=True)
shutil.copytree(f'{src}/vendor', f'{out}/vendor')
shutil.copytree(f'{src}/js', f'{out}/js')   # avots uzturēšanai; index.html to neielādē
shutil.copytree(f'{src}/css', f'{out}/css')
for f in ['README.md', 'CHANGELOG.md', 'UZSTADISANA_DARBA_DATORA.md']: shutil.copy(f'{src}/{f}', out)
print(len(scripts), 'faili →', os.path.getsize(f'{out}/app.bundle.js'), 'B; logo', os.path.getsize(f'{out}/PS_LOGO.png'), 'B')
