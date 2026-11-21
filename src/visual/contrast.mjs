const HEX = /^#[a-f0-9]{6}$/i;
const LIGHT_EDGE = '#ffffff';
const DARK_EDGE = '#101419';
const ACCENTS = ['#185ade', '#682bc4', '#af2459', '#a13a08', '#006655',
  '#76c7ff', '#f1acff', '#ffca62', '#79efbd', '#ef718d'];

function relativeLuminance(color) {
  const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255);
  const linear = rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
}

function contrastRatio(a, b) {
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

/** Keep the intended tone if it reads clearly across the sampled stroke area. */
export function chooseAccent(preferred, samples = []) {
  const backgrounds = samples.filter(color => HEX.test(color)).map(relativeLuminance);
  if (!backgrounds.length) return preferred;
  const score = color => {
    const light = relativeLuminance(color);
    return Math.min(...backgrounds.map(value => contrastRatio(light, value)));
  };
  let best = preferred;
  let bestScore = score(best);
  if (bestScore >= 3.2) return best;
  for (const candidate of ACCENTS) {
    const candidateScore = score(candidate);
    if (candidateScore > bestScore) {
      best = candidate;
      bestScore = candidateScore;
    }
  }
  return best;
}

/** The inner edge separates the ink; the opposite outer edge separates the background. */
export function contrastEdges(color) {
  const value = relativeLuminance(color);
  const lightInside = contrastRatio(value, 1) >= contrastRatio(value, relativeLuminance(DARK_EDGE));
  return lightInside ? { inner: LIGHT_EDGE, outer: DARK_EDGE } : { inner: DARK_EDGE, outer: LIGHT_EDGE };
}
