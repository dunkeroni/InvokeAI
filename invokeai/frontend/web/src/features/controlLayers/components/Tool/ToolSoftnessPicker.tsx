import { CompositeNumberInput, CompositeSlider, Flex, FormControl, FormLabel } from '@invoke-ai/ui-library';
import { createSelector } from '@reduxjs/toolkit';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import {
  selectCanvasSettingsSlice,
  settingsBrushSoftnessChanged,
} from 'features/controlLayers/store/canvasSettingsSlice';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const selectBrushSoftness = createSelector(selectCanvasSettingsSlice, (settings) => settings.brushSoftness);

const marks = [0, 25, 50, 75, 100];

const formatPct = (v: number | string) => `${v}%`;

export const ToolSoftnessPicker = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const brushSoftness = useAppSelector(selectBrushSoftness);

  const onChange = useCallback(
    (value: number) => {
      dispatch(settingsBrushSoftnessChanged(value));
    },
    [dispatch]
  );

  return (
    <FormControl w={200}>
      <FormLabel m={0}>{t('controlLayers.tool.softness', 'Softness')}</FormLabel>
      <Flex gap={4} alignItems="center">
        <CompositeSlider
          min={0}
          max={100}
          step={1}
          value={brushSoftness}
          onChange={onChange}
          defaultValue={0}
          marks={marks}
          alwaysShowMarks
        />
        <CompositeNumberInput
          w={24}
          variant="outline"
          min={0}
          max={100}
          step={1}
          value={brushSoftness}
          onChange={onChange}
          defaultValue={0}
          format={formatPct}
        />
      </Flex>
    </FormControl>
  );
});

ToolSoftnessPicker.displayName = 'ToolSoftnessPicker';
