/* eslint-disable i18next/no-literal-string */
import { Flex, Spacer } from '@invoke-ai/ui-library';
import { CanvasSettingsPopover } from 'features/controlLayers/components/Settings/CanvasSettingsPopover';
import { ToolChooser } from 'features/controlLayers/components/Tool/ToolChooser';
import { ToolColorPicker } from 'features/controlLayers/components/Tool/ToolFillColorPicker';
import { ToolSettings } from 'features/controlLayers/components/Tool/ToolSettings';
import { CanvasToolbarResetViewButton } from 'features/controlLayers/components/Toolbar/CanvasToolbarResetViewButton';
import { CanvasToolbarSaveToGalleryButton } from 'features/controlLayers/components/Toolbar/CanvasToolbarSaveToGalleryButton';
import { CanvasToolbarScale } from 'features/controlLayers/components/Toolbar/CanvasToolbarScale';
import { CanvasManagerProviderGate } from 'features/controlLayers/contexts/CanvasManagerProviderGate';
import { useCanvasDeleteLayerHotkey } from 'features/controlLayers/hooks/useCanvasDeleteLayerHotkey';
import { useCanvasEntityQuickSwitchHotkey } from 'features/controlLayers/hooks/useCanvasEntityQuickSwitchHotkey';
import { useCanvasResetLayerHotkey } from 'features/controlLayers/hooks/useCanvasResetLayerHotkey';
import { useCanvasUndoRedoHotkeys } from 'features/controlLayers/hooks/useCanvasUndoRedoHotkeys';
import { useNextPrevEntityHotkeys } from 'features/controlLayers/hooks/useNextPrevEntity';
import { ToggleProgressButton } from 'features/gallery/components/ImageViewer/ToggleProgressButton';
import { ViewerToggle } from 'features/gallery/components/ImageViewer/ViewerToggleMenu';
import { memo } from 'react';

export const CanvasToolbar = memo(() => {
  useCanvasResetLayerHotkey();
  useCanvasDeleteLayerHotkey();
  useCanvasUndoRedoHotkeys();
  useCanvasEntityQuickSwitchHotkey();
  useNextPrevEntityHotkeys();

  return (
    <CanvasManagerProviderGate>
      <Flex w="full" gap={2} alignItems="center">
        <ToggleProgressButton />
        <ToolChooser />
        <Spacer />
        <ToolSettings />
        <Spacer />
        <CanvasToolbarScale />
        <CanvasToolbarResetViewButton />
        <Spacer />
        <ToolColorPicker />
        <CanvasToolbarSaveToGalleryButton />
        <CanvasSettingsPopover />
        <ViewerToggle />
      </Flex>
    </CanvasManagerProviderGate>
  );
});

CanvasToolbar.displayName = 'CanvasToolbar';
