# GitHub Pages deployment

- Showcase: <https://wieslawsoltes.github.io/TreeDataGridWeb/>
- Minimal integration: <https://wieslawsoltes.github.io/TreeDataGridWeb/samples/minimal/>
- Standalone HTML: <https://wieslawsoltes.github.io/TreeDataGridWeb/dist/TreeDataGridWeb.html>
- Build and publish workflow: <https://github.com/wieslawsoltes/TreeDataGridWeb/actions/workflows/pages.yml>

The `main` branch contains the complete source, distributions, local npm packages,
tests, documentation, and verification evidence. Each push runs the Core tests,
TypeScript checks, local HTTP smoke checks, and Chromium interaction suite before
publishing. Pull requests run verification without deployment permissions.

Pages can use the `gh-pages` branch at `/` (root), or GitHub Actions as the source.
The workflow reads the configuration and uses the corresponding publication path.
Branch publishing fast-forwards `gh-pages` to the verified source revision and
explicitly requests a Pages build; it never force-pushes. Custom Actions publishing
uses the verified static-site artifact with the official Pages actions.

After publication, `tests/hosted.py` opens the actual HTTPS showcase, all ten
sample views, editing/undo, the independent minimal integration, and standalone
HTML. The `hosted-demo-verification` workflow artifact contains the browser report
and screenshot. This supplements, not replaces, the original offline test report
in `VERIFICATION.md`. Clipboard/file-picker permissions, live feeds, other browser
engines, physical input hardware, and assistive technologies are not exercised by
this smoke test.

The initial source import retained the original source files and rebuilt the
standalone/global bundles, local npm tarballs and screenshots in GitHub Actions.
The source archive and compressed transfer checksums are recorded in
`verification/import-provenance.json`. `SHA256SUMS` records that import's source
and generated artifact snapshot; later deployment-workflow additions are tracked
by Git, not by rewriting the import manifest. The temporary import payload and
workflow have been removed from the current source branch.

No npm registry publication is performed. `releases/*.tgz` are installable local
packages, not GitHub release attachments or registry releases.
