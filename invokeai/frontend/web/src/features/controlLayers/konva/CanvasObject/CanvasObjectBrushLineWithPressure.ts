import { rgbaColorToString } from 'common/util/colorCodeTransformers';
import { deepClone } from 'common/util/deepClone';
import type { CanvasEntityBufferObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityBufferObjectRenderer';
import type { CanvasEntityObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityObjectRenderer';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { CanvasModuleBase } from 'features/controlLayers/konva/CanvasModuleBase';
import { getSVGPathDataFromPoints } from 'features/controlLayers/konva/util';
import type { CanvasBrushLineWithPressureState } from 'features/controlLayers/store/types';
import Konva from 'konva';
import type { Logger } from 'roarr';

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

    const blurRadius = ((softness ?? 0) * strokeWidth) / 100;
    const expandedClip =
      clip && blurRadius > 0
        ? {
            x: clip.x - blurRadius,
            y: clip.y - blurRadius,
            width: clip.width + 2 * blurRadius,
            height: clip.height + 2 * blurRadius,
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
        globalCompositeOperation: 'source-over',
        perfectDrawEnabled: false,
      }),
    };
    this.konva.group.add(this.konva.line);
    this.state = state;
  }

  update(state: CanvasBrushLineWithPressureState, force = false): boolean {
    if (force || this.state !== state) {
      this.log.trace({ state }, 'Updating brush line with pressure');
      const { points, color, strokeWidth, softness, clip } = state;
      this.konva.line.setAttrs({
        data: getSVGPathDataFromPoints(points, {
          size: strokeWidth / 2,
          simulatePressure: false,
          last: true,
          thinning: 1,
        }),
        fill: rgbaColorToString(color),
      });

      const blurRadius = ((softness ?? 0) * strokeWidth) / 100;

      // Expand clip to accommodate blur extent
      if (clip) {
        const expandedClip =
          blurRadius > 0
            ? {
                x: clip.x - blurRadius,
                y: clip.y - blurRadius,
                width: clip.width + 2 * blurRadius,
                height: clip.height + 2 * blurRadius,
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
          nativeCtx.filter = `blur(${br}px)`;
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
