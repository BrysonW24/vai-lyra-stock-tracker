/**
 * Lyra brand gradient: blue -> cyan -> green -> yellow -> orange. Sample it across
 * a group of selectable options so the SELECTED ones form one continuous sweep -
 * the same aesthetic as the market-universe sector grid, applied throughout the
 * onboarding selections. Pass t = optionIndex / (totalOptions - 1).
 */
const GRAD_STOPS: { p: number; c: [number, number, number] }[] = [
  { p: 0, c: [96, 165, 250] }, //    #60a5fa blue
  { p: 0.25, c: [79, 209, 217] }, // #4fd1d9 cyan
  { p: 0.5, c: [67, 209, 139] }, //  #43d18b green
  { p: 0.75, c: [255, 206, 138] }, // #ffce8a yellow
  { p: 1, c: [243, 163, 58] }, //    #f3a33a orange
];

export function gradientRGB(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < GRAD_STOPS.length; i++) {
    const a = GRAD_STOPS[i - 1];
    const b = GRAD_STOPS[i];
    if (x <= b.p) {
      const f = (x - a.p) / (b.p - a.p);
      return [
        Math.round(a.c[0] + (b.c[0] - a.c[0]) * f),
        Math.round(a.c[1] + (b.c[1] - a.c[1]) * f),
        Math.round(a.c[2] + (b.c[2] - a.c[2]) * f),
      ];
    }
  }
  return GRAD_STOPS[GRAD_STOPS.length - 1].c;
}

/** Inline style for a SELECTED option at gradient position t in [0,1]. */
export function gradientSelectedStyle(t: number): { borderColor: string; color: string; backgroundColor: string } {
  const [r, g, b] = gradientRGB(t);
  return {
    borderColor: `rgb(${r}, ${g}, ${b})`,
    color: `rgb(${r}, ${g}, ${b})`,
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.13)`,
  };
}
