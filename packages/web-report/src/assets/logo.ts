/**
 * SextantDrift Official Vector Brand Logo
 * Geometric high-precision sextant featuring:
 * - Top optical pivot bearing
 * - Graduated limb arc with vernier tick marks
 * - Target optical horizon axis
 * - Articulated index arm measuring red architectural drift angle (Δθ)
 */
export const SEXTANT_LOGO_SVG = `<svg class="brand-logo-icon" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="SextantDrift Logo">
  <defs>
    <linearGradient id="sextant-frame-grad" x1="6" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0EA5E9"/>
      <stop offset="100%" stop-color="#2563EB"/>
    </linearGradient>
    <linearGradient id="sextant-drift-grad" x1="20" y1="8" x2="29" y2="34" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#F43F5E"/>
      <stop offset="100%" stop-color="#E11D48"/>
    </linearGradient>
  </defs>

  <!-- Sextant Limb Arc (Graduated scale) -->
  <path d="M 6 32 C 10 35 30 35 34 32" stroke="url(#sextant-frame-grad)" stroke-width="2.6" stroke-linecap="round"/>
  <!-- Limb graduation ticks -->
  <line x1="11" y1="32.8" x2="10" y2="35.5" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="16" y1="33.7" x2="15.5" y2="36.5" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="20" y1="34" x2="20" y2="37" stroke="#0EA5E9" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="24" y1="33.7" x2="24.5" y2="36.5" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="29" y1="32.8" x2="30" y2="35.5" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>

  <!-- Main Rigid Frame Triangle -->
  <!-- Left frame leg -->
  <path d="M 20 8 L 8 31" stroke="#334155" stroke-width="2" stroke-linecap="round"/>
  <!-- Right frame leg -->
  <path d="M 20 8 L 32 31" stroke="#334155" stroke-width="2" stroke-linecap="round"/>
  <!-- Cross strut bracing -->
  <path d="M 13 22 L 27 22" stroke="#475569" stroke-width="1.4" stroke-dasharray="2 2"/>

  <!-- Optical Telescope / Horizon Crosshair Line -->
  <line x1="7" y1="18" x2="33" y2="18" stroke="#38BDF8" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>
  <circle cx="20" cy="18" r="3.5" stroke="#38BDF8" stroke-width="1.2" fill="#0F172A" fill-opacity="0.4"/>
  <circle cx="20" cy="18" r="1" fill="#38BDF8"/>

  <!-- Articulated Drift Index Arm (Measuring Drift Angle Δθ in Rose Red) -->
  <line x1="20" y1="8" x2="28" y2="32.5" stroke="url(#sextant-drift-grad)" stroke-width="2.6" stroke-linecap="round"/>
  <!-- Index arm vernier cursor at arc -->
  <circle cx="28" cy="32.5" r="2.2" fill="#E11D48" stroke="#FFFFFF" stroke-width="1"/>

  <!-- Drift Angle Arc highlight between center (20,34) and arm (28,32.5) -->
  <path d="M 20 28 A 20 20 0 0 1 24.5 27.5" stroke="#E11D48" stroke-width="1.8" stroke-linecap="round"/>

  <!-- Top Pivot Bearing Hub -->
  <circle cx="20" cy="8" r="4.2" fill="#0F172A" stroke="url(#sextant-frame-grad)" stroke-width="2"/>
  <circle cx="20" cy="8" r="1.6" fill="#38BDF8"/>
</svg>`;
