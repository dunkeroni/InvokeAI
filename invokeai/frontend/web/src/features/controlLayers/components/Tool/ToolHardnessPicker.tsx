import {
  CompositeNumberInput,
  CompositeSlider,
  Flex,
  FormControl,
  IconButton,
  NumberInput,
  NumberInputField,
  Popover,
  PopoverAnchor,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Portal,
} from '@invoke-ai/ui-library';
import { createSelector } from '@reduxjs/toolkit';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import { clamp } from 'es-toolkit/compat';
import {
  selectCanvasSettingsSlice,
  settingsBrushHardnessChanged,
} from 'features/controlLayers/store/canvasSettingsSlice';
import type { FocusEvent, KeyboardEvent, PointerEvent } from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { PiCaretDownBold } from 'react-icons/pi';

const formatPct = (v: number | string) => `${v}%`;

const marks = [0, 25, 50, 75, 100];

const SLIDER_VS_DROPDOWN_CONTAINER_WIDTH_THRESHOLD = 280;
const DEFAULT_HARDNESS = 100;
const parseInputValue = (value: string) => Number.parseFloat(value);
const getInputValueFromEvent = (
  event?: Pick<FocusEvent<HTMLElement> | KeyboardEvent<HTMLElement>, 'target' | 'currentTarget'>
) => {
  const target = event?.target as HTMLInputElement | null;
  if (target?.tagName === 'INPUT') {
    return { input: target, parsed: parseInputValue(target.value) };
  }
  const currentTarget = event?.currentTarget as HTMLElement | null;
  const input = currentTarget?.querySelector('input') ?? null;
  return { input, parsed: input ? parseInputValue(input.value) : NaN };
};

interface ToolHardnessPickerComponentProps {
  localValue: number;
  onChangeSlider: (value: number) => void;
  onChangeInput: (value: number) => void;
  onBlur: (event?: FocusEvent<HTMLElement>) => void;
  onKeyDown: (value: KeyboardEvent<HTMLInputElement>) => void;
  onPointerDownCapture: (value: PointerEvent<HTMLDivElement>) => void;
  onPointerUpCapture: (value: PointerEvent<HTMLDivElement>) => void;
}

const DropDownToolHardnessPickerComponent = memo(
  ({
    localValue,
    onChangeSlider,
    onChangeInput,
    onKeyDown,
    onPointerDownCapture,
    onPointerUpCapture,
    onBlur,
  }: ToolHardnessPickerComponentProps) => {
    const onChangeNumberInput = useCallback(
      (valueAsString: string, valueAsNumber: number) => {
        onChangeInput(valueAsNumber);
      },
      [onChangeInput]
    );

    return (
      <Popover>
        <FormControl w="min-content" gap={2} overflow="hidden">
          <PopoverAnchor>
            <NumberInput
              variant="outline"
              display="flex"
              alignItems="center"
              min={0}
              max={100}
              value={localValue}
              onChange={onChangeNumberInput}
              onBlur={onBlur}
              w={76}
              format={formatPct}
              defaultValue={100}
              onKeyDown={onKeyDown}
              onPointerDownCapture={onPointerDownCapture}
              onPointerUpCapture={onPointerUpCapture}
              clampValueOnBlur={false}
            >
              <NumberInputField _focusVisible={{ zIndex: 0 }} title="" paddingInlineEnd={7} />
              <PopoverTrigger>
                <IconButton
                  aria-label="open-slider"
                  icon={<PiCaretDownBold />}
                  size="sm"
                  variant="link"
                  position="absolute"
                  insetInlineEnd={0}
                  h="full"
                />
              </PopoverTrigger>
            </NumberInput>
          </PopoverAnchor>
        </FormControl>
        <Portal>
          <PopoverContent w={200} pt={0} pb={2} px={4}>
            <PopoverArrow />
            <PopoverBody>
              <CompositeSlider
                min={0}
                max={100}
                value={localValue}
                onChange={onChangeSlider}
                defaultValue={100}
                marks={marks}
                alwaysShowMarks
              />
            </PopoverBody>
          </PopoverContent>
        </Portal>
      </Popover>
    );
  }
);
DropDownToolHardnessPickerComponent.displayName = 'DropDownToolHardnessPickerComponent';

const SliderToolHardnessPickerComponent = memo(
  ({
    localValue,
    onChangeSlider,
    onChangeInput,
    onKeyDown,
    onPointerDownCapture,
    onPointerUpCapture,
    onBlur,
  }: ToolHardnessPickerComponentProps) => {
    return (
      <Flex w={SLIDER_VS_DROPDOWN_CONTAINER_WIDTH_THRESHOLD} gap={4}>
        <CompositeSlider
          w={200}
          h="unset"
          min={0}
          max={100}
          value={localValue}
          onChange={onChangeSlider}
          defaultValue={100}
          marks={marks}
          alwaysShowMarks
        />
        <CompositeNumberInput
          w={28}
          variant="outline"
          min={0}
          max={100}
          value={localValue}
          onChange={onChangeInput}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onPointerDownCapture={onPointerDownCapture}
          onPointerUpCapture={onPointerUpCapture}
          format={formatPct}
          defaultValue={100}
        />
      </Flex>
    );
  }
);
SliderToolHardnessPickerComponent.displayName = 'SliderToolHardnessPickerComponent';

const selectBrushHardness = createSelector(selectCanvasSettingsSlice, (settings) => settings.brushHardness);

export const ToolHardnessPicker = memo(() => {
  const ref = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();
  const brushHardness = useAppSelector(selectBrushHardness);
  const [localValue, setLocalValue] = useState(brushHardness);
  const [componentType, setComponentType] = useState<'slider' | 'dropdown' | null>(null);
  const isTypingRef = useRef(false);
  const inputPollRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width > SLIDER_VS_DROPDOWN_CONTAINER_WIDTH_THRESHOLD) {
          setComponentType('slider');
        } else {
          setComponentType('dropdown');
        }
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  const onChange = useCallback(
    (value: number) => {
      dispatch(settingsBrushHardnessChanged(clamp(Math.round(value), 0, 100)));
    },
    [dispatch]
  );

  const syncFromInputElement = useCallback(
    (input: HTMLInputElement | null) => {
      if (!input) {
        return;
      }
      const parsed = parseInputValue(input.value);
      if (Number.isNaN(parsed)) {
        return;
      }
      setLocalValue(parsed);
      onChange(parsed);
    },
    [onChange]
  );

  const stopPollingInput = useCallback(() => {
    if (inputPollRef.current !== null) {
      window.clearInterval(inputPollRef.current);
      inputPollRef.current = null;
    }
  }, []);

  const startPollingInput = useCallback(
    (container: HTMLElement | null) => {
      stopPollingInput();
      if (!container) {
        return;
      }
      inputPollRef.current = window.setInterval(() => {
        const input = container.querySelector('input');
        if (!input) {
          return;
        }
        const parsed = parseInputValue(input.value);
        if (Number.isNaN(parsed)) {
          return;
        }
        setLocalValue(parsed);
        if (!isTypingRef.current) {
          onChange(parsed);
        }
      }, 50);
    },
    [onChange, stopPollingInput]
  );

  const commitValue = useCallback(
    (value: number) => {
      if (isNaN(Number(value))) {
        onChange(DEFAULT_HARDNESS);
        setLocalValue(DEFAULT_HARDNESS);
      } else {
        onChange(value);
        setLocalValue(value);
      }
    },
    [onChange]
  );

  const onChangeSlider = useCallback(
    (value: number) => {
      onChange(value);
    },
    [onChange]
  );

  const onChangeInput = useCallback(
    (value: number) => {
      setLocalValue(value);
      if (!isNaN(value) && !isTypingRef.current) {
        onChange(value);
      }
    },
    [onChange]
  );

  const onBlur = useCallback(
    (event?: FocusEvent<HTMLElement>) => {
      const { parsed } = getInputValueFromEvent(event);
      commitValue(Number.isNaN(parsed) ? localValue : parsed);
      isTypingRef.current = false;
    },
    [commitValue, localValue]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const { parsed } = getInputValueFromEvent(e);
        commitValue(Number.isNaN(parsed) ? localValue : parsed);
        isTypingRef.current = false;
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        isTypingRef.current = false;
        const { input } = getInputValueFromEvent(e);
        window.requestAnimationFrame(() => {
          syncFromInputElement(input);
        });
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key.length === 1) {
        isTypingRef.current = true;
      }
    },
    [commitValue, localValue, syncFromInputElement]
  );

  const onPointerDownCapture = useCallback(
    (_e: PointerEvent<HTMLDivElement>) => {
      isTypingRef.current = false;
      const target = _e.target as HTMLElement | null;
      if (target && target.tagName !== 'INPUT') {
        startPollingInput(_e.currentTarget);
      } else {
        stopPollingInput();
      }
    },
    [startPollingInput, stopPollingInput]
  );

  const onPointerUpCapture = useCallback(() => {
    stopPollingInput();
  }, [stopPollingInput]);

  useEffect(() => {
    setLocalValue(brushHardness);
  }, [brushHardness]);

  useEffect(() => {
    return () => {
      stopPollingInput();
    };
  }, [stopPollingInput]);

  return (
    <Flex ref={ref} alignItems="center" flexGrow={1} flexShrink={1} minW={0}>
      {componentType === 'slider' && (
        <SliderToolHardnessPickerComponent
          localValue={localValue}
          onChangeSlider={onChangeSlider}
          onChangeInput={onChangeInput}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onPointerDownCapture={onPointerDownCapture}
          onPointerUpCapture={onPointerUpCapture}
        />
      )}
      {componentType === 'dropdown' && (
        <DropDownToolHardnessPickerComponent
          localValue={localValue}
          onChangeSlider={onChangeSlider}
          onChangeInput={onChangeInput}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onPointerDownCapture={onPointerDownCapture}
          onPointerUpCapture={onPointerUpCapture}
        />
      )}
    </Flex>
  );
});

ToolHardnessPicker.displayName = 'ToolHardnessPicker';
