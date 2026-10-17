// Version 1: ordinal UTF-16 keys, array order, standard finite JSON values.
// This is identity comparison, not authentication or source-byte rewriting.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (
      Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertySymbols(value).length ||
      Object.getOwnPropertyNames(value).some(
        (key) =>
          key !== 'length' && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length),
      )
    )
      throw new Error('Unsupported JSON array');
    const items: string[] = [];
    for (let i = 0; i < value.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor))
        throw new Error('Sparse or executable JSON array');
      items.push(canonicalJson(descriptor.value));
    }
    return `[${items.join(',')}]`;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  ) {
    if (Object.getOwnPropertySymbols(value).length) throw new Error('Symbol JSON key');
    return `{${Object.getOwnPropertyNames(value)
      .sort()
      .map((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!descriptor.enumerable || !('value' in descriptor))
          throw new Error('Unsupported or executable JSON property');
        return `${JSON.stringify(key)}:${canonicalJson(descriptor.value)}`;
      })
      .join(',')}}`;
  }
  throw new Error('Unsupported JSON value');
}

// Deeply frozen authorities cannot change after registration, so their canonical
// bytes are computed once. Mutable values are always serialized again.
const immutable = new WeakSet<object>();
const canonicalCache = new WeakMap<object, string>();

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !immutable.has(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
    immutable.add(value);
  }
  return value;
}

// Freeze a value whose canonical bytes were just computed from it, with no
// mutation in between, so later canonicalJsonOf calls reuse those bytes.
export function deepFreezeWithCanonical<T extends object>(value: T, bytes: string): T {
  deepFreeze(value);
  canonicalCache.set(value, bytes);
  return value;
}

export function isDeepFrozen(value: unknown): boolean {
  return typeof value === 'object' && value !== null && immutable.has(value);
}

export function canonicalJsonOf(value: unknown): string {
  if (typeof value !== 'object' || value === null || !immutable.has(value))
    return canonicalJson(value);
  let cached = canonicalCache.get(value);
  if (cached === undefined) {
    cached = canonicalJson(value);
    canonicalCache.set(value, cached);
  }
  return cached;
}

// Equivalent to JSON.parse(canonicalJson(value)) — same validation, sorted keys,
// -0 normalized to 0 — without escaping and re-parsing large embedded strings.
export function cloneCanonical<T>(value: T): T {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value))
    return (Object.is(value, -0) ? 0 : value) as T;
  if (Array.isArray(value)) {
    if (
      Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertySymbols(value).length ||
      Object.getOwnPropertyNames(value).some(
        (key) =>
          key !== 'length' && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length),
      )
    )
      throw new Error('Unsupported JSON array');
    const items: unknown[] = new Array(value.length);
    for (let i = 0; i < value.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor))
        throw new Error('Sparse or executable JSON array');
      items[i] = cloneCanonical(descriptor.value);
    }
    return items as T;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  ) {
    if (Object.getOwnPropertySymbols(value).length) throw new Error('Symbol JSON key');
    const result: Record<string, unknown> = {};
    for (const key of Object.getOwnPropertyNames(value).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!descriptor.enumerable || !('value' in descriptor))
        throw new Error('Unsupported or executable JSON property');
      // JSON.parse would define __proto__ as an own property; preserve that.
      Object.defineProperty(result, key, {
        value: cloneCanonical(descriptor.value),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return result as T;
  }
  throw new Error('Unsupported JSON value');
}
