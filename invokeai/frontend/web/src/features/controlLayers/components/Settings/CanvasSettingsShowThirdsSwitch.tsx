import { FormControl, FormLabel, Switch } from '@invoke-ai/ui-library';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import { selectShowThirds, settingsShowThirdsToggled } from 'features/controlLayers/store/canvasSettingsSlice';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export const CanvasSettingsShowThirdsSwitch = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const showThirds = useAppSelector(selectShowThirds);
  const onChange = useCallback(() => {
    dispatch(settingsShowThirdsToggled());
  }, [dispatch]);

  return (
    <FormControl>
      <FormLabel m={0} flexGrow={1}>
        {t('controlLayers.showThirds')}
      </FormLabel>
      <Switch size="sm" isChecked={showThirds} onChange={onChange} />
    </FormControl>
  );
});

CanvasSettingsShowThirdsSwitch.displayName = 'CanvasSettingsShowThirdsSwitch';
