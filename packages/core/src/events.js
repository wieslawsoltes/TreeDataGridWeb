/** Synchronous, deterministic .NET-style events. Subscribe returns a callable IDisposable. */
export class Signal {
    constructor() { this._listeners = new Set(); }
    Subscribe(handler) {
        if (typeof handler !== 'function')
            throw new TypeError('Event handler must be a function.');
        this._listeners.add(handler);
        const off = () => this._listeners.delete(handler);
        off.Dispose = off;
        return off;
    }
    Add(handler) { return this.Subscribe(handler); }
    Remove(handler) { this._listeners.delete(handler); }
    Emit(sender, args = {}) { for (const h of [...this._listeners])
        if (this._listeners.has(h))
            h(sender, args); }
    Clear() { this._listeners.clear(); }
    get Count() { return this._listeners.size; }
}
export class NotifyingBase {
    constructor() { this.PropertyChanged = new Signal(); }
    RaisePropertyChanged(PropertyName, OldValue, NewValue) { this.PropertyChanged.Emit(this, { PropertyName, OldValue, NewValue }); }
    RaiseAndSetIfChanged(field, value, propertyName = field.replace(/^_/, '')) {
        if (Object.is(this[field], value))
            return false;
        const old = this[field];
        this[field] = value;
        this.RaisePropertyChanged(propertyName, old, value);
        return true;
    }
}
const proxies = new WeakMap(), raw = new WeakMap(), signals = new WeakMap();
let collector = null;
function isPlain(value) { return value && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
/** Proxy-based property notifications. Preserve model identity by using the returned proxy everywhere. */
export function observable(model) {
    if (!isPlain(model) || raw.has(model))
        return model;
    if (proxies.has(model))
        return proxies.get(model);
    const signal = new Signal();
    signals.set(model, signal);
    const proxy = new Proxy(model, {
        get(target, prop, receiver) {
            if (prop === 'PropertyChanged')
                return signal;
            if (prop === '$raw')
                return target;
            if (collector && typeof prop === 'string') {
                let keys = collector.get(target);
                if (!keys)
                    collector.set(target, keys = new Set());
                keys.add(prop);
            }
            const value = Reflect.get(target, prop, receiver);
            return isPlain(value) ? observable(value) : value;
        },
        set(target, prop, value) {
            const old = target[prop], next = raw.get(value) ?? value;
            if (Object.is(old, next))
                return true;
            if (!Reflect.set(target, prop, next))
                return false;
            signal.Emit(proxy, { PropertyName: String(prop), OldValue: old, NewValue: value });
            return true;
        },
        deleteProperty(target, prop) {
            if (!(prop in target))
                return true;
            const old = target[prop];
            const ok = Reflect.deleteProperty(target, prop);
            if (ok)
                signal.Emit(proxy, { PropertyName: String(prop), OldValue: old });
            return ok;
        }
    });
    proxies.set(model, proxy);
    raw.set(proxy, model);
    return proxy;
}
/** Tracks arbitrary accessor dependencies, including replacement of intermediate objects. */
export function observeSelector(model, getter, changed, { immediate = false } = {}) {
    let off = [], stopped = false, value, busy = false;
    const evaluate = (notify) => {
        if (stopped || busy)
            return;
        busy = true;
        try {
            off.forEach(f => f());
            off = [];
            const previous = collector, deps = new Map();
            collector = deps;
            let next;
            try {
                next = getter(model);
            }
            finally {
                collector = previous;
            }
            const old = value;
            value = next;
            for (const [obj, keys] of deps)
                off.push(signals.get(obj).Subscribe((_, e) => {
                    if (!e.PropertyName || keys.has(e.PropertyName))
                        evaluate(true);
                }));
            if (!deps.size && model?.PropertyChanged?.Subscribe)
                off.push(model.PropertyChanged.Subscribe(() => evaluate(true)));
            if (notify)
                changed(next, old);
        }
        finally {
            busy = false;
        }
    };
    evaluate(immediate);
    const dispose = () => { stopped = true; off.forEach(f => f()); off = []; };
    dispose.Dispose = dispose;
    return dispose;
}
export function pathAccessor(path) {
    const keys = Array.isArray(path) ? path : String(path).split('.').filter(Boolean);
    const get = model => keys.reduce((x, k) => x?.[k], model);
    get.Set = (model, value) => {
        let target = model;
        for (const k of keys.slice(0, -1)) {
            target = target?.[k];
            if (target == null)
                throw new Error(`Cannot write '${keys.join('.')}'.`);
        }
        if (!keys.length)
            throw new Error('An empty path is read-only.');
        target[keys.at(-1)] = value;
    };
    return get;
}
export function disposeAll(items) { for (const x of items.splice(0))
    typeof x === 'function' ? x() : x?.Dispose?.(); }
