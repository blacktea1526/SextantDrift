export type SourceLanguage = 'typescript' | 'python' | 'go';

/**
 * Picks the static import extractor for a scanned source path.
 * Extension only — content is never sniffed, so a .go file is never parsed as TypeScript.
 */
export function detectSourceLanguage(filePath: string): SourceLanguage {
  const normalized = filePath.split('\\').join('/');
  const dot = normalized.lastIndexOf('.');
  const ext = dot === -1 ? '' : normalized.slice(dot).toLowerCase();
  if (ext === '.py') return 'python';
  if (ext === '.go') return 'go';
  return 'typescript';
}
