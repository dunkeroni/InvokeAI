import { fireEvent, render, screen } from '@testing-library/react';
import { useStore } from '@nanostores/react';
import { atom } from 'nanostores';
import { BooleanCutout } from 'features/controlLayers/components/BooleanCutout';
import { useCanvasManager } from 'features/controlLayers/contexts/CanvasManagerProviderGate';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import type { CanvasEntityAdapterInpaintMaskLayer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityAdapterInpaintMaskLayer';
import type { CanvasEntityAdapterRasterLayer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityAdapterRasterLayer';
import type { CanvasBooleanCutoutModule } from 'features/controlLayers/konva/CanvasBooleanCutoutModule';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18n'; // Assuming your i18n setup is exported from 'i18n'

// Mock @invoke-ai/ui-library components
jest.mock('@invoke-ai/ui-library', () => ({
  ...jest.requireActual('@invoke-ai/ui-library'), // Import and retain default behavior
  Button: jest.fn(({ children, onClick, isDisabled }) => (
    <button data-testid="mock-button" onClick={onClick} disabled={isDisabled}>
      {children}
    </button>
  )),
  Menu: jest.fn(({ children }) => <div data-testid="mock-menu">{children}</div>),
  MenuButton: jest.fn(({ children }) => <div data-testid="mock-menubutton">{children}</div>),
  MenuList: jest.fn(({ children }) => <div data-testid="mock-menulist">{children}</div>),
  MenuItem: jest.fn(({ children, onClick, isDisabled, icon }) => (
    <button data-testid="mock-menuitem" onClick={onClick} disabled={isDisabled}>
      {/* eslint-disable-next-line i18next/no-literal-string -- Test-specific mock content */}
      {icon && <span data-testid="mock-menuitem-icon">icon</span>}
      {children}
    </button>
  )),
  // eslint-disable-next-line react/jsx-no-bind -- This is a Jest mock definition, not a component in rendering tree
  Slider: jest.fn(({ onChange, value, min, max }) => (
    <input
      type="range"
      data-testid="mock-slider"
      onChange={(e) => onChange(Number(e.target.value))}
      value={value}
      min={min}
      max={max}
    />
  )),
  Heading: jest.fn(({ children }) => <h1 data-testid="mock-heading">{children}</h1>),
  Text: jest.fn(({ children }) => <span data-testid="mock-text">{children}</span>),
  Flex: jest.fn(({ children }) => <div data-testid="mock-flex">{children}</div>),
  // Add any other components from the library that are used
}));

// Mock nanostores
jest.mock('@nanostores/react', () => ({
  useStore: jest.fn(),
}));

// Mock context
jest.mock('features/controlLayers/contexts/CanvasManagerProviderGate', () => ({
  useCanvasManager: jest.fn(),
}));

// Mock i18next
const mockT = jest.fn((key, fallback) => fallback || key);
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: mockT }),
}));

const mockPerformOperation = jest.fn();
const mockSaveAsInpaintMask = jest.fn();
const mockSetRange = jest.fn();
const mockSetIterations = jest.fn();

const mockBooleanCutoutModule = {
  $hasLastResult: atom(false),
  $range: atom(50),
  $iterations: atom(5),
  performOperation: mockPerformOperation,
  saveAsInpaintMask: mockSaveAsInpaintMask,
  setRange: mockSetRange,
  setIterations: mockSetIterations,
} as unknown as CanvasBooleanCutoutModule;

const mockInpaintMaskAdapter = {
  id: 'inpaint_mask_1',
  type: 'inpaint_mask_layer',
  booleanCutout: mockBooleanCutoutModule,
  // other necessary adapter props
} as unknown as CanvasEntityAdapterInpaintMaskLayer;

const mockRasterLayerAdapter = {
  id: 'raster_layer_1',
  type: 'raster_layer',
  // other necessary adapter props
} as unknown as CanvasEntityAdapterRasterLayer;

const mockCanvasManager = {
  stateApi: {
    $selectedLayers: atom([] as (CanvasEntityAdapterInpaintMaskLayer | CanvasEntityAdapterRasterLayer)[]),
    // other necessary stateApi props
  },
  // other necessary manager props
} as unknown as CanvasManager;

// Helper to wrap component in I18nextProvider
const renderWithProviders = (ui: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
};


describe('BooleanCutout Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useCanvasManager as jest.Mock).mockReturnValue(mockCanvasManager);
    (useStore as jest.Mock).mockImplementation((store, ...args) => {
      if (store === mockCanvasManager.stateApi.$selectedLayers) {
        return mockCanvasManager.stateApi.$selectedLayers.get();
      }
      if (store === mockBooleanCutoutModule.$hasLastResult) {
        return mockBooleanCutoutModule.$hasLastResult.get();
      }
      if (store === mockBooleanCutoutModule.$range) {
        return mockBooleanCutoutModule.$range.get();
      }
      if (store === mockBooleanCutoutModule.$iterations) {
        return mockBooleanCutoutModule.$iterations.get();
      }
      // Fallback for other stores if any
      const actualUseStore = jest.requireActual('@nanostores/react').useStore;
      return actualUseStore(store, ...args);
    });
  });

  test('renders nothing when no layer is selected', () => {
    mockCanvasManager.stateApi.$selectedLayers.set([]);
    renderWithProviders(<BooleanCutout />);
    expect(screen.queryByTestId('mock-heading')).not.toBeInTheDocument();
  });

  test('renders nothing when a non-InpaintMask layer is selected', () => {
    mockCanvasManager.stateApi.$selectedLayers.set([mockRasterLayerAdapter]);
    renderWithProviders(<BooleanCutout />);
    expect(screen.queryByTestId('mock-heading')).not.toBeInTheDocument();
  });

  test('renders button and menu when InpaintMask layer is selected', () => {
    mockCanvasManager.stateApi.$selectedLayers.set([mockInpaintMaskAdapter]);
    renderWithProviders(<BooleanCutout />);
    expect(screen.getByTestId('mock-heading')).toHaveTextContent('Boolean Cutout');
    expect(screen.getByTestId('mock-menubutton')).toHaveTextContent('Select Action');
  });

  describe('With InpaintMask Layer Selected', () => {
    beforeEach(() => {
      mockCanvasManager.stateApi.$selectedLayers.set([mockInpaintMaskAdapter]);
    });

    test('menu options are present', () => {
      renderWithProviders(<BooleanCutout />);
      const menuItems = screen.getAllByTestId('mock-menuitem');
      expect(menuItems).toHaveLength(5);
      expect(menuItems[0]).toHaveTextContent('Erase');
      expect(menuItems[1]).toHaveTextContent('Extract');
      expect(menuItems[2]).toHaveTextContent('Extract (Fit)');
      expect(menuItems[3]).toHaveTextContent('Erase (Fit)');
      expect(menuItems[4]).toHaveTextContent('Save As Inpaint Mask');
    });

    test('"Save As Inpaint Mask" button is disabled when no last result', () => {
      mockBooleanCutoutModule.$hasLastResult.set(false);
      renderWithProviders(<BooleanCutout />);
      const saveAsButton = screen.getAllByTestId('mock-menuitem')[4];
      expect(saveAsButton).toBeDisabled();
    });

    test('"Save As Inpaint Mask" button is enabled when there is a last result', () => {
      mockBooleanCutoutModule.$hasLastResult.set(true);
      renderWithProviders(<BooleanCutout />);
      const saveAsButton = screen.getAllByTestId('mock-menuitem')[4];
      expect(saveAsButton).not.toBeDisabled();
    });

    test('sliders are initially hidden', () => {
      renderWithProviders(<BooleanCutout />);
      expect(screen.queryByText('Range')).not.toBeInTheDocument();
      expect(screen.queryByText('Iterations')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-slider')).not.toBeInTheDocument();
    });

    test('sliders appear for "Extract (Fit)"', () => {
      renderWithProviders(<BooleanCutout />);
      const extractFitButton = screen.getAllByTestId('mock-menuitem')[2];
      fireEvent.click(extractFitButton);
      // Re-query for sliders after state update
      expect(screen.getByText('Range')).toBeInTheDocument();
      expect(screen.getByText('Iterations')).toBeInTheDocument();
      expect(screen.getAllByTestId('mock-slider')).toHaveLength(2);
    });

    test('sliders appear for "Erase (Fit)"', () => {
      renderWithProviders(<BooleanCutout />);
      const eraseFitButton = screen.getAllByTestId('mock-menuitem')[3];
      fireEvent.click(eraseFitButton);
      expect(screen.getByText('Range')).toBeInTheDocument();
      expect(screen.getByText('Iterations')).toBeInTheDocument();
      expect(screen.getAllByTestId('mock-slider')).toHaveLength(2);
    });

    test('sliders hide after selecting a non-fit option', () => {
      renderWithProviders(<BooleanCutout />);
      // First, select a "fit" option to show sliders
      const extractFitButton = screen.getAllByTestId('mock-menuitem')[2];
      fireEvent.click(extractFitButton);
      expect(screen.getAllByTestId('mock-slider')).toHaveLength(2); // Ensure they are visible

      // Then, select a non-"fit" option
      const extractButton = screen.getAllByTestId('mock-menuitem')[1];
      fireEvent.click(extractButton);
      expect(screen.queryByText('Range')).not.toBeInTheDocument();
      expect(screen.queryByText('Iterations')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-slider')).not.toBeInTheDocument();
    });

    test('calls performOperation on menu item click', () => {
      renderWithProviders(<BooleanCutout />);
      const eraseButton = screen.getAllByTestId('mock-menuitem')[0];
      fireEvent.click(eraseButton);
      expect(mockPerformOperation).toHaveBeenCalledWith('erase');

      const extractButton = screen.getAllByTestId('mock-menuitem')[1];
      fireEvent.click(extractButton);
      expect(mockPerformOperation).toHaveBeenCalledWith('extract');
    });

    test('calls saveAsInpaintMask on "Save As" click', () => {
      mockBooleanCutoutModule.$hasLastResult.set(true); // Enable button
      renderWithProviders(<BooleanCutout />);
      const saveAsButton = screen.getAllByTestId('mock-menuitem')[4];
      fireEvent.click(saveAsButton);
      expect(mockSaveAsInpaintMask).toHaveBeenCalled();
    });
    
    test('slider interaction calls setRange and setIterations', () => {
      renderWithProviders(<BooleanCutout />);
      const extractFitButton = screen.getAllByTestId('mock-menuitem')[2];
      fireEvent.click(extractFitButton); // Show sliders

      const sliders = screen.getAllByTestId('mock-slider') as HTMLInputElement[];
      fireEvent.change(sliders[0], { target: { value: '75' } });
      expect(mockSetRange).toHaveBeenCalledWith(75);

      fireEvent.change(sliders[1], { target: { value: '10' } });
      expect(mockSetIterations).toHaveBeenCalledWith(10);
    });
  });
});

// Minimal i18n setup for tests
if (!i18n.isInitialized) {
  i18n.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: {
        translation: {
          controlLayers: {
            booleanCutout: {
              title: 'Boolean Cutout',
              selectAction: 'Select Action',
              erase: 'Erase',
              extract: 'Extract',
              extractFit: 'Extract (Fit)',
              eraseFit: 'Erase (Fit)',
              saveAsInpaintMask: 'Save As Inpaint Mask',
              range: 'Range',
              iterations: 'Iterations',
            },
          },
        },
      },
    },
    interpolation: {
      escapeValue: false, // Not needed for react
    },
  });
}
