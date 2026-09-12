# Changelog

## 0.1.0

- First public npm publication as `@wieslawsoltes/treedatagridweb`, containing both Core and browser packages.
- Typed subpath exports, CSS and standalone assets, installed consumer checks and verified immutable release/npm publication with provenance.

Initial delivered web implementation: DOM-independent Core, native custom-element presentation/control, the eight Core sample scenarios plus two diagnostics, TypeScript declarations, offline distributions, curated core/browser tests and recorded measurements. The port targets upstream revision `3ca47316d724e5e040ab0281a880e8df999b25fc`.

Notable validation fixes include variable-height end-of-list anchoring, shared-view sizing, stale template callback prevention on recycling, removal of a forced post-write layout read, numeric formatter caching, model-only reads without row allocation, efficient Reset index remapping, loaded-child selection lookup, and correct deselected-item payloads during collection removal.

See `docs/API-PARITY.md` for remaining native/API and validation boundaries.
