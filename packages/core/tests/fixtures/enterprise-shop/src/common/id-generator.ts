export function generateUUID(): string {
  return 'uuid-' + Math.random().toString(36).substring(2, 9);
}
