import { IconButton } from '@invoke-ai/ui-library';
import { useAppDispatch } from 'app/store/storeHooks';
import { IAITooltip } from 'common/components/IAITooltip';
import { dimensionsSwapped } from 'features/controlLayers/store/paramsSlice';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PiArrowsDownUpBold } from 'react-icons/pi';

export const DimensionsSwapButton = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const onClick = useCallback(() => {
    dispatch(dimensionsSwapped());
  }, [dispatch]);
  return (
    <IAITooltip label={t('parameters.swapDimensions')}>
      <IconButton
        aria-label={t('parameters.swapDimensions')}
        onClick={onClick}
        variant="ghost"
        size="sm"
        icon={<PiArrowsDownUpBold />}
      />
    </IAITooltip>
  );
});

DimensionsSwapButton.displayName = 'DimensionsSwapButton';
