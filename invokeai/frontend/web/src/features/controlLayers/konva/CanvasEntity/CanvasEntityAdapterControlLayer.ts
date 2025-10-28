import { omit } from 'es-toolkit/compat';
import { CanvasEntityAdapterBase } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityAdapterBase';
import { CanvasEntityBufferObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityBufferObjectRenderer';
import { CanvasEntityFilterer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityFilterer';
import { CanvasEntityObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityObjectRenderer';
import { CanvasEntityTransformer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityTransformer';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { CanvasSegmentAnythingModule } from 'features/controlLayers/konva/CanvasSegmentAnythingModule';
import type { CanvasControlLayerState, CanvasEntityIdentifier, Rect } from 'features/controlLayers/store/types';
import type { GroupConfig } from 'konva/lib/Group';
import type { JsonObject } from 'type-fest';

export class CanvasEntityAdapterControlLayer extends CanvasEntityAdapterBase<
  CanvasControlLayerState,
  'control_layer_adapter'
> {
  renderer: CanvasEntityObjectRenderer;
  bufferRenderer: CanvasEntityBufferObjectRenderer;
  transformer: CanvasEntityTransformer;
  filterer: CanvasEntityFilterer;
  segmentAnything: CanvasSegmentAnythingModule;

  constructor(entityIdentifier: CanvasEntityIdentifier<'control_layer'>, manager: CanvasManager) {
    super(entityIdentifier, manager, 'control_layer_adapter');

    this.renderer = new CanvasEntityObjectRenderer(this);
    this.bufferRenderer = new CanvasEntityBufferObjectRenderer(this);
    this.transformer = new CanvasEntityTransformer(this);
    this.filterer = new CanvasEntityFilterer(this);
    this.segmentAnything = new CanvasSegmentAnythingModule(this);

    this.subscriptions.add(this.manager.stateApi.createStoreSubscription(this.selectState, this.sync));
  }

  sync = async (state: CanvasControlLayerState | undefined, prevState: CanvasControlLayerState | undefined) => {
    if (!state) {
      this.destroy();
      return;
    }

    this.state = state;

    if (prevState && prevState === this.state) {
      return;
    }

    if (!prevState || this.state.isEnabled !== prevState.isEnabled) {
      this.syncIsEnabled();
    }
    if (!prevState || this.state.isLocked !== prevState.isLocked) {
      this.syncIsLocked();
    }
    if (!prevState || this.state.objects !== prevState.objects) {
      await this.syncObjects();
    }
    if (!prevState || this.state.position !== prevState.position) {
      this.syncPosition();
    }
    if (!prevState || this.state.opacity !== prevState.opacity) {
      this.syncOpacity();
    }
    if (!prevState || this.state.globalCompositeOperation !== prevState.globalCompositeOperation) {
      this.syncGlobalCompositeOperation();
    }
    if (!prevState || this.state.withTransparencyEffect !== prevState.withTransparencyEffect) {
      this.renderer.updateTransparencyEffect();
    }
  };

  syncTransparencyEffect = () => {
    this.renderer.updateTransparencyEffect();
  };

  private syncGlobalCompositeOperation = () => {
    this.log.trace('Syncing globalCompositeOperation');
    const operation = this.state.globalCompositeOperation ?? 'source-over';

    // Map globalCompositeOperation to CSS mix-blend-mode
    // CSS mix-blend-mode is applied to the canvas DOM element to control how it blends with other layers
    const mixBlendModeMap: Record<string, string> = {
      'source-over': 'normal',
      multiply: 'multiply',
      screen: 'screen',
      overlay: 'overlay',
      darken: 'darken',
      lighten: 'lighten',
      'color-dodge': 'color-dodge',
      'color-burn': 'color-burn',
      'hard-light': 'hard-light',
      'soft-light': 'soft-light',
      difference: 'difference',
      exclusion: 'exclusion',
      hue: 'hue',
      saturation: 'saturation',
      color: 'color',
      luminosity: 'luminosity',
    };

    const mixBlendMode = mixBlendModeMap[operation] || 'normal';

    // Access the underlying canvas DOM element and set CSS mix-blend-mode
    const canvasElement = this.konva.layer.getCanvas()._canvas;
    if (canvasElement) {
      canvasElement.style.mixBlendMode = mixBlendMode;
    }
  };

  getCanvas = (rect?: Rect): HTMLCanvasElement => {
    this.log.trace({ rect }, 'Getting canvas');
    // The opacity may have been changed in response to user selecting a different entity category, so we must restore
    // the original opacity before rendering the canvas
    const attrs: GroupConfig = { opacity: this.state.opacity };
    const canvas = this.renderer.getCanvas({ rect, attrs });
    return canvas;
  };

  getHashableState = (): JsonObject => {
    const keysToOmit: (keyof CanvasControlLayerState)[] = [
      'name',
      'controlAdapter',
      'withTransparencyEffect',
      'isLocked',
    ];
    return omit(this.state, keysToOmit);
  };
}
