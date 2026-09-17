import { Component } from '../types/architecture.js';

/**
 * Converts a glob pattern (e.g. "src/controllers/**", "src/*.ts") into a RegExp
 */
export function globToRegExp(glob: string): RegExp {
  // Normalize slashes
  let pattern = glob.split('\\').join('/');

  let matchSelf = false;
  if (pattern.endsWith('/**')) {
    pattern = pattern.slice(0, -3);
    matchSelf = true;
  }

  // Escape special regex characters except * and ?
  pattern = pattern.replace(/[.+^${}()|[\]]/g, '\\$&');

  // Replace ** with a placeholder
  pattern = pattern.replace(/\*\*/g, '__GLOB_STAR_STAR__');
  // Replace * with single directory or file match
  pattern = pattern.replace(/\*/g, '[^/]*');
  // Replace placeholder with any match across directories
  pattern = pattern.replace(/__GLOB_STAR_STAR__/g, '.*');

  if (matchSelf) {
    return new RegExp(`^${pattern}(/.*)?$`);
  }
  return new RegExp(`^${pattern}$`);
}

/**
 * Checks if a file path matches any of the glob patterns
 */
export function matchesPatterns(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.split('\\').join('/');
  for (const pattern of patterns) {
    const reg = globToRegExp(pattern);
    if (reg.test(normalized)) {
      return true;
    }
    // Also test stripped extension if pattern has no extension
    if (!pattern.includes('.')) {
      const withoutExt = normalized.replace(/\.[^/.]+$/, '');
      if (reg.test(withoutExt)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Finds the component that owns a given file path based on components' paths.
 * Returns null if the file does not belong to any defined component (cross-cutting noise).
 */
export function findComponentForFile(
  filePath: string,
  components: Component[]
): Component | null {
  for (const comp of components) {
    if (matchesPatterns(filePath, comp.paths)) {
      return comp;
    }
  }
  return null;
}

/**
 * Determines whether a file is a cross-cutting utility (noise)
 */
export function isNoiseFile(filePath: string, components: Component[]): boolean {
  return findComponentForFile(filePath, components) === null;
}
