import { IAITooltip } from 'common/components/IAITooltip';
import { IconMenuItem } from 'common/components/IconMenuItem';
import { useCopyImageToClipboard } from 'common/hooks/useCopyImageToClipboard';
import { useImageDTOContext } from 'features/gallery/contexts/ImageDTOContext';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PiCopyBold } from 'react-icons/pi';

export const ContextMenuItemCopy = memo(() => {
  const { t } = useTranslation();
  const imageDTO = useImageDTOContext();
  const copyImageToClipboard = useCopyImageToClipboard();

  const onClick = useCallback(() => {
    copyImageToClipboard(imageDTO.image_url);
  }, [copyImageToClipboard, imageDTO]);

  return (
    <IAITooltip label={t('parameters.copyImage')}>
      <IconMenuItem icon={<PiCopyBold />} aria-label={t('parameters.copyImage')} onClickCapture={onClick} />
    </IAITooltip>
  );
});

ContextMenuItemCopy.displayName = 'ContextMenuItemCopy';
