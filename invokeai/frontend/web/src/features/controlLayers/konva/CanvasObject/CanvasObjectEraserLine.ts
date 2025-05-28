import { deepClone } from 'common/util/deepClone';
import type { CanvasEntityBufferObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityBufferObjectRenderer';
import type { CanvasEntityObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityObjectRenderer';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { CanvasModuleBase } from 'features/controlLayers/konva/CanvasModuleBase';
import type { CanvasEraserLineState } from 'features/controlLayers/store/types';
import Konva from 'konva';
import type { Logger } from 'roarr';

export class CanvasObjectEraserLine extends CanvasModuleBase {
  readonly type = 'object_eraser_line';
  readonly id: string;
  readonly path: string[];
  readonly parent: CanvasEntityObjectRenderer | CanvasEntityBufferObjectRenderer;
  readonly manager: CanvasManager;
  readonly log: Logger;

  state: CanvasEraserLineState;
  konva: {
    group: Konva.Group;
    line: Konva.Line;
  };

  constructor(state: CanvasEraserLineState, parent: CanvasEntityObjectRenderer | CanvasEntityBufferObjectRenderer) {
    super();
    this.id = state.id;
    this.parent = parent;
    this.manager = parent.manager;
    this.path = this.manager.buildPath(this);
    this.log = this.manager.buildLogger(this);

    this.log.debug({ state }, 'Creating eraser line renderer module');

    this.konva = {
      group: new Konva.Group({
        name: `${this.type}:group`,
        clip: state.clip,
        listening: false,
      }),
      line: new Konva.Line({
        name: `${this.type}:line`,
        listening: false,
        shadowForStrokeEnabled: false,
        stroke: 'red', // Eraser lines use compositing, does not matter what color they have
        tension: 0.3,
        lineCap: 'round',
        lineJoin: 'round',
        globalCompositeOperation: 'destination-out',
        perfectDrawEnabled: false,
      }),
    };
    this.konva.group.add(this.konva.line);
    this.state = state;
  }

  update(state: CanvasEraserLineState, force = false): boolean {
    if (force || this.state !== state) {
      this.log.trace({ state }, 'Updating eraser line');
      const { points } = state;
      let { strokeWidth } = state; // Make strokeWidth mutable for softness calculation

      // A line with only one point will not be rendered, so we duplicate the points to make it visible
      const konvaPoints = points.length === 2 ? [...points, ...points] : points;

      // Apply softness
      const canvasSettings = this.manager.stateApi.getStore().getState().canvasSettings;
      const softness = canvasSettings.softness ?? 0; // Default to 0 if undefined
      const softnessRatio = softness / 100;

      let newStrokeWidth = strokeWidth * (1 - softnessRatio);
      let newShadowBlur = (strokeWidth * softnessRatio) / 2;

      if (newStrokeWidth < 3) {
        newStrokeWidth = 3;
        newShadowBlur = Math.max(0, (strokeWidth - 3) / 2);
      }

      this.konva.line.setAttrs({
        points: konvaPoints,
        strokeWidth: newStrokeWidth,
        shadowBlur: newShadowBlur,
        // For erasers, shadowColor should ideally be what's "behind" the erased area.
        // Using the current tool color from canvasSettings.
        // The globalCompositeOperation='destination-out' will make the shadow also "erase".
        shadowColor: rgbaColorToString(canvasSettings.color), // Updated to use canvasSettings.color
        shadowOpacity: 1,
        shadowEnabled: newShadowBlur > 0,
      });

      this.state = state; // Update the component's state
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
