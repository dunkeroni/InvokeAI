import { createMemoizedSelector } from 'app/store/createMemoizedSelector';
import { stateSelector } from 'app/store/store';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import { IAISlider } from 'common/components/IAISlider';
import {
  settingsBrushWidthChanged, // Renamed from setBrushSize
  settingsEraserWidthChanged, // Renamed from setEraserSize
  settingsSoftnessChanged, // Renamed from setSoftness
} from 'features/controlLayers/store/canvasSettingsSlice'; // Updated import path
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

const selector = createMemoizedSelector(
  [stateSelector],
  ({ params, canvasSettings }) => { // Added canvasSettings to selector dependencies
    // activeToolName still comes from params.tool
    const activeToolName = params.tool?.activeToolName ?? 'brush'; // Default if not present

    // brushWidth, eraserWidth, and softness now come from canvasSettings
    const { brushWidth, eraserWidth, softness } = canvasSettings;
    return {
      activeToolName,
      brushWidth, // Use brushWidth from canvasSettings
      eraserWidth, // Use eraserWidth from canvasSettings
      softness,    // Use softness from canvasSettings
    };
  }
);

const ToolSettings = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    activeToolName,
    brushWidth, // Changed from brushSize
    eraserWidth, // Changed from eraserSize
    softness,
  } = useAppSelector(selector);

  const handleChangeBrushSize = (v: number) => {
    dispatch(settingsBrushWidthChanged(v)); // Dispatch action from canvasSettingsSlice
  };

  const handleChangeEraserSize = (v: number) => {
    dispatch(settingsEraserWidthChanged(v)); // Dispatch action from canvasSettingsSlice
  };

  const handleChangeSoftness = (v: number) => {
    dispatch(settingsSoftnessChanged(v)); // Dispatch action from canvasSettingsSlice
  };

  if (activeToolName === 'brush' || activeToolName === 'eraser') {
    return (
      <div className="tool-settings" style={{display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem', paddingBottom: '0.5rem'}}>
        {activeToolName === 'brush' && (
          <IAISlider
            label={t('parameters.brushSize')} // Assuming this t-key is fine, or change to brushWidth if needed
            value={brushWidth} // Use brushWidth
            onChange={handleChangeBrushSize}
            min={1}
            max={500}
            withReset
            handleReset={() => {
              dispatch(settingsBrushWidthChanged(50)); // Dispatch action from canvasSettingsSlice, default is 50
            }}
          />
        )}
        {activeToolName === 'eraser' && (
          <IAISlider
            label={t('parameters.eraserSize')} // Assuming this t-key is fine, or change to eraserWidth if needed
            value={eraserWidth} // Use eraserWidth
            onChange={handleChangeEraserSize}
            min={1}
            max={500}
            withReset
            handleReset={() => {
              dispatch(settingsEraserWidthChanged(50)); // Dispatch action from canvasSettingsSlice, default is 50
            }}
          />
        )}
        {/* Soften slider uses softness from canvasSettingsSlice */}
        <IAISlider
          label={t('parameters.softness', 'Soften')}
          value={softness}
          onChange={handleChangeSoftness}
          min={0}
          max={100}
          withReset
          handleReset={() => {
            dispatch(settingsSoftnessChanged(0)); // Dispatch action from canvasSettingsSlice, default is 0
          }}
        />
      </div>
    );
  }

  return null;
};

export default memo(ToolSettings);
