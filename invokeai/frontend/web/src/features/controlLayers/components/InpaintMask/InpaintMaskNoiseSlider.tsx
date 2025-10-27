import { Flex, Slider, SliderFilledTrack, SliderThumb, SliderTrack, Switch, Text } from '@invoke-ai/ui-library';
import { createSelector } from '@reduxjs/toolkit';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import { InpaintMaskDeleteModifierButton } from 'features/controlLayers/components/InpaintMask/InpaintMaskDeleteModifierButton';
import { useEntityIdentifierContext } from 'features/controlLayers/contexts/EntityIdentifierContext';
import {
  inpaintMaskNoiseChanged,
  inpaintMaskNoiseDeleted,
  inpaintMaskNoiseDeluminateToggled,
} from 'features/controlLayers/store/canvasSlice';
import { selectCanvasSlice, selectEntityOrThrow } from 'features/controlLayers/store/selectors';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export const InpaintMaskNoiseSlider = memo(() => {
  const entityIdentifier = useEntityIdentifierContext('inpaint_mask');
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const selectNoiseLevel = useMemo(
    () =>
      createSelector(
        selectCanvasSlice,
        (canvas) => selectEntityOrThrow(canvas, entityIdentifier, 'InpaintMaskNoiseSlider').noiseLevel
      ),
    [entityIdentifier]
  );
  const noiseLevel = useAppSelector(selectNoiseLevel);

  const selectDeluminate = useMemo(
    () =>
      createSelector(
        selectCanvasSlice,
        (canvas) => selectEntityOrThrow(canvas, entityIdentifier, 'InpaintMaskNoiseSlider').noiseDeluminate ?? true
      ),
    [entityIdentifier]
  );
  const noiseDeluminate = useAppSelector(selectDeluminate);

  const handleNoiseChange = useCallback(
    (value: number) => {
      dispatch(inpaintMaskNoiseChanged({ entityIdentifier, noiseLevel: value }));
    },
    [dispatch, entityIdentifier]
  );

  const onDeleteNoise = useCallback(() => {
    dispatch(inpaintMaskNoiseDeleted({ entityIdentifier }));
  }, [dispatch, entityIdentifier]);

  const onToggleDeluminate = useCallback(() => {
    dispatch(inpaintMaskNoiseDeluminateToggled({ entityIdentifier }));
  }, [dispatch, entityIdentifier]);

  if (noiseLevel === undefined) {
    return null;
  }

  return (
    <Flex direction="column" gap={1} w="full" px={2} pb={2}>
      <Flex justifyContent="space-between" w="full" alignItems="center">
        <Text fontSize="sm">{t('controlLayers.imageNoise')}</Text>
        <Flex alignItems="center" gap={1}>
          <Text fontSize="sm">{Math.round(noiseLevel * 100)}%</Text>
          <InpaintMaskDeleteModifierButton onDelete={onDeleteNoise} />
        </Flex>
      </Flex>
      <Slider
        aria-label={t('controlLayers.imageNoise')}
        value={noiseLevel}
        min={0}
        max={1}
        step={0.01}
        onChange={handleNoiseChange}
      >
        <SliderTrack>
          <SliderFilledTrack />
        </SliderTrack>
        <SliderThumb />
      </Slider>
      <Flex justifyContent="flex-end" w="full" alignItems="center" px={1} gap={1}>
        <Text fontSize="sm" textAlign="right">
          {t('controlLayers.deluminateNoise', 'Deluminate noise')}
        </Text>
        <Switch isChecked={noiseDeluminate} onChange={onToggleDeluminate} />
      </Flex>
    </Flex>
  );
});

InpaintMaskNoiseSlider.displayName = 'InpaintMaskNoiseSlider';
