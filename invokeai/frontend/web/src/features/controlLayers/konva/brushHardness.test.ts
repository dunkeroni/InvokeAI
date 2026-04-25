import { canvasSettingsSliceConfig } from 'features/controlLayers/store/canvasSettingsSlice';
import { canvasSliceConfig } from 'features/controlLayers/store/canvasSlice';
import { getInitialCanvasState } from 'features/controlLayers/store/types';
import { describe, expect, it } from 'vitest';

import { getBrushHardnessMetrics } from './brushHardness';

describe('brushHardness', () => {
  it('calculates hard brush metrics', () => {
    const metrics = getBrushHardnessMetrics(60, 100);

    expect(metrics.hardnessRatio).toBe(1);
    expect(metrics.softnessRatio).toBe(0);
    expect(metrics.renderStrokeWidth).toBe(60);
    expect(metrics.blurSigmaPx).toBe(0);
    expect(metrics.blurExtentPx).toBe(0);
    expect(metrics.cacheOffsetPx).toBe(0);
    expect(metrics.previewOpacity).toBe(1);
  });

  it('calculates soft brush metrics', () => {
    const metrics = getBrushHardnessMetrics(60, 0);

    expect(metrics.hardnessRatio).toBe(0);
    expect(metrics.softnessRatio).toBe(1);
    expect(metrics.renderStrokeWidth).toBe(0);
    expect(metrics.blurSigmaPx).toBe(10);
    expect(metrics.blurExtentPx).toBe(30);
    expect(metrics.cacheOffsetPx).toBe(30);
    expect(metrics.previewOpacity).toBe(0.4);
  });

  it('migrates persisted brush hardness setting from softness', () => {
    const { brushHardness: _brushHardness, ...legacySettings } = canvasSettingsSliceConfig.getInitialState();

    const migrated = canvasSettingsSliceConfig.persistConfig!.migrate!({
      ...legacySettings,
      brushSoftness: 25,
    });

    expect(migrated).toMatchObject({ brushHardness: 75 });
    expect(migrated && 'brushSoftness' in migrated).toBe(false);
  });

  it('migrates persisted brush line hardness from softness', () => {
    const state = getInitialCanvasState();
    const legacyState = {
      ...state,
      rasterLayers: {
        ...state.rasterLayers,
        entities: [
          {
            id: 'layer-1',
            type: 'raster_layer',
            name: 'Layer',
            isEnabled: true,
            isLocked: false,
            position: { x: 0, y: 0 },
            opacity: 1,
            objects: [
              {
                id: 'brush-line-1',
                type: 'brush_line',
                strokeWidth: 48,
                points: [0, 0, 10, 10],
                color: { r: 255, g: 255, b: 255, a: 1 },
                clip: null,
                softness: 30,
              },
            ],
          },
        ],
      },
    };

    const migrated = canvasSliceConfig.persistConfig!.migrate!(legacyState);
    const migratedObject = migrated?.rasterLayers.entities[0]?.objects[0];

    expect(migratedObject).toMatchObject({ hardness: 70 });
    expect(migratedObject && 'softness' in migratedObject).toBe(false);
  });
});
