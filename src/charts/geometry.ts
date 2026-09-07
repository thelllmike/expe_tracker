/**
 * Path for a rectangle with only its top corners rounded — the shape every bar
 * in the design uses ("border-radius: 6px 6px 0 0").
 */
export function roundedTopRect(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0 || w <= 0) return '';
  // Never round more than half the width, or the two corners overlap.
  const radius = Math.max(0, Math.min(r, w / 2, h));
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + radius}`,
    `A ${radius} ${radius} 0 0 1 ${x + radius} ${y}`,
    `L ${x + w - radius} ${y}`,
    `A ${radius} ${radius} 0 0 1 ${x + w} ${y + radius}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ');
}

/**
 * Scale a set of values to pixel heights against the largest of them.
 * Bars in the design are always relative to the tallest bar, not to a zero-based
 * axis, so a flat month still reads as a short bar rather than nothing.
 */
export function scaleToMax(values: number[], maxHeight: number, minHeight = 2): number[] {
  const peak = Math.max(...values.map((v) => Math.abs(v)), 0);
  if (peak === 0) return values.map(() => minHeight);
  return values.map((v) => Math.max(minHeight, (Math.abs(v) / peak) * maxHeight));
}
