import { clamp, GridLength } from './primitives.js';
/** Fenwick prefix-sum index: O(log n) height updates, row offsets, and pixel-to-row lookup. */
export class RowHeightIndex {
    constructor(count = 0, estimate = 32) { this.Reset(count, estimate); }
    Reset(count, estimate = 32) { if (!Number.isSafeInteger(count) || count < 0 || !Number.isFinite(estimate) || estimate <= 0)
        throw new RangeError('Invalid row geometry.'); this.Count = count; this.Estimate = estimate; this.Values = new Float64Array(count); this.Values.fill(estimate); this.Tree = new Float64Array(count + 1); for (let i = 1; i <= count; i++)
        this.Tree[i] = (i & -i) * estimate; }
    Get(index) { if (index < 0 || index >= this.Count)
        throw new RangeError('Invalid row.'); return this.Values[index]; }
    Set(index, height) { if (index < 0 || index >= this.Count || !Number.isFinite(height) || height <= 0)
        throw new RangeError('Invalid row height.'); const d = height - this.Values[index]; if (Math.abs(d) < 0.01)
        return 0; this.Values[index] = height; for (let i = index + 1; i <= this.Count; i += i & -i)
        this.Tree[i] += d; return d; }
    Offset(index) { let sum = 0; for (let i = clamp(index, 0, this.Count); i > 0; i -= i & -i)
        sum += this.Tree[i]; return sum; }
    get Total() { return this.Offset(this.Count); }
    IndexAt(offset) { if (!this.Count)
        return -1; if (offset <= 0)
        return 0; let index = 0, sum = 0; let bit = 2 ** Math.floor(Math.log2(this.Count)); for (; bit >= 1; bit = Math.floor(bit / 2)) {
        const next = index + bit;
        if (next <= this.Count && sum + this.Tree[next] <= offset) {
            sum += this.Tree[next];
            index = next;
        }
    } return Math.min(index, this.Count - 1); }
    Range(offset, viewport, overscan = 120) { if (!this.Count)
        return { start: 0, end: 0 }; return { start: this.IndexAt(Math.max(0, offset - overscan)), end: Math.min(this.Count, this.IndexAt(offset + viewport + overscan) + 1) }; }
}
export class ColumnGeometry {
    constructor() { this.Items = []; this.Offsets = [0]; this.Total = 0; }
    Reset(widths) { this.Items = Array.from(widths); this.Offsets = new Float64Array(this.Items.length + 1); for (let i = 0; i < this.Items.length; i++)
        this.Offsets[i + 1] = this.Offsets[i] + this.Items[i]; this.Total = this.Offsets[this.Items.length]; }
    IndexAt(offset) { let a = 0, b = this.Items.length; while (a < b) {
        const m = (a + b) >>> 1;
        if (this.Offsets[m + 1] <= offset)
            a = m + 1;
        else
            b = m;
    } return Math.min(a, this.Items.length - 1); }
    Range(offset, width, overscan = 80) { if (!this.Items.length)
        return { start: 0, end: 0 }; return { start: Math.max(0, this.IndexAt(Math.max(0, offset - overscan))), end: Math.min(this.Items.length, this.IndexAt(offset + width + overscan) + 1) }; }
}
/** Independent per-view column widths. Star constraints are solved by water filling. */
export class ColumnLayout {
    constructor() { this.Measured = new Map(); this.Columns = []; this.Widths = []; this.Geometry = new ColumnGeometry(); }
    Measure(column, width) { const old = this.Measured.get(column) ?? 0; if (width > old + 0.5) {
        this.Measured.set(column, width);
        return true;
    } return false; }
    ResetMeasurements() { this.Measured.clear(); }
    Calculate(columns, available) {
        this.Columns = Array.from(columns).filter(c => c.IsVisible);
        const widths = [], stars = [];
        const bound = (c, key, fallback) => { const v = c.Options?.[key]; if (v == null)
            return fallback; const g = GridLength.Parse(v); return g.IsAuto ? (this.Measured.get(c) ?? fallback) : g.IsAbsolute ? g.Value : fallback; };
        const min = this.Columns.map(c => bound(c, 'MinWidth', 30)), max = this.Columns.map(c => Math.max(bound(c, 'MinWidth', 30), bound(c, 'MaxWidth', Infinity)));
        let fixed = 0;
        this.Columns.forEach((c, i) => { const w = GridLength.Parse(c.Width); if (w.IsStar) {
            stars.push({ i, weight: w.Value });
            widths[i] = 0;
        }
        else {
            widths[i] = clamp(w.IsAbsolute ? w.Value : (this.Measured.get(c) ?? Math.max(80, String(c.Header ?? '').length * 8 + 34)), min[i], max[i]);
            fixed += widths[i];
        } });
        let remaining = Math.max(0, available - fixed), active = stars.slice();
        while (active.length) {
            const weight = active.reduce((s, x) => s + x.weight, 0);
            let constrained = false;
            const next = [];
            for (const x of active) {
                const share = weight ? remaining * x.weight / weight : 0;
                const w = clamp(share, min[x.i], max[x.i]);
                if (w !== share) {
                    widths[x.i] = w;
                    remaining -= w;
                    constrained = true;
                }
                else
                    next.push(x);
            }
            if (!constrained) {
                for (const x of active)
                    widths[x.i] = weight ? remaining * x.weight / weight : min[x.i];
                break;
            }
            active = next;
        }
        this.Widths = widths;
        this.Geometry.Reset(widths);
        return widths;
    }
}
