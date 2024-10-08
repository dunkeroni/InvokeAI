import { FormControl, FormLabel, Switch } from '@invoke-ai/ui-library';
import type { LineartProcessorConfig } from 'features/controlLayers/store/types';
import type { ChangeEvent } from 'react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { FilterComponentProps } from './types';

type Props = FilterComponentProps<LineartProcessorConfig>;

export const FilterLineart = memo(({ onChange, config }: Props) => {
  const { t } = useTranslation();

  const handleCoarseChanged = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...config, coarse: e.target.checked });
    },
    [config, onChange]
  );

  return (
    <>
      <FormControl>
        <FormLabel m={0}>{t('controlnet.coarse')}</FormLabel>
        <Switch isChecked={config.coarse} onChange={handleCoarseChanged} />
      </FormControl>
    </>
  );
});

FilterLineart.displayName = 'FilterLineart';
