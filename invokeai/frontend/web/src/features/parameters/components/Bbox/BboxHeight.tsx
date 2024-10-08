import { CompositeNumberInput, CompositeSlider, FormControl, FormLabel } from '@invoke-ai/ui-library';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import { InformationalPopover } from 'common/components/InformationalPopover/InformationalPopover';
import { bboxHeightChanged } from 'features/controlLayers/store/canvasSlice';
import { selectHeight, selectOptimalDimension } from 'features/controlLayers/store/selectors';
import { selectHeightConfig } from 'features/system/store/configSlice';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export const BboxHeight = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const optimalDimension = useAppSelector(selectOptimalDimension);
  const height = useAppSelector(selectHeight);
  const config = useAppSelector(selectHeightConfig);

  const onChange = useCallback(
    (v: number) => {
      dispatch(bboxHeightChanged({ height: v }));
    },
    [dispatch]
  );

  const marks = useMemo(
    () => [config.sliderMin, optimalDimension, config.sliderMax],
    [config.sliderMin, config.sliderMax, optimalDimension]
  );

  return (
    <FormControl>
      <InformationalPopover feature="paramHeight">
        <FormLabel>{t('parameters.height')}</FormLabel>
      </InformationalPopover>
      <CompositeSlider
        value={height}
        defaultValue={optimalDimension}
        onChange={onChange}
        min={config.sliderMin}
        max={config.sliderMax}
        step={config.coarseStep}
        fineStep={config.fineStep}
        marks={marks}
      />
      <CompositeNumberInput
        value={height}
        defaultValue={optimalDimension}
        onChange={onChange}
        min={config.numberInputMin}
        max={config.numberInputMax}
        step={config.coarseStep}
        fineStep={config.fineStep}
      />
    </FormControl>
  );
});

BboxHeight.displayName = 'BboxHeight';
