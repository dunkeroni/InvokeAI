import { rgbaColorToString } from 'common/util/colorCodeTransformers';
import { deepClone } from 'common/util/deepClone';
import { BRUSH_HARDNESS_BLUR_SIGMA_ATTR, getBrushHardnessMetrics } from 'features/controlLayers/konva/brushHardness';
import type { CanvasEntityBufferObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityBufferObjectRenderer';
import type { CanvasEntityObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityObjectRenderer';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { CanvasModuleBase } from 'features/controlLayers/konva/CanvasModuleBase';
import type { CanvasBrushLineState } from 'features/controlLayers/store/types';
import Konva from 'konva';
import type { NodeConfig } from 'konva/lib/Node';
import type { Logger } from 'roarr';

type GlobalCompositeOperation = NonNullable<NodeConfig['globalCompositeOperation']>;

export class CanvasObjectBrushLine extends CanvasModuleBase {
  readonly type = 'object_brush_line';
  readonly id: string;
  readonly path: string[];
  readonly parent: CanvasEntityObjectRenderer | CanvasEntityBufferObjectRenderer;
  readonly manager: CanvasManager;
  readonly log: Logger;

  state: CanvasBrushLineState;
  konva: {
    group: Konva.Group;
    line: Konva.Line;
  };

  constructor(state: CanvasBrushLineState, parent: CanvasEntityObjectRenderer | CanvasEntityBufferObjectRenderer) {
    super();
    const { id, clip } = state;
    this.id = id;
    this.parent = parent;
    this.manager = parent.manager;
    this.path = this.manager.buildPath(this);
    this.log = this.manager.buildLogger(this);

    this.log.debug({ state }, 'Creating module');

    this.konva = {
      group: new Konva.Group({
        name: `${this.type}:group`,
        clip,
        listening: false,
      }),
      line: new Konva.Line({
        name: `${this.type}:line`,
        listening: false,
        shadowForStrokeEnabled: false,
        tension: 0.3,
        lineCap: 'round',
        lineJoin: 'round',
        globalCompositeOperation: (state.globalCompositeOperation ?? 'source-over') as GlobalCompositeOperation,
        perfectDrawEnabled: false,
      }),
    };
    this.konva.group.add(this.konva.line);
    this.state = state;
  }

  update(state: CanvasBrushLineState, force = false): boolean {
    if (force || this.state !== state) {
      this.log.trace({ state }, 'Updating brush line');
      const { points, color, strokeWidth, hardness, clip, globalCompositeOperation } = state;
      const { renderStrokeWidth, blurSigmaPx } = getBrushHardnessMetrics(strokeWidth, hardness);

      this.konva.line.setAttrs({
        // A line with only one point will not be rendered, so we duplicate the points to make it visible
        points: points.length === 2 ? [...points, ...points] : points,
        stroke: rgbaColorToString(color),
        strokeWidth: renderStrokeWidth,
        globalCompositeOperation: (globalCompositeOperation ?? 'source-over') as GlobalCompositeOperation,
      });

      this.konva.group.clip(clip ?? undefined);

      // Store the derived blur sigma on the node so cloned groups can calculate cache padding.
      // to calculate group cache offset.
      this.konva.line.setAttr(BRUSH_HARDNESS_BLUR_SIGMA_ATTR, blurSigmaPx);

      // Apply edge softness via GPU-accelerated canvas 2D context filter instead of Konva's
      // cache() + Filters.Blur, which is CPU-based at O(W*H*R) per update and causes severe
      // slowdown as the stroke grows during drawing.
      if (blurSigmaPx > 0) {
        const blurSigma = blurSigmaPx;
        this.konva.line.sceneFunc((ctx, shape) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nativeCtx = (ctx as any)._context as CanvasRenderingContext2D;
          const prevFilter = nativeCtx.filter;
          // CSS filter blur operates in device pixels, not the transformed coordinate space.
          // Read the current scale from the context transform to compensate for zoom level.
          const { a, b } = nativeCtx.getTransform();
          const scale = Math.sqrt(a * a + b * b);
          nativeCtx.filter = `blur(${blurSigma * scale}px)`;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (Konva.Line.prototype as any)._sceneFunc.call(shape, ctx);
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
