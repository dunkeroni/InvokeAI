import { FormControl, FormLabel, Switch } from '@invoke-ai/ui-library';
import type { HedProcessorConfig } from 'features/controlLayers/store/types';
import type { ChangeEvent } from 'react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { FilterComponentProps } from './types';

type Props = FilterComponentProps<HedProcessorConfig>;

export const FilterHed = memo(({ onChange, config }: Props) => {
  const { t } = useTranslation();

  const handleScribbleChanged = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...config, scribble: e.target.checked });
    },
    [config, onChange]
  );

  return (
    <>
      <FormControl>
        <FormLabel m={0}>{t('controlnet.scribble')}</FormLabel>
        <Switch isChecked={config.scribble} onChange={handleScribbleChanged} />
      </FormControl>
    </>
  );
});

FilterHed.displayName = 'FilterHed';
