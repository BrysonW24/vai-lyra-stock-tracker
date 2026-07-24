/** Pure policy for the first-run tour, kept separate from the JSX for unit tests. */
export function shouldAutoOpenProductTour(
  seen: boolean,
  onboardingComplete: boolean,
): boolean {
  return !seen && !onboardingComplete;
}
