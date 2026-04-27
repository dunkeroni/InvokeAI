type BrushHardnessMetrics = {
  hardness: number;
  hardnessRatio: number;
  softnessRatio: number;
  renderStrokeWidth: number;
  blurSigmaPx: number;
  blurExtentPx: number;
  cacheOffsetPx: number;
  previewOpacity: number;
};

export const BRUSH_HARDNESS_BLUR_SIGMA_ATTR = 'brushHardnessBlurSigmaPx';

const clampHardness = (hardness: number): number => {
  return Math.min(100, Math.max(0, hardness));
};

export const invertLegacySoftness = (softness: number): number => {
  return 100 - clampHardness(softness);
};

export const getBrushHardnessMetrics = (strokeWidth: number, hardness: number): BrushHardnessMetrics => {
  const clampedHardness = clampHardness(hardness);
  const hardnessRatio = (clampedHardness / 100) ** 2; // Use a non-linear curve to give more control over lower hardness values
  const softnessRatio = 1 - hardnessRatio;
  const blurSigmaPx = (strokeWidth * softnessRatio) / 6;
  const blurExtentPx = blurSigmaPx * 3;

  return {
    hardness: clampedHardness,
    hardnessRatio,
    softnessRatio,
    renderStrokeWidth: strokeWidth * hardnessRatio,
    blurSigmaPx,
    blurExtentPx,
    cacheOffsetPx: blurSigmaPx > 0 ? Math.ceil(blurExtentPx) : 0,
    previewOpacity: 1 - softnessRatio * 0.6,
  };
};

// export type { BrushHardnessMetrics };
