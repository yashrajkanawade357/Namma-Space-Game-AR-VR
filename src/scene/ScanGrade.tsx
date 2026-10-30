import { BrightnessContrast, EffectComposer, HueSaturation, SMAA, Vignette } from "@react-three/postprocessing";

/**
 * Light colour grade for phone scans: their textures come out slightly flat and washed
 * out, so add a touch of contrast and saturation, smooth jagged edges, and darken the
 * screen corners to draw the eye to the middle of the room.
 */
export function ScanGrade() {
  return (
    <EffectComposer multisampling={0}>
      <SMAA />
      <BrightnessContrast brightness={0.01} contrast={0.09} />
      <HueSaturation saturation={0.12} />
      <Vignette offset={0.32} darkness={0.42} />
    </EffectComposer>
  );
}
