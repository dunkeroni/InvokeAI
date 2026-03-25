import { IconButton } from '@invoke-ai/ui-library';
import { IAITooltip } from 'common/components/IAITooltip';
import { useInputFieldDefaultValue } from 'features/nodes/hooks/useInputFieldDefaultValue';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiArrowCounterClockwiseBold } from 'react-icons/pi';

type Props = {
  nodeId: string;
  fieldName: string;
};

export const InputFieldResetToDefaultValueIconButton = memo(({ fieldName }: Props) => {
  const { t } = useTranslation();
  const { isValueChanged, resetToDefaultValue } = useInputFieldDefaultValue(fieldName);

  return (
    <IAITooltip label={t('nodes.resetToDefaultValue')}>
      <IconButton
        variant="ghost"
        aria-label={t('nodes.resetToDefaultValue')}
        icon={<PiArrowCounterClockwiseBold />}
        pointerEvents="auto"
        size="xs"
        onClick={resetToDefaultValue}
        isDisabled={!isValueChanged}
      />
    </IAITooltip>
  );
});

InputFieldResetToDefaultValueIconButton.displayName = 'InputFieldResetToDefaultValueIconButton';
