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
