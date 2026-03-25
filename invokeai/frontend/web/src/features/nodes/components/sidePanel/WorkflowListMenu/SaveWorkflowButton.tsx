import { IconButton } from '@invoke-ai/ui-library';
import { IAITooltip } from 'common/components/IAITooltip';
import { useSaveOrSaveAsWorkflow } from 'features/workflowLibrary/hooks/useSaveOrSaveAsWorkflow';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiFloppyDiskBold } from 'react-icons/pi';

const SaveWorkflowButton = () => {
  const { t } = useTranslation();
  const saveOrSaveAsWorkflow = useSaveOrSaveAsWorkflow();

  return (
    <IAITooltip label={t('workflows.saveWorkflow')}>
      <IconButton
        aria-label={t('workflows.saveWorkflow')}
        icon={<PiFloppyDiskBold />}
        onClick={saveOrSaveAsWorkflow}
        pointerEvents="auto"
        variant="ghost"
        size="sm"
      />
    </IAITooltip>
  );
};

export default memo(SaveWorkflowButton);
