"""Smoke-test a deployed showcase through real HTTPS navigation.

Usage: python tests/hosted.py https://owner.github.io/TreeDataGridWeb/
This never invokes external feeds, filesystem pickers, or clipboard permission prompts.
"""
from pathlib import Path
import json
import os
import shutil
import sys
import time
from urllib.parse import urljoin
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = sys.argv[1].rstrip('/') + '/' if len(sys.argv) > 1 else ''
if not BASE.startswith(('http://', 'https://')):
    raise SystemExit('Supply an HTTP(S) showcase URL.')
OUT = ROOT / 'verification' / 'hosted'
OUT.mkdir(parents=True, exist_ok=True)
results = []
errors = []

# Pages/CDN propagation can lag the successful build. Retry only readiness.
for attempt in range(30):
    try:
        with urlopen(BASE + '?readiness=' + str(int(time.time())), timeout=20) as response:
            html = response.read().decode('utf-8')
            assert response.status == 200 and 'tree-data-grid' in html
        break
    except Exception:
        if attempt == 29:
            raise
        time.sleep(5)

with sync_playwright() as p:
    executable = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
    browser = p.chromium.launch(**({'executable_path': executable} if executable else {}), headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 980})
    page = context.new_page()
    page.set_default_timeout(20000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    response = page.goto(BASE, wait_until='networkidle')
    assert response and response.status == 200
    page.wait_for_function('window.demo && demo.grid.Stats.RealizedRows > 0')
    for name in ['people', 'countries', 'variable', 'files', 'articles', 'drag', 'templates', 'find', 'stress', 'shared']:
        page.evaluate('(name) => demo.switchDemo(name)', name)
        page.wait_for_function('demo.grid.Model === demo.current.source && demo.grid.Stats.RealizedRows > 0')
        page.wait_for_timeout(150)
        state = page.evaluate('({rows: demo.grid.Rows.Count, realized: demo.grid.Stats.RealizedRows, core: demo.grid.Source === null && demo.grid.Rows === demo.current.source.Rows})')
        assert state['core'] and 0 < state['realized'] < 100, (name, state)
        results.append({'view': name, 'passed': True, **state})
    page.evaluate("demo.switchDemo('people')")
    page.wait_for_timeout(200)
    page.locator('#grid .cell[data-row="0"][data-column="0"]').click()
    page.keyboard.press('F2')
    page.locator('#grid .editor').fill('Hosted edit check')
    page.keyboard.press('Enter')
    page.wait_for_function('demo.current.source.Items.Get(0).Name === "Hosted edit check"')
    page.evaluate('demo.grid.Undo()')
    page.wait_for_function('demo.current.source.Items.Get(0).Name === "Alex Morgan"')
    results.append({'check': 'HTTPS module editing and undo', 'passed': True})
    page.screenshot(path=str(OUT / 'showcase.png'), full_page=True)
    response = page.goto(urljoin(BASE, 'samples/minimal/index.html'), wait_until='networkidle')
    assert response and response.status == 200
    page.wait_for_function('document.getElementById("grid").Rows?.Count === 3')
    page.locator('#add').click()
    page.wait_for_function('document.getElementById("grid").Rows.Count === 4')
    results.append({'check': 'Independent minimal sample and observable updates', 'passed': True})
    response = page.goto(urljoin(BASE, 'dist/TreeDataGridWeb.html'), wait_until='load')
    assert response and response.status == 200
    page.wait_for_function('window.demo && demo.grid.Stats.RealizedRows > 0')
    results.append({'check': 'Hosted standalone distribution', 'passed': True})
    report = {'url': BASE, 'browser': browser.version, 'transport': 'Real HTTP(S) navigation and ES-module loading', 'results': results, 'pageErrors': errors}
    (OUT / 'results.json').write_text(json.dumps(report, indent=2) + '\n')
    browser.close()
assert not errors, errors
print(json.dumps(report, indent=2))
