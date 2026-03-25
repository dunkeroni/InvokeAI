import { rgbaColorToString } from 'common/util/colorCodeTransformers';
import { deepClone } from 'common/util/deepClone';
import type { CanvasEntityBufferObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityBufferObjectRenderer';
import type { CanvasEntityObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityObjectRenderer';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { CanvasModuleBase } from 'features/controlLayers/konva/CanvasModuleBase';
import { getSVGPathDataFromPoints } from 'features/controlLayers/konva/util';
import type { CanvasBrushLineWithPressureState } from 'features/controlLayers/store/types';
import Konva from 'konva';
import type { NodeConfig } from 'konva/lib/Node';
import type { Logger } from 'roarr';

type GlobalCompositeOperation = NonNullable<NodeConfig['globalCompositeOperation']>;

export class CanvasObjectBrushLineWithPressure extends CanvasModuleBase {
  readonly type = 'object_brush_line_with_pressure';
  readonly id: string;
  readonly path: string[];
  readonly parent: CanvasEntityObjectRenderer | CanvasEntityBufferObjectRenderer;
  readonly manager: CanvasManager;
  readonly log: Logger;

  state: CanvasBrushLineWithPressureState;
  konva: {
    group: Konva.Group;
    line: Konva.Path;
  };

  constructor(
    state: CanvasBrushLineWithPressureState,
    parent: CanvasEntityObjectRenderer | CanvasEntityBufferObjectRenderer
  ) {
    super();
    const { id, clip, softness, strokeWidth } = state;
    this.id = id;
    this.parent = parent;
    this.manager = parent.manager;
    this.path = this.manager.buildPath(this);
    this.log = this.manager.buildLogger(this);

    this.log.debug({ state }, 'Creating module');

    // Reduce the rendered stroke width by the softness fraction, then choose a blur sigma
    // so that 3 standard deviations extend back to the original (user-selected) width.
    const softnessFraction = (softness ?? 0) / 100;
    const blurRadius = (strokeWidth * softnessFraction) / 6; // sigma
    const blurExtent = blurRadius * 3; // visible reach of the Gaussian
    const expandedClip =
      clip && blurRadius > 0
        ? {
            x: clip.x - blurExtent,
            y: clip.y - blurExtent,
            width: clip.width + 2 * blurExtent,
            height: clip.height + 2 * blurExtent,
          }
        : clip;

    this.konva = {
      group: new Konva.Group({
        name: `${this.type}:group`,
        clip: expandedClip,
        listening: false,
      }),
      line: new Konva.Path({
        name: `${this.type}:path`,
        listening: false,
        shadowForStrokeEnabled: false,
        globalCompositeOperation: (state.globalCompositeOperation ?? 'source-over') as GlobalCompositeOperation,
        perfectDrawEnabled: false,
      }),
    };
    this.konva.group.add(this.konva.line);
    this.state = state;
  }

  update(state: CanvasBrushLineWithPressureState, force = false): boolean {
    if (force || this.state !== state) {
      this.log.trace({ state }, 'Updating brush line with pressure');
      const { points, color, strokeWidth, softness, clip, globalCompositeOperation } = state;

      // Reduce the rendered stroke width by the softness fraction, then choose a blur sigma
      // so that 3 standard deviations extend back to the original (user-selected) width.
      const softnessFraction = (softness ?? 0) / 100;
      const reducedStrokeWidth = strokeWidth * (1 - softnessFraction);
      const blurRadius = (strokeWidth * softnessFraction) / 6; // sigma
      const blurExtent = blurRadius * 3; // visible reach of the Gaussian
      this.konva.line.setAttrs({
        globalCompositeOperation: (globalCompositeOperation ?? 'source-over') as GlobalCompositeOperation,
        data: getSVGPathDataFromPoints(points, {
          size: reducedStrokeWidth / 2,
          simulatePressure: false,
          last: true,
          thinning: 1,
        }),
        fill: rgbaColorToString(color),
      });

      // Expand clip to accommodate blur extent
      if (clip) {
        const expandedClip =
          blurRadius > 0
            ? {
                x: clip.x - blurExtent,
                y: clip.y - blurExtent,
                width: clip.width + 2 * blurExtent,
                height: clip.height + 2 * blurExtent,
              }
            : clip;
        this.konva.group.clip(expandedClip);
      }

      // Store blurRadius as a node attr so it can be read from cloned nodes during rasterization
      // to calculate group cache offset.
      this.konva.line.blurRadius(blurRadius);

      // Apply softness via GPU-accelerated canvas 2D context filter instead of Konva's
      // cache() + Filters.Blur, which is CPU-based at O(W*H*R) per update and causes severe
      // slowdown as the stroke grows during drawing.
      if (blurRadius > 0) {
        const br = blurRadius;
        this.konva.line.sceneFunc((ctx, shape) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nativeCtx = (ctx as any)._context as CanvasRenderingContext2D;
          const prevFilter = nativeCtx.filter;
          // CSS filter blur operates in device pixels, not the transformed coordinate space.
          // Read the current scale from the context transform to compensate for zoom level.
          const { a, b } = nativeCtx.getTransform();
          const scale = Math.sqrt(a * a + b * b);
          nativeCtx.filter = `blur(${br * scale}px)`;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (Konva.Path.prototype as any)._sceneFunc.call(shape, ctx);
          nativeCtx.filter = prevFilter;
        });
      } else {
        // Remove custom sceneFunc to fall back to Konva's default
        this.konva.line.setAttr('sceneFunc', undefined);
      }

      this.state = state;
      return true;
    }

    return false;
  }

  setVisibility(isVisible: boolean): void {
    this.log.trace({ isVisible }, 'Setting brush line visibility');
    this.konva.group.visible(isVisible);
  }

  destroy = () => {
    this.log.debug('Destroying module');
    this.konva.group.destroy();
  };

  repr = () => {
    return {
      id: this.id,
      type: this.type,
      path: this.path,
      parent: this.parent.id,
      state: deepClone(this.state),
    };
  };
}
