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
      const { points, color, strokeWidth: baseStrokeWidth } = state;
      const brushSoftness = this.manager.store.getState().canvasSettings.brushSoftness;

      const softnessRatio = brushSoftness / 100;
      const actualVisibleStrokeWidth = Math.max(3, baseStrokeWidth * (1 - softnessRatio));
      const shadowBlurAmount = (baseStrokeWidth - actualVisibleStrokeWidth) / 2;

      this.konva.line.setAttrs({
        data: getSVGPathDataFromPoints(points, {
          size: actualVisibleStrokeWidth / 2, // Use the new width for the path data
          simulatePressure: false, // This is for the tldraw algorithm, pressure is in points
          last: true,
          thinning: 1, // Default thinning
        }),
        fill: rgbaColorToString(color),
        shadowColor: rgbaColorToString(color),
        shadowBlur: shadowBlurAmount,
        shadowOpacity: 1,
        shadowEnabled: shadowBlurAmount > 0,
        // Ensure stroke is not drawn, as we are using fill + shadow for the effect
        strokeEnabled: false,
      });
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
