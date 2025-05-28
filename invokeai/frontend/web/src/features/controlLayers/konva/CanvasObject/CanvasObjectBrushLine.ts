import { rgbaColorToString } from 'common/util/colorCodeTransformers';
import { deepClone } from 'common/util/deepClone';
import type { CanvasEntityBufferObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityBufferObjectRenderer';
import type { CanvasEntityObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityObjectRenderer';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { CanvasModuleBase } from 'features/controlLayers/konva/CanvasModuleBase';
import type { CanvasBrushLineState } from 'features/controlLayers/store/types';
import Konva from 'konva';
import type { Logger } from 'roarr';

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
        globalCompositeOperation: 'source-over',
        perfectDrawEnabled: false,
      }),
    };
    this.konva.group.add(this.konva.line);
    this.state = state;
    this.finalize(); // Call finalize after initial setup
  }

  finalize = () => { // Added finalize method
    this.log.debug('Finalizing brush line');
    const konvaNode = this.konva.line;
    const { strokeWidth, color } = this.state;

    // Apply softness
    const canvasSettings = this.manager.stateApi.getStore().getState().canvasSettings;
    const softness = canvasSettings.softness ?? 0;
    const softnessRatio = softness / 100;

    let newStrokeWidth = strokeWidth * (1 - softnessRatio);
    let newShadowBlur = (strokeWidth * softnessRatio) / 2;

    if (newStrokeWidth < 3) {
      newStrokeWidth = 3;
      newShadowBlur = Math.max(0, (strokeWidth - 3) / 2);
    }

    konvaNode.setAttrs({
      strokeWidth: newStrokeWidth,
      shadowBlur: newShadowBlur,
      shadowColor: rgbaColorToString(color),
      shadowOpacity: 1,
      shadowEnabled: newShadowBlur > 0,
    });
  };

  update(state: CanvasBrushLineState, force = false): boolean {
    if (force || this.state !== state) {
      this.log.trace({ state }, 'Updating brush line');
      const { points, color, strokeWidth } = state;
      this.konva.line.setAttrs({
        // A line with only one point will not be rendered, so we duplicate the points to make it visible
        points: points.length === 2 ? [...points, ...points] : points,
        stroke: rgbaColorToString(color),
        strokeWidth, // Keep original strokeWidth here for state consistency
      });
      this.state = state;
      this.finalize(); // Re-apply softness and other effects on update
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
