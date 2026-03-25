import { IAITooltip } from 'common/components/IAITooltip';
import { IconMenuItem } from 'common/components/IconMenuItem';
import { useDownloadItem } from 'common/hooks/useDownloadImage';
import { useImageDTOContext } from 'features/gallery/contexts/ImageDTOContext';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PiDownloadSimpleBold } from 'react-icons/pi';

export const ContextMenuItemDownload = memo(() => {
  const { t } = useTranslation();
  const imageDTO = useImageDTOContext();
  const { downloadItem } = useDownloadItem();

  const onClick = useCallback(() => {
    downloadItem(imageDTO.image_url, imageDTO.image_name);
  }, [downloadItem, imageDTO]);

  return (
    <IAITooltip label={t('gallery.download')}>
      <IconMenuItem icon={<PiDownloadSimpleBold />} aria-label={t('gallery.download')} onClick={onClick} />
    </IAITooltip>
  );
});

ContextMenuItemDownload.displayName = 'ContextMenuItemDownload';
