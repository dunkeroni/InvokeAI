import type { ButtonProps } from '@invoke-ai/ui-library';
import { Button } from '@invoke-ai/ui-library';
import { IAITooltip } from 'common/components/IAITooltip';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiTrashBold } from 'react-icons/pi';

import { useClearQueueDialog } from './ClearQueueConfirmationAlertDialog';

export const ClearQueueButton = memo((props: ButtonProps) => {
  const { t } = useTranslation();
  const api = useClearQueueDialog();

  return (
    <IAITooltip label={t('queue.clearTooltip')}>
      <Button
        isDisabled={api.isDisabled}
        isLoading={api.isLoading}
        aria-label={t('queue.clear')}
        leftIcon={<PiTrashBold />}
        colorScheme="error"
        onClick={api.openDialog}
        {...props}
      >
        {t('queue.clear')}
      </Button>
    </IAITooltip>
  );
});

ClearQueueButton.displayName = 'ClearQueueButton';
