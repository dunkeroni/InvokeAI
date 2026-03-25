import { Button } from '@invoke-ai/ui-library';
import { IAITooltip } from 'common/components/IAITooltip';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PiArrowsClockwiseBold } from 'react-icons/pi';
import { useLazyGetOpenAPISchemaQuery } from 'services/api/endpoints/appInfo';

const ReloadNodeTemplatesButton = () => {
  const { t } = useTranslation();
  const [_getOpenAPISchema] = useLazyGetOpenAPISchemaQuery();

  const handleReloadSchema = useCallback(() => {
    _getOpenAPISchema();
  }, [_getOpenAPISchema]);

  return (
    <IAITooltip label={t('nodes.reloadNodeTemplates')}>
      <Button
        leftIcon={<PiArrowsClockwiseBold />}
        aria-label={t('nodes.reloadNodeTemplates')}
        onClick={handleReloadSchema}
      >
        {t('nodes.reloadNodeTemplates')}
      </Button>
    </IAITooltip>
  );
};

export default memo(ReloadNodeTemplatesButton);
