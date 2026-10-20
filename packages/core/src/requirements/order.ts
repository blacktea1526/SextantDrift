export function compareUtf8(a: string, b: string): number {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i++) {
    if (left[i] !== right[i]) return left[i]! - right[i]!;
  }
  return left.length - right.length;
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort(compareUtf8);
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
