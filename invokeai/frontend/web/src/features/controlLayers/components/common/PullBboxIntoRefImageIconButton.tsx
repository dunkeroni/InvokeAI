import { IconButton } from '@invoke-ai/ui-library';
import { IAITooltip } from 'common/components/IAITooltip';
import { useRefImageIdContext } from 'features/controlLayers/contexts/RefImageIdContext';
import { usePullBboxIntoGlobalReferenceImage } from 'features/controlLayers/hooks/saveCanvasHooks';
import { useCanvasIsBusy } from 'features/controlLayers/hooks/useCanvasIsBusy';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiBoundingBoxBold } from 'react-icons/pi';

export const PullBboxIntoRefImageIconButton = memo(() => {
  const { t } = useTranslation();
  const id = useRefImageIdContext();

  const pullBboxIntoIPAdapter = usePullBboxIntoGlobalReferenceImage(id);
  const isBusy = useCanvasIsBusy();

  return (
    <IAITooltip label={t('controlLayers.pullBboxIntoReferenceImage')}>
      <IconButton
        onClick={pullBboxIntoIPAdapter}
        isDisabled={isBusy}
        variant="ghost"
        aria-label={t('controlLayers.pullBboxIntoReferenceImage')}
        icon={<PiBoundingBoxBold />}
      />
    </IAITooltip>
  );
});

PullBboxIntoRefImageIconButton.displayName = 'PullBboxIntoRefImageIconButton';
