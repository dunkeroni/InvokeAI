import { atom } from 'nanostores';
import { CanvasBooleanCutoutModule } from 'features/controlLayers/konva/CanvasBooleanCutoutModule';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import type { CanvasEntityAdapterInpaintMaskLayer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityAdapterInpaintMaskLayer';
import type { ImageObject, Rect } from 'features/controlLayers/store/types';
import type { ImageDTO } from 'services/api/types';
import { imageDTOToImageObject } from 'features/controlLayers/store/util';
import { kompositor } from 'services/kompositor';
import { toast } from 'features/toast/toast';
import { getPrefixedId } from 'features/controlLayers/konva/util';
import { withResultAsync } from 'common/util/result';

// #region OpenCV Mock
const mockMatDeleteSpies: jest.Mock[] = [];
const mockMatVectorDeleteSpies: jest.Mock[] = [];

// Define a type for our mock Mat instance for better type safety in tests
type MockCvMat = {
  rows: number;
  cols: number;
  channels: jest.Mock<number, []>;
  type: jest.Mock<number, []>;
  data: Uint8Array;
  delete: jest.Mock<void, []>;
  empty: jest.Mock<boolean, []>;
  clone: jest.Mock<MockCvMat, []>;
  copyTo: jest.Mock<void, [MockCvMat]>;
  setTo: jest.Mock<void, [unknown]>; // `unknown` as Scalar can be an array or object
  ucharPtr: jest.Mock<Uint8Array, [number, number]>;
  release: jest.Mock<void, []>;
};

const createMockMat = (rows = 100, cols = 100, channels = 4, type = global.cv?.CV_8UC4 || 24): MockCvMat => {
  const deleteSpy = jest.fn();
  mockMatDeleteSpies.push(deleteSpy);
  const dataArray = new Uint8Array(rows * cols * channels);
  dataArray.fill(128); // Default pixel value

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mocking a complex external library structure
  const mockMat: MockCvMat = {
    rows,
    cols,
    channels: jest.fn().mockReturnValue(channels),
    type: jest.fn().mockReturnValue(type),
    data: dataArray,
    delete: deleteSpy,
    empty: jest.fn().mockReturnValue(false),
    clone: jest.fn(function(this: MockCvMat) { // Use `this` with explicit type
      return createMockMat(this.rows, this.cols, this.channels());
    }),
    copyTo: jest.fn(),
    setTo: jest.fn(),
    ucharPtr: jest.fn((r: number, c: number) => {
        const baseIndex = (r * cols + c) * channels;
        return dataArray.subarray(baseIndex, baseIndex + channels);
    }),
    release: jest.fn(), // Alias for delete sometimes
  };
  return mockMat;
};

const createMockMatVector = () => {
  const deleteSpy = jest.fn();
  mockMatVectorDeleteSpies.push(deleteSpy);
  const mats: MockCvMat[] = [];
  return {
    delete: deleteSpy,
    push_back: jest.fn((mat: MockCvMat) => mats.push(mat)),
    get: jest.fn((index: number) => mats[index] || createMockMat()),
    set: jest.fn((index: number, mat: MockCvMat) => { mats[index] = mat; }),
    size: jest.fn(() => mats.length),
  };
};

// global.cv is a mock for the opencv-ts library.
// It's cast to `any` because providing a full type definition for a complex external library
// within a test file is impractical. The focus is on mocking specific functions and properties.
global.cv = {
  imread: jest.fn(() => createMockMat()),
  Mat: jest.fn(() => createMockMat()),
  MatVector: jest.fn(() => createMockMatVector()),
  CV_8UC1: 0, CV_8UC4: 24, CV_8U: 0,
  GC_INIT_WITH_MASK: 1, GC_BGD: 0, GC_FGD: 1, GC_PR_BGD: 2, GC_PR_FGD: 3,
  INTER_LINEAR: 1, THRESH_BINARY: 0, THRESH_OTSU: 8,
  COLOR_RGBA2GRAY: 7, COLOR_BGR2RGBA: 4, COLOR_GRAY2RGBA: 8, COLOR_BGRA2GRAY: 10, COLOR_RGB2GRAY:6,
  MORPH_RECT: 0, MORPH_ELLIPSE: 2,
  Size: jest.fn((w, h) => ({ width: w, height: h })),
  Point: jest.fn((x, y) => ({ x, y })),
  Scalar: jest.fn((v0, v1, v2, v3) => [v0, v1, v2, v3]),
  getStructuringElement: jest.fn(() => createMockMat(3,3,1)),
  erode: jest.fn(),
  dilate: jest.fn(),
  grabCut: jest.fn(),
  split: jest.fn((srcMat, destVec) => {
    const channels = srcMat.channels();
    for(let i = 0; i < channels; ++i) {
      destVec.push_back(createMockMat(srcMat.rows, srcMat.cols, 1));
    }
  }),
  merge: jest.fn(),
  threshold: jest.fn(),
  cvtColor: jest.fn(),
  imshow: jest.fn(),
  Rect: jest.fn((x,y,w,h) => ({x,y,width:w,height:h})),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;
// #endregion OpenCV Mock

jest.mock('features/controlLayers/konva/CanvasModuleBase', () => ({ CanvasModuleBase: class {} }));
jest.mock('features/controlLayers/store/util', () => ({
  imageDTOToImageObject: jest.fn((dto) => ({
    image: dto, boundingBox: { x: 0, y: 0, width: dto.width, height: dto.height },
  })),
}));
jest.mock('services/kompositor', () => ({ kompositor: { runGraphAndReturnImageOutput: jest.fn(), export: jest.fn() } }));
jest.mock('features/toast/toast', () => ({ toast: jest.fn() }));
jest.mock('features/controlLayers/konva/util', () => ({
  ...jest.requireActual('features/controlLayers/konva/util'),
  getPrefixedId: jest.fn((prefix) => `${prefix}_mock_id`),
}));
jest.mock('common/util/result', () => ({
  withResultAsync: jest.fn(async (promise) => {
    try { const value = await promise; return { isOk: true, isErr: false, value }; }
    catch (error) { return { isOk: false, isErr: true, error }; }
  }),
}));

const mockImageDTO = (id: string, width = 100, height = 100): ImageDTO => ({
  image_name: `${id}_image_name`, image_url: `http://localhost/images/${id}.png`,
  thumbnail_url: `http://localhost/thumbnails/${id}.png`, width, height, created_at: '',
  updated_at: '', deleted_at: null, image_origin: 'internal', board_id: null,
  is_intermediate: false, session_id: null, starred: false, has_workflow: false,
});

describe('CanvasBooleanCutoutModule', () => {
  let module: CanvasBooleanCutoutModule;
  let mockParentAdapter: CanvasEntityAdapterInpaintMaskLayer;
  let mockCanvasManager: CanvasManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMatDeleteSpies.length = 0;
    mockMatVectorDeleteSpies.length = 0;

    mockCanvasManager = {
      stateApi: {
        addRasterLayer: jest.fn(), addInpaintMask: jest.fn(),
        getEntities: jest.fn().mockReturnValue([]), getIsHidden: jest.fn().mockReturnValue(false),
        createImageDTOFromCanvas: jest.fn().mockImplementation((_canvas, namePrefix) =>
          Promise.resolve(mockImageDTO(`${namePrefix}_result`))
        ),
      },
      compositor: { export: jest.fn().mockResolvedValue(mockImageDTO('composite')) },
      buildLogger: jest.fn().mockReturnValue({
        debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), trace: jest.fn(),
      }),
    } as unknown as CanvasManager;

    mockParentAdapter = {
      id: 'parent_inpaint_mask_1', manager: mockCanvasManager,
      state: {
        objects: [{ type: 'image_object', image: mockImageDTO('mask_image'), boundingBox: { x:0, y:0, width: 100, height: 100} } as ImageObject],
        position: { x: 10, y: 10 }, boardId: 'board_123',
      },
      transformer: { getRect: jest.fn().mockReturnValue({ x: 10, y: 10, width: 100, height: 100 } as Rect) },
    } as unknown as CanvasEntityAdapterInpaintMaskLayer;

    module = new CanvasBooleanCutoutModule(mockParentAdapter);

    // Spy on private/protected methods for testing purposes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(module as any, 'getInpaintMaskImage').mockResolvedValue(mockParentAdapter.state.objects[0] as ImageObject);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(module as any, 'getCompositeRasterImage').mockResolvedValue(imageDTOToImageObject(mockImageDTO('composite_raster')));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(module as any, 'loadImageElement').mockImplementation(async (url: string) => {
      const mockImg = { src: url, width: 100, height: 100, decode: jest.fn().mockResolvedValue(undefined), onload: () => {}, onerror: () => {} } as unknown as HTMLImageElement;
      setTimeout(() => mockImg.onload(), 0); return mockImg;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(module as any, 'matToImageDTO').mockImplementation((_mat, nameBase) => Promise.resolve(mockImageDTO(`${nameBase}_processed_dto`)));
  });

  afterEach(() => {
    mockMatDeleteSpies.forEach(spy => expect(spy).toHaveBeenCalled());
    mockMatVectorDeleteSpies.forEach(spy => expect(spy).toHaveBeenCalled());
  });

  describe('performOperation', () => {
    const nonFitTestCases: Array<'erase' | 'extract'> = ['erase', 'extract'];
    nonFitTestCases.forEach((opType) => {
      test(`${opType} operation (Kompositor) success`, async () => {
        const mockResultDTO = mockImageDTO('result_image_kompositor');
        (kompositor.runGraphAndReturnImageOutput as jest.Mock).mockResolvedValue(mockResultDTO);
        await module.performOperation(opType);
        expect(kompositor.runGraphAndReturnImageOutput).toHaveBeenCalled();
        expect(mockCanvasManager.stateApi.addRasterLayer).toHaveBeenCalledWith(
          expect.objectContaining({ imageObject: imageDTOToImageObject(mockResultDTO) })
        );
        expect(module.$lastResultImageObject.get()).toEqual(imageDTOToImageObject(mockResultDTO));
        // eslint-disable-next-line i18next/no-literal-string
        expect(toast).toHaveBeenCalledWith({ status: 'success', title: `"${opType}" operation complete.` });
      });
    });

    const fitTestCases: Array<'extract (fit)' | 'erase (fit)'> = ['extract (fit)', 'erase (fit)'];
    fitTestCases.forEach((opType) => {
      describe(`${opType} operation (OpenCV)`, () => {
        test('success path', async () => {
          module.setRange(50); module.setIterations(5);
          (global.cv.grabCut as jest.Mock).mockImplementation((_src, mask, _rect, _bgd, _fgd, _iter, _mode) => {
            for(let i=0; i < mask.rows * mask.cols; ++i) {
                mask.data[i] = (i % 2 === 0) ? global.cv.GC_FGD : global.cv.GC_BGD;
            }
          });
          
          await module.performOperation(opType);

          expect(global.cv.imread).toHaveBeenCalledTimes(2);
          expect(global.cv.cvtColor).toHaveBeenCalled();
          expect(global.cv.threshold).toHaveBeenCalled();
          expect(global.cv.getStructuringElement).toHaveBeenCalled();
          expect(global.cv.erode).toHaveBeenCalled();
          expect(global.cv.dilate).toHaveBeenCalled();
          expect(global.cv.grabCut).toHaveBeenCalledWith(
            expect.anything(), expect.anything(), expect.anything(),
            expect.anything(), expect.anything(), 5, global.cv.GC_INIT_WITH_MASK
          );
          expect(global.cv.split).toHaveBeenCalled();
          expect(global.cv.merge).toHaveBeenCalled();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          expect((module as any).matToImageDTO).toHaveBeenCalled();
          expect(mockCanvasManager.stateApi.addRasterLayer).toHaveBeenCalled();
          expect(module.$lastResultImageObject.get()).not.toBeNull();
          // eslint-disable-next-line i18next/no-literal-string
          expect(toast).toHaveBeenCalledWith({ status: 'success', title: `"${opType}" operation complete.` });
        });
        
        test('OpenCV not loaded error', async () => {
          const originalCvImread = global.cv.imread;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          global.cv.imread = undefined as any; 
          
          await module.performOperation(opType);
          
          // eslint-disable-next-line i18next/no-literal-string
          expect(toast).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', title: 'OpenCV Error' }));
          expect(mockCanvasManager.stateApi.addRasterLayer).not.toHaveBeenCalled();
          global.cv.imread = originalCvImread;
        });

        test('cv.imread returns empty Mat for source', async () => {
          (global.cv.imread as jest.Mock).mockImplementationOnce(() => {
            const mat = createMockMat();
            (mat.empty as jest.Mock).mockReturnValue(true);
            return mat;
          });
          await module.performOperation(opType);
          // eslint-disable-next-line i18next/no-literal-string
          expect(toast).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', title: 'An unexpected error occurred during operation.' }));
          expect(module.log.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'OpenCV: Failed to load source image.' }), expect.stringContaining("Error during boolean operation"));
        });

         test('cv.imread returns empty Mat for mask', async () => {
          (global.cv.imread as jest.Mock)
            .mockImplementationOnce(() => createMockMat()) 
            .mockImplementationOnce(() => { 
                const mat = createMockMat();
                (mat.empty as jest.Mock).mockReturnValue(true);
                return mat;
            });
          await module.performOperation(opType);
          // eslint-disable-next-line i18next/no-literal-string
          expect(toast).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', title: 'An unexpected error occurred during operation.' }));
           expect(module.log.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'OpenCV: Failed to load mask image.' }), expect.stringContaining("Error during boolean operation"));
        });
      });
    });

     test('fails if getInpaintMaskImage returns null (fit op)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (module as any).getInpaintMaskImage.mockResolvedValue(null);
      await module.performOperation('extract (fit)');
      expect(module.log.error).toHaveBeenCalledWith('Failed to get InpaintMask image object.');
      expect(global.cv.grabCut).not.toHaveBeenCalled();
    });

    test('fails if getCompositeRasterImage returns null (fit op)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (module as any).getCompositeRasterImage.mockResolvedValue(null);
      await module.performOperation('extract (fit)');
      expect(module.log.error).toHaveBeenCalledWith('Failed to get composite raster image object.');
      expect(global.cv.grabCut).not.toHaveBeenCalled();
    });
  });

  describe('saveAsInpaintMask', () => {
    test('saves last result if available', () => {
      const mockResultImageObj = imageDTOToImageObject(mockImageDTO('last_op_result'));
      module.$lastResultImageObject.set(mockResultImageObj);
      module.saveAsInpaintMask();
      expect(mockCanvasManager.stateApi.addInpaintMask).toHaveBeenCalledWith(
        expect.objectContaining({ imageObject: mockResultImageObj, position: { x: 10, y: 10 }, isSelected: true, })
      );
      // eslint-disable-next-line i18next/no-literal-string
      expect(toast).toHaveBeenCalledWith({ status: 'success', title: 'Result saved as InpaintMask.' });
    });

     test('does nothing and warns if no last result', () => {
      module.$lastResultImageObject.set(null);
      module.saveAsInpaintMask();
      expect(mockCanvasManager.stateApi.addInpaintMask).not.toHaveBeenCalled();
      // eslint-disable-next-line i18next/no-literal-string
      expect(toast).toHaveBeenCalledWith({ status: 'warning', title: 'No result to save.' });
    });
  });

  describe('setRange and setIterations', () => {
    test('setRange clamps values', () => {
      module.setRange(0); expect(module.$range.get()).toBe(1);
      module.setRange(101); expect(module.$range.get()).toBe(100);
    });
    test('setIterations clamps values', () => {
      module.setIterations(1); expect(module.$iterations.get()).toBe(2);
      module.setIterations(16); expect(module.$iterations.get()).toBe(15);
    });
  });
  
  describe('reset', () => {
    test('resets state', () => {
      module.$range.set(10); module.$iterations.set(3);
      module.$lastResultImageObject.set(imageDTOToImageObject(mockImageDTO('test')));
      module.reset();
      expect(module.$range.get()).toBe(50); expect(module.$iterations.get()).toBe(5);
      expect(module.$lastResultImageObject.get()).toBeNull();
    });
  });
});
