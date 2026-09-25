/**
 * Dark-theme remapping for the C4 SVG canvas.
 *
 * The C4 renderer is fully deterministic and emits SVG with literal hex colours
 * (`fill="#F8FAFC"`, `stroke="#CBD5E1"`, …). Rewriting every literal into a CSS
 * custom property would be invasive across ~900 lines of renderer code, so this
 * module instead performs a *closed-set* token substitution:
 *
 *   light theme (default)  ->  the renderer output is passed through untouched
 *                              and the literal colours render exactly as before.
 *   dark theme             ->  each allow-listed literal is replaced by a
 *                              `var(--c4-token, <original>)` reference, and the
 *                              dark stylesheet supplies the matching token.
 *
 * Properties of this design:
 *  - **Deterministic**: the mapping is an explicit table; no heuristics, no
 *    colour maths, no guessing. Unmapped colours simply keep their literal value.
 *  - **Safe**: a missing/undefined token falls back to the original literal, so a
 *    partial mapping can never produce an invisible or invalid canvas.
 *  - **Semantic-preserving**: only neutral chrome (surfaces, borders, text) is
 *    remapped. The red/green drift semantics are deliberately left intact, with
 *    red accents only nudged to a higher-contrast tint for dark backgrounds.
 */

/** Neutral chrome + text tokens: `hexLiteralInSvg` -> `cssCustomPropertyName`. */
export const C4_DARK_TOKEN_MAP: Record<string, string> = {
  '#FFFFFF': '--c4-surface',
  '#F8FAFC': '--c4-surface-alt',
  '#F1F5F9': '--c4-chip',
  '#EEF2FF': '--c4-chip-accent',
  '#E2E8F0': '--c4-border-soft',
  '#CBD5E1': '--c4-border',
  '#94A3B8': '--c4-border-strong',
  '#64748B': '--c4-text-muted',
  '#475569': '--c4-text-soft',
  '#334155': '--c4-text-body',
  '#1E293B': '--c4-text-strong',
  '#0F172A': '--c4-text',
  '#C7D2FE': '--c4-chip-accent-border',
  '#4338CA': '--c4-chip-accent-text',
  '#FEF2F2': '--c4-danger-soft',
  '#FEF3C7': '--c4-warn-soft',
  '#ECFDF5': '--c4-ok-soft',
  '#A7F3D0': '--c4-ok-border',
  '#065F46': '--c4-ok-text',
  '#FCA5A5': '--c4-danger-border',
  '#991B1B': '--c4-danger-text',
};

/**
 * CSS custom property values for the dark canvas. Values are chosen so that
 * neutral surfaces become deep slate while the drift semantics stay legible.
 */
export const C4_DARK_TOKEN_VALUES: Record<string, string> = {
  '--c4-surface': '#16223A',
  '--c4-surface-alt': '#111A2B',
  '--c4-chip': '#1E2A42',
  '--c4-chip-accent': '#1B2440',
  '--c4-border-soft': '#22304A',
  '--c4-border': '#2A3A55',
  '--c4-border-strong': '#3A4E70',
  '--c4-text-muted': '#8B9BB8',
  '--c4-text-soft': '#9DAEC9',
  '--c4-text-body': '#C0CCDF',
  '--c4-text-strong': '#DCE5F2',
  '--c4-text': '#E8EEF8',
  '--c4-chip-accent-border': '#3E4C7E',
  '--c4-chip-accent-text': '#C7D2FE',
  '--c4-danger-soft': '#2A1319',
  '--c4-warn-soft': '#2A1F0D',
  '--c4-ok-soft': '#0D2318',
  '--c4-ok-border': '#1E4A3C',
  '--c4-ok-text': '#6EE7B7',
  '--c4-danger-border': '#7F2C3A',
  '--c4-danger-text': '#FCA5A5',
};

const HEX_PATTERN = /#[0-9A-Fa-f]{6}\b/g;

/**
 * Replaces allow-listed hex literals with `var(--c4-*, original)` references.
 * Hex matching is case-insensitive while the lookup is upper-cased, so both
 * `#ffffff` and `#FFFFFF` (and any mixed case) resolve to the same token.
 */
export function applyDarkTokensToSvg(svg: string): string {
  if (!svg || svg.indexOf('#') === -1) return svg;
  return svg.replace(HEX_PATTERN, (match) => {
    const token = C4_DARK_TOKEN_MAP[match.toUpperCase()];
    return token ? `var(${token}, ${match})` : match;
  });
}

/** Emits the stylesheet block that gives the dark tokens their values. */
export function getC4DarkTokenCss(): string {
  const declarations = Object.entries(C4_DARK_TOKEN_VALUES)
    .map(([token, value]) => `        ${token}: ${value};`)
    .join('\n');
  return `      .c4-canvas {
${declarations}
      }`;
}
