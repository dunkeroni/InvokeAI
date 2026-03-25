import { IconButton } from '@invoke-ai/ui-library';
import { IAITooltip } from 'common/components/IAITooltip';
import { $stylePresetModalState } from 'features/stylePresets/store/stylePresetModal';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PiPlusBold } from 'react-icons/pi';

export const StylePresetCreateButton = () => {
  const handleClickAddNew = useCallback(() => {
    $stylePresetModalState.set({
      prefilledFormData: null,
      updatingStylePresetId: null,
      isModalOpen: true,
    });
  }, []);

  const { t } = useTranslation();

  return (
    <IAITooltip label={t('stylePresets.createPromptTemplate')}>
      <IconButton
        size="sm"
        variant="link"
        alignSelf="stretch"
        icon={<PiPlusBold />}
        aria-label={t('stylePresets.createPromptTemplate')}
        onClick={handleClickAddNew}
      />
    </IAITooltip>
  );
};
