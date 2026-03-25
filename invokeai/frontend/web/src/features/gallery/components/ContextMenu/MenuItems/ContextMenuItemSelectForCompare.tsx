import { createSelector } from '@reduxjs/toolkit';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import { IAITooltip } from 'common/components/IAITooltip';
import { IconMenuItem } from 'common/components/IconMenuItem';
import { useImageDTOContext } from 'features/gallery/contexts/ImageDTOContext';
import { imageToCompareChanged, selectGallerySlice } from 'features/gallery/store/gallerySlice';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiImagesBold } from 'react-icons/pi';

export const ContextMenuItemSelectForCompare = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const imageDTO = useImageDTOContext();
  const selectMaySelectForCompare = useMemo(
    () =>
      createSelector(selectGallerySlice, (gallery) => {
        return gallery.imageToCompare !== imageDTO.image_name;
      }),
    [imageDTO]
  );
  const maySelectForCompare = useAppSelector(selectMaySelectForCompare);

  const onClick = useCallback(() => {
    dispatch(imageToCompareChanged(imageDTO.image_name));
  }, [dispatch, imageDTO]);

  return (
    <IAITooltip label={t('gallery.selectForCompare')}>
      <IconMenuItem
        icon={<PiImagesBold />}
        isDisabled={!maySelectForCompare}
        onClick={onClick}
        aria-label={t('gallery.selectForCompare')}
      />
    </IAITooltip>
  );
});

ContextMenuItemSelectForCompare.displayName = 'ContextMenuItemSelectForCompare';
