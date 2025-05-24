import { Button, Flex, Heading, Menu, MenuButton, MenuItem, MenuList, Slider, Text } from '@invoke-ai/ui-library';
import { useStore } from '@nanostores/react';
import { useCanvasManager } from 'features/controlLayers/contexts/CanvasManagerProviderGate';
import type { CanvasBooleanCutoutModule } from 'features/controlLayers/konva/CanvasBooleanCutoutModule';
import type { CanvasEntityAdapterInpaintMaskLayer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityAdapterInpaintMaskLayer';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiCaretDownBold, PiFloppyDiskBold } from 'react-icons/pi';

const BooleanCutoutContent = memo(
  ({
    adapter,
    booleanCutoutModule,
  }: {
    adapter: CanvasEntityAdapterInpaintMaskLayer; // Adapter might still be useful for context
    booleanCutoutModule: CanvasBooleanCutoutModule;
  }) => {
    const { t } = useTranslation();
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const hasLastResult = useStore(booleanCutoutModule.$hasLastResult);

    const handleOptionClick = useCallback(
      (option: 'erase' | 'extract' | 'extract (fit)' | 'erase (fit)') => {
        setSelectedOption(option);
        booleanCutoutModule.performOperation(option);
      },
      [booleanCutoutModule]
    );

    const handleSaveAsInpaintMask = useCallback(() => {
      booleanCutoutModule.saveAsInpaintMask();
    }, [booleanCutoutModule]);

    const showSliders = selectedOption === 'extract (fit)' || selectedOption === 'erase (fit)';

    // Update sliders in module when they change in UI
    const handleRangeChange = useCallback(
      (value: number) => {
        booleanCutoutModule.setRange(value);
      },
      [booleanCutoutModule]
    );

    const handleIterationsChange = useCallback(
      (value: number) => {
        booleanCutoutModule.setIterations(value);
      },
      [booleanCutoutModule]
    );

    const range = useStore(booleanCutoutModule.$range);
    const iterations = useStore(booleanCutoutModule.$iterations);

    return (
      <Flex
        bg="base.800"
        borderRadius="base"
        p={4}
        flexDir="column"
        gap={4}
        minW={320} // Adjusted width
        h="auto"
        shadow="dark-lg"
        transitionProperty="height"
        transitionDuration="normal"
      >
        <Heading size="md" color="base.300" userSelect="none">
          {t('controlLayers.booleanCutout.title', 'Boolean Cutout')}
        </Heading>

        <Menu>
          <MenuButton as={Button} w="full" rightIcon={<PiCaretDownBold />}>
            {selectedOption
              ? t(`controlLayers.booleanCutout.${selectedOption}`, selectedOption)
              : t('controlLayers.booleanCutout.selectAction', 'Select Action')}
          </MenuButton>
          <MenuList>
            <MenuItem onClick={() => handleOptionClick('erase')}>{t('controlLayers.booleanCutout.erase', 'Erase')}</MenuItem>
            <MenuItem onClick={() => handleOptionClick('extract')}>
              {t('controlLayers.booleanCutout.extract', 'Extract')}
            </MenuItem>
            <MenuItem onClick={() => handleOptionClick('extract (fit)')}>
              {t('controlLayers.booleanCutout.extractFit', 'Extract (Fit)')}
            </MenuItem>
            <MenuItem onClick={() => handleOptionClick('erase (fit)')}>
              {t('controlLayers.booleanCutout.eraseFit', 'Erase (Fit)')}
            </MenuItem>
            <MenuItem icon={<PiFloppyDiskBold />} isDisabled={!hasLastResult} onClick={handleSaveAsInpaintMask}>
              {t('controlLayers.booleanCutout.saveAsInpaintMask', 'Save As Inpaint Mask')}
            </MenuItem>
          </MenuList>
        </Menu>

        {showSliders && (
          <Flex flexDir="column" gap={4} pt={2}>
            <Flex flexDir="column" gap={2}>
              <Text size="sm" fontWeight="semibold" color="base.400">
                {t('controlLayers.booleanCutout.range', 'Range')}
              </Text>
              <Slider min={1} max={100} value={range} onChange={handleRangeChange} />
            </Flex>
            <Flex flexDir="column" gap={2}>
              <Text size="sm" fontWeight="semibold" color="base.400">
                {t('controlLayers.booleanCutout.iterations', 'Iterations')}
              </Text>
              <Slider min={2} max={15} value={iterations} onChange={handleIterationsChange} />
            </Flex>
          </Flex>
        )}
        {/* Placeholder for future buttons like Apply/Cancel if needed */}
      </Flex>
    );
  }
);

BooleanCutoutContent.displayName = 'BooleanCutoutContent';

export const BooleanCutout = memo(() => {
  const canvasManager = useCanvasManager();
  const selectedLayerAdapter = useStore(canvasManager.stateApi.$selectedLayers)[0];

  const booleanCutoutModule = useMemo(() => {
    if (
      selectedLayerAdapter &&
      selectedLayerAdapter.type === 'inpaint_mask_layer' &&
      'booleanCutout' in selectedLayerAdapter && // Check if the module exists on the adapter
      selectedLayerAdapter.booleanCutout instanceof Object // Basic check for existence
    ) {
      return selectedLayerAdapter.booleanCutout as CanvasBooleanCutoutModule;
    }
    return null;
  }, [selectedLayerAdapter]);

  if (!selectedLayerAdapter || !booleanCutoutModule || selectedLayerAdapter.type !== 'inpaint_mask_layer') {
    // Don't render if no InpaintMask layer is selected, or it doesn't have the boolean cutout module
    return null;
  }

  return (
    <BooleanCutoutContent
      adapter={selectedLayerAdapter as CanvasEntityAdapterInpaintMaskLayer}
      booleanCutoutModule={booleanCutoutModule}
    />
  );
});

BooleanCutout.displayName = 'BooleanCutout';
