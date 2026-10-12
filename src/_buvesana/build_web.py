"""CADET PERSONĀLS — tīmekļa (GitHub Pages) būvējums.
Lietošana: python3 -I build_web.py <avota_mape> <repo_mape> <tesseract_node_modules>
Izveido: / (stabilā), /test/ (testa kanāls), /vendor (kopīgs), /src (avots)."""
import os, re, sys, shutil, json, subprocess
from PIL import Image
src, repo, nm = sys.argv[1], sys.argv[2], sys.argv[3]
here = os.path.dirname(os.path.abspath(__file__))
ver = re.search(r"CP.VERSION = '([^']+)'", open(f'{src}/js/core.js', encoding='utf-8').read()).group(1)

# notīra visu, izņemot .git
for n in os.listdir(repo):
    if n == '.git': continue
    p = os.path.join(repo, n); shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)

CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; "
       "connect-src 'self' blob: data: https://vision.googleapis.com; worker-src 'self' blob:; frame-src 'self' blob:; "
       "object-src 'none'; base-uri 'self'; form-action 'none'; manifest-src 'self'")

def build(channel, out, vendor_rel, design=''):
    tmp = out + '.__tmp'
    subprocess.run([sys.executable, '-I', os.path.join(here, 'build.py'), src, tmp], check=True, stdout=subprocess.DEVNULL)
    os.makedirs(out, exist_ok=True)
    for f in ['app.bundle.js', 'PS_LOGO.png']: shutil.move(f'{tmp}/{f}', f'{out}/{f}')
    html = open(f'{tmp}/index.html', encoding='utf-8').read()
    head = (f'<meta http-equiv="Content-Security-Policy" content="{CSP}">\n'
            f'<meta name="cp-channel" content="{channel}">\n<meta name="cp-vendor" content="{vendor_rel}">\n'
            '<meta name="theme-color" content="#0b1219">\n<link rel="manifest" href="manifest.webmanifest">\n'
            '<link rel="icon" href="icons/icon-192.png">\n<link rel="apple-touch-icon" href="icons/icon-192.png">\n')
    html = html.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n' + head, 1)
    if channel == 'test':
        html = html.replace('<title>CADET PERSONĀLS</title>', '<title>CADET PERSONĀLS (TESTS)</title>')
    if design: html = html.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n<meta name="cp-design" content="' + design + '">', 1)
    html = html.replace('url("vendor/', 'url("' + vendor_rel)
    open(f'{out}/index.html', 'w', encoding='utf-8').write(html)
    shutil.rmtree(tmp)
    name = 'CADET PERSONĀLS' + (' (TESTS)' if channel == 'test' else '')
    json.dump({'name': name, 'short_name': 'CADET' + (' TESTS' if channel == 'test' else ''), 'start_url': './', 'scope': './',
               'display': 'standalone', 'background_color': '#0b1219', 'theme_color': '#0b1219', 'lang': 'lv',
               'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
                         {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'}]},
              open(f'{out}/manifest.webmanifest', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    sw = open(os.path.join(here, 'sw.template.js'), encoding='utf-8').read()
    sw = sw.replace('__CACHE__', f'cadet-{channel}-{ver}').replace('__PREFIX__', f'cadet-{channel}-')
    open(f'{out}/sw.js', 'w', encoding='utf-8').write(sw)

# Dizaina karogs: CP_DESIGN_STABLE / CP_DESIGN_TEST (piem. 'v2'); testa kanālam pēc noklusējuma v2
build('stable', repo, 'vendor/', os.environ.get('CP_DESIGN_STABLE', ''))
build('test', f'{repo}/test', '../vendor/', os.environ.get('CP_DESIGN_TEST', ''))   # dizaina karogs nāk no src/index.html

# kopīgais vendor
v = f'{repo}/vendor'
shutil.copytree(f'{src}/vendor', v)
t = f'{v}/tesseract'; os.makedirs(f'{t}/core'); os.makedirs(f'{t}/lang')
for f in ['tesseract.min.js', 'worker.min.js']: shutil.copy(f'{nm}/tesseract.js/dist/{f}', t)
for f in ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']: shutil.copy(f'{nm}/tesseract.js-core/{f}', f'{t}/core')
for l in ['lav', 'eng']: shutil.copy(f'{nm}/@tesseract.js-data/{l}/4.0.0_best_int/{l}.traineddata.gz', f'{t}/lang')
shutil.copy(f'{nm}/tesseract.js/LICENSE.md' if os.path.exists(f'{nm}/tesseract.js/LICENSE.md') else f'{nm}/tesseract.js-core/LICENSE', f'{t}/LICENSE.txt')
im = Image.open(f'{src}/PS_LOGO.png').convert('RGBA')
for s in (192, 512):
    c = im.copy(); c.thumbnail((s, s), Image.LANCZOS)
    bg = Image.new('RGBA', (s, s), (11, 18, 25, 255)); bg.alpha_composite(c, ((s - c.width) // 2, (s - c.height) // 2))
    for d in (repo, f'{repo}/test'):
        os.makedirs(f'{d}/icons', exist_ok=True); bg.convert('RGB').quantize(256).save(f'{d}/icons/icon-{s}.png', optimize=True)
with open(f'{v}/LICENCES.txt', 'a', encoding='utf-8') as f:
    f.write('\nTesseract.js 7.0.0 un tesseract.js-core 7.0.0 — Apache-2.0 (https://github.com/naptha/tesseract.js). Valodu dati lav/eng 4.0.0_best_int — Apache-2.0 (tesseract-ocr/tessdata).\n')

# avots uzturēšanai
os.makedirs(f'{repo}/src')
for d in ['js', 'css']: shutil.copytree(f'{src}/{d}', f'{repo}/src/{d}')
shutil.copy(f'{src}/index.html', f'{repo}/src/index.html')
shutil.copy(f'{src}/PS_LOGO.png', f'{repo}/src/PS_LOGO.png')
os.makedirs(f'{repo}/src/_buvesana')
for f in ['build.py', 'build_web.py', 'sw.template.js', 'README.repo.md']: shutil.copy(os.path.join(here, f), f'{repo}/src/_buvesana/')
for f in ['CHANGELOG.md']: shutil.copy(f'{src}/{f}', repo)
shutil.copy(os.path.join(here, 'README.repo.md'), f'{repo}/README.md')
open(f'{repo}/.nojekyll', 'w').close()
open(f'{repo}/.gitignore', 'w').write('# Personu dati NEKAD nenonāk repozitorijā\nCADET_PERSONALS_DATI*.json\n*.raksta\n_rezerves/\n_arhivi/\nRezerves_kopijas/\nMacibu_gadi/\nDokumenti/\n!src/**\n')
print('versija', ver)
