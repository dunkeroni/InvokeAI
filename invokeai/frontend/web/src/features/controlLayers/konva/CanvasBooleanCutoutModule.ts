import { withResultAsync } from 'common/util/result';
import type { CanvasEntityAdapterInpaintMaskLayer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityAdapterInpaintMaskLayer';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { CanvasModuleBase } from 'features/controlLayers/konva/CanvasModuleBase';
import { getPrefixedId } from 'features/controlLayers/konva/util';
import type { ImageObject } from 'features/controlLayers/store/types';
import { imageDTOToImageObject } from 'features/controlLayers/store/util';
import { toast } from 'features/toast/toast';
import Konva from 'konva';
import { atom, computed } from 'nanostores';
import cv from 'opencv-ts';
import type { Logger } from 'roarr';
import { serializeError } from 'serialize-error';
import type { ImageDTO } from 'services/api/types';
import { kompositor } from 'services/kompositor';

// Ensure cv is typed, even if it's dynamically loaded.
// Depending on tsconfig, `cv.Mat` might require `cv any` or proper types.
// For now, this assumes opencv-ts types are globally available or through the import.

export class CanvasBooleanCutoutModule extends CanvasModuleBase {
  readonly type = 'canvas_boolean_cutout';
  readonly id: string;
  readonly path: string[];
  readonly parent: CanvasEntityAdapterInpaintMaskLayer;
  readonly manager: CanvasManager;
  readonly log: Logger;

  // --- Settings for "fit" operations ---
  $range = atom<number>(50); // Default 1-100
  $iterations = atom<number>(5); // Default 2-15
  // --- End Settings ---

  $isProcessing = atom<boolean>(false);
  $lastResultImageObject = atom<ImageObject | null>(null);
  $hasLastResult = computed(this.$lastResultImageObject, (img) => img !== null);

  // Konva group for temporary visuals if needed (e.g., previews)
  konva: {
    group: Konva.Group;
  };
  KONVA_GROUP_NAME = `${this.type}:group`;

  constructor(parent: CanvasEntityAdapterInpaintMaskLayer) {
    super();
    this.id = getPrefixedId(this.type);
    this.parent = parent;
    this.manager = this.parent.manager;
    this.path = this.manager.buildPath(this);
    this.log = this.manager.buildLogger(this);

    this.konva = {
      group: new Konva.Group({ name: this.KONVA_GROUP_NAME }),
    };

    // Add the group to the parent layer if it needs to render something directly
    // For now, it's not rendering anything, but good to have the structure.
    // this.parent.konva.layer.add(this.konva.group);

    this.log.debug('Creating module');
  }

  /**
   * Sets the range parameter for "fit" operations.
   * @param range The range value (1-100).
   */
  setRange = (range: number) => {
    this.$range.set(Math.max(1, Math.min(100, range)));
    this.log.trace({ range }, 'Set range');
  };

  /**
   * Sets the iterations parameter for "fit" operations.
   * @param iterations The iterations value (2-15).
   */
  setIterations = (iterations: number) => {
    this.$iterations.set(Math.max(2, Math.min(15, iterations)));
    this.log.trace({ iterations }, 'Set iterations');
  };

  private loadImageElement(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }

  private async getCompositeRasterImage(): Promise<ImageObject | null> {
    // This one uses await, so it's fine.
    this.log.debug('Getting composite raster image');
    const visibleRasterLayers = this.manager.stateApi
      .getEntities<CanvasEntityAdapterRasterLayer>('raster_layer')
      .filter((l) => l.state.isVisible && !this.manager.stateApi.getIsHidden(l.id));

    if (visibleRasterLayers.length === 0) {
      this.log.warn('No visible raster layers to composite');
      toast({
        status: 'warning',
        title: t('controlLayers.booleanCutout.noVisibleLayers', 'No visible raster layers for operation.'),
      });
      return null;
    }

    const canvasImageDTOResult = await withResultAsync(this.manager.compositor.export());
    if (canvasImageDTOResult.isErr()) {
      this.log.error(
        { error: serializeError(canvasImageDTOResult.error) },
        'Failed to get canvas image DTO for composite'
      );
      toast({
        status: 'error',
        title: t('controlLayers.booleanCutout.compositeFailed', 'Failed to create composite image.'),
      });
      return null;
    }
    return imageDTOToImageObject(canvasImageDTOResult.value);
  }

  private getInpaintMaskImage(): ImageObject | null {
    // Removed async, returns directly or via toast
    this.log.debug('Getting InpaintMask layer image');
    const { t } = { t: (key: string, fallback: string) => fallback }; // Minimal t for now
    const maskLayer = this.parent;
    if (maskLayer.state.objects.length === 0 || maskLayer.state.objects[0]?.type !== 'image_object') {
      this.log.warn('InpaintMask layer has no image object or is not an image object.');
      toast({
        status: 'warning',
        title: t('controlLayers.booleanCutout.noInpaintMaskImage', 'InpaintMask layer has no image.'),
      });
      return null;
    }
    return maskLayer.state.objects[0] as ImageObject;
  }

  private async matToImageDTO(mat: cv.Mat, originalNameBase: string): Promise<ImageDTO | null> {
    if (mat.empty() || mat.channels() !== 4) {
      this.log.error(
        { channels: mat.channels(), isEmpty: mat.empty() },
        'Invalid Mat for matToImageDTO: must be RGBA and not empty.'
      );
      toast({
        title: t('controlLayers.booleanCutout.imageConversionErrorTitle', 'Image Conversion Error'),
        description: t(
          'controlLayers.booleanCutout.matConversionErrorDetail',
          'Cannot process empty or non-RGBA image.'
        ),
        status: 'error',
      });
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = mat.cols;
    canvas.height = mat.rows;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.log.error('Failed to get 2D context from canvas for matToImageDTO.');
      toast({
        title: t('controlLayers.booleanCutout.imageConversionErrorTitle', 'Image Conversion Error'),
        description: t('controlLayers.booleanCutout.canvasContextErrorDetail', 'Cannot access canvas context.'),
        status: 'error',
      });
      return null;
    }

    const imageData = new ImageData(new Uint8ClampedArray(mat.data), mat.cols, mat.rows);
    ctx.putImageData(imageData, 0, 0);

    if (!this.manager.stateApi.createImageDTOFromCanvas) {
      this.log.error('stateApi.createImageDTOFromCanvas is not available for Mat to ImageDTO conversion.');
      toast({
        title: t('controlLayers.booleanCutout.imageConversionErrorTitle', 'Image Conversion Error'),
        description: t('controlLayers.booleanCutout.cannotProcessResult', 'Cannot process image result.'),
        status: 'error',
      });
      return null;
    }
    try {
      const newName = getPrefixedId(`${this.parent.id}_${originalNameBase}_grabcut`);
      // Ensure the board_id is correctly passed if available
      const boardId = this.parent.state.boardId ?? null;
      return await this.manager.stateApi.createImageDTOFromCanvas(canvas, newName, boardId);
    } catch (error) {
      this.log.error({ error: serializeError(error) }, 'Failed during createImageDTOFromCanvas');
      toast({
        title: t('controlLayers.booleanCutout.imageConversionErrorTitle', 'Image Conversion Error'),
        description: t('controlLayers.booleanCutout.failedToSaveProcessed', 'Failed to save processed image.'),
        status: 'error',
      });
      return null;
    }
  }
  /**
   * Performs the boolean operation.
   * @param operationType The type of operation: "erase", "extract", "extract (fit)", "erase (fit)".
   */
  async performOperation(operationType: 'erase' | 'extract' | 'extract (fit)' | 'erase (fit)') {
    const { t } = { t: (key: string, fallback: string) => fallback }; // Minimal t for now

    if (this.$isProcessing.get()) {
      this.log.warn('Already processing');
      toast({
        status: 'warning',
        title: t('controlLayers.booleanCutout.opInProgress', 'Operation already in progress.'),
      });
      return;
    }
    this.$isProcessing.set(true);
    this.$lastResultImageObject.set(null);
    this.log.info({ operationType }, 'Performing boolean operation');

    const maskImageObject = this.getInpaintMaskImage(); // Removed await
    if (!maskImageObject) {
      this.$isProcessing.set(false);
      this.log.error('Failed to get InpaintMask image object.');
      return;
    }

    const compositeRasterImageObject = await this.getCompositeRasterImage();
    if (!compositeRasterImageObject) {
      this.$isProcessing.set(false);
      this.log.error('Failed to get composite raster image object.');
      return;
    }

    const operationBbox = this.parent.transformer.getRect();
    let resultImageDTO: ImageDTO | null = null;

    // OpenCV related Mats - ensure they are declared for the finally block
    let srcMat: cv.Mat | undefined;
    let inputMaskCvMat: cv.Mat | undefined;
    let grayMaskCvMat: cv.Mat | undefined;
    let grabCutCvMask: cv.Mat | undefined;
    let erodedCvMask: cv.Mat | undefined;
    let dilatedCvMask: cv.Mat | undefined;
    let cvKernel: cv.Mat | undefined;
    let bgdModel: cv.Mat | undefined;
    let fgdModel: cv.Mat | undefined;
    let finalAlphaCvMask: cv.Mat | undefined;
    let resultRgbaCvMat: cv.Mat | undefined;
    let tempVec: cv.MatVector | undefined; // For split/merge operations

    try {
      if (operationType === 'erase (fit)' || operationType === 'extract (fit)') {
        if (typeof cv === 'undefined' || typeof cv.imread !== 'function' || typeof cv.Mat === 'undefined') {
          this.log.error('OpenCV is not loaded, cv.imread, or cv.Mat is not available.');
          toast({
            status: 'error',
            title: t('controlLayers.booleanCutout.opencvErrorTitle', 'OpenCV Error'),
            description: t(
              'controlLayers.booleanCutout.opencvLoadError',
              'OpenCV library failed to load or is invalid.'
            ),
          });
          this.$isProcessing.set(false);
          return;
        }

        this.log.debug(
          { operationType, range: this.$range.get(), iterations: this.$iterations.get() },
          'Performing "fit" operation with OpenCV'
        );

        const [compositeImgElement, maskImgElement] = await Promise.all([
          this.loadImageElement(compositeRasterImageObject.image.image_url),
          this.loadImageElement(maskImageObject.image.image_url),
        ]);

        srcMat = cv.imread(compositeImgElement);
        if (srcMat.empty()) {
          throw new Error('OpenCV: Failed to load source image.');
        }
        // Ensure source is RGBA for alpha channel manipulation later
        if (srcMat.channels() === 3) {
          cv.cvtColor(srcMat, srcMat, cv.COLOR_BGR2RGBA);
        } else if (srcMat.channels() === 1) {
          cv.cvtColor(srcMat, srcMat, cv.COLOR_GRAY2RGBA);
        } else if (srcMat.channels() !== 4) {
          throw new Error('OpenCV: Source image has unsupported channel count.');
        }

        inputMaskCvMat = cv.imread(maskImgElement);
        if (inputMaskCvMat.empty()) {
          throw new Error('OpenCV: Failed to load mask image.');
        }
        grayMaskCvMat = new cv.Mat(inputMaskCvMat.rows, inputMaskCvMat.cols, cv.CV_8UC1);
        // Convert input mask to grayscale
        if (inputMaskCvMat.channels() === 4) {
          cv.cvtColor(inputMaskCvMat, grayMaskCvMat, cv.COLOR_RGBA2GRAY);
        } else if (inputMaskCvMat.channels() === 3) {
          cv.cvtColor(inputMaskCvMat, grayMaskCvMat, cv.COLOR_BGR2GRAY);
        } else if (inputMaskCvMat.channels() === 1) {
          inputMaskCvMat.copyTo(grayMaskCvMat);
        } else {
          throw new Error('OpenCV: Mask image has unsupported channel count.');
        }
        // Binarize the grayscale mask
        cv.threshold(grayMaskCvMat, grayMaskCvMat, 1, 255, cv.THRESH_BINARY);

        // Prepare grabCut mask (CV_8UC1 required by grabCut)
        grabCutCvMask = new cv.Mat(srcMat.rows, srcMat.cols, cv.CV_8UC1);
        grabCutCvMask.setTo(new cv.Scalar(cv.GC_PR_BGD)); // Default to probable background

        const rangeValue = this.$range.get(); // UI: 0-100
        // Scale range to an odd kernel size for erosion/dilation. Heuristic:
        const minDim = Math.min(srcMat.rows, srcMat.cols);
        let kSize = Math.round((rangeValue / 100) * Math.min(minDim * 0.1, 20)) + 1; // e.g. max 10% of minDim or 20px, then +1
        kSize = Math.max(1, kSize % 2 === 0 ? kSize + 1 : kSize); // Ensure odd and at least 1
        this.log.debug({ kSizeForFitOp: kSize }, 'Calculated kernel size for erosion/dilation');
        cvKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kSize, kSize));

        erodedCvMask = new cv.Mat();
        cv.erode(grayMaskCvMat, erodedCvMask, cvKernel);

        dilatedCvMask = new cv.Mat();
        cv.dilate(grayMaskCvMat, dilatedCvMask, cvKernel);

        // Define definite background, definite foreground, and probable foreground
        for (let r = 0; r < grabCutCvMask.rows; r++) {
          for (let c = 0; c < grabCutCvMask.cols; c++) {
            if (dilatedCvMask.ucharPtr(r, c)[0] === 0) {
              grabCutCvMask.ucharPtr(r, c)[0] = cv.GC_BGD; // Definite Background (outside dilated original mask)
            } else if (erodedCvMask.ucharPtr(r, c)[0] > 0) {
              grabCutCvMask.ucharPtr(r, c)[0] = cv.GC_FGD; // Definite Foreground (inside eroded original mask)
            } else if (grayMaskCvMat.ucharPtr(r, c)[0] > 0) {
              grabCutCvMask.ucharPtr(r, c)[0] = cv.GC_PR_FGD; // Probable Foreground (in original mask but not eroded area)
            }
            // Else: remains cv.GC_PR_BGD (pixels not in original mask, between dilated and original)
          }
        }

        bgdModel = new cv.Mat(); // Background model
        fgdModel = new cv.Mat(); // Foreground model
        // ROI for grabCut can be the whole image if the mask guides it well
        const rectForGrabCut = new cv.Rect(0, 0, srcMat.cols, srcMat.rows);

        cv.grabCut(
          srcMat,
          grabCutCvMask,
          rectForGrabCut,
          bgdModel,
          fgdModel,
          this.$iterations.get(),
          cv.GC_INIT_WITH_MASK
        );

        // Create the final alpha mask from grabCut output
        finalAlphaCvMask = new cv.Mat(srcMat.rows, srcMat.cols, cv.CV_8UC1, new cv.Scalar(0)); // Initialize to transparent
        for (let r = 0; r < grabCutCvMask.rows; r++) {
          for (let c = 0; c < grabCutCvMask.cols; c++) {
            const gcVal = grabCutCvMask.ucharPtr(r, c)[0];
            if (operationType === 'extract (fit)') {
              // Keep foreground pixels
              if (gcVal === cv.GC_FGD || gcVal === cv.GC_PR_FGD) {
                finalAlphaCvMask.ucharPtr(r, c)[0] = 255; // Opaque
              }
            } else {
              // 'erase (fit)'
              // Keep background pixels (erase foreground)
              if (gcVal === cv.GC_BGD || gcVal === cv.GC_PR_BGD) {
                finalAlphaCvMask.ucharPtr(r, c)[0] = 255; // Opaque
              }
            }
          }
        }

        // Apply the finalAlphaCvMask to the original source image's alpha channel
        // srcMat is already RGBA
        tempVec = new cv.MatVector();
        cv.split(srcMat, tempVec); // Split into R, G, B, A channels
        tempVec.set(3, finalAlphaCvMask); // Replace original alpha channel with the new mask

        resultRgbaCvMat = new cv.Mat(); // Create a new Mat for the merged result
        cv.merge(tempVec, resultRgbaCvMat); // Merge back into resultRgbaCvMat

        resultImageDTO = await this.matToImageDTO(
          resultRgbaCvMat,
          compositeRasterImageObject.image.image_name.split('.')[0] ?? 'image'
        );
        if (!resultImageDTO) {
          throw new Error('OpenCV: Failed to convert processed Mat to ImageDTO.');
        }
      } else {
        // Basic erase/extract (non-fit operations using Kompositor)
        this.log.debug({ operationType }, 'Using Kompositor for basic operation');
        const kompositeResult = await withResultAsync(
          kompositor.runGraphAndReturnImageOutput({
            graph: {
              nodes: {
                boolean_op_node: {
                  id: 'boolean_op_node',
                  type: 'boolean_op', // This node type is hypothetical
                  image_a: { image_name: compositeRasterImageObject.image.image_name },
                  image_b: { image_name: maskImageObject.image.image_name },
                  operation: operationType,
                  bbox: operationBbox,
                },
              },
              edges: [],
            },
            outputNodeId: 'boolean_op_node',
          })
        );

        if (kompositeResult.isErr()) {
          this.log.error(
            { error: serializeError(kompositeResult.error), operationType },
            'Kompositor boolean operation failed'
          );
          toast({
            status: 'error',
            title: t('controlLayers.booleanCutout.kompositorOpFailed', `Boolean operation (${operationType}) failed.`),
          });
          this.$isProcessing.set(false);
          return;
        }
        resultImageDTO = kompositeResult.value;
      }

      if (resultImageDTO) {
        const newImageObject = imageDTOToImageObject(resultImageDTO);
        this.$lastResultImageObject.set(newImageObject);
        this.log.debug({ operationType }, 'Boolean operation successful, adding new raster layer');
        this.manager.stateApi.addRasterLayer({
          imageObject: newImageObject,
          position: { x: operationBbox.x, y: operationBbox.y },
          isSelected: true,
        });
        toast({
          status: 'success',
          title: t('controlLayers.booleanCutout.opComplete', `"${operationType}" operation complete.`),
        });
      }
    } catch (error) {
      this.$lastResultImageObject.set(null);
      this.log.error({ error: serializeError(error), operationType }, 'Error during boolean operation');
      toast({
        status: 'error',
        title: t('controlLayers.booleanCutout.unexpectedError', 'An unexpected error occurred during operation.'),
      });
    } finally {
      // Ensure all OpenCV Mats are deleted
      srcMat?.delete();
      inputMaskCvMat?.delete();
      grayMaskCvMat?.delete();
      grabCutCvMask?.delete();
      erodedCvMask?.delete();
      dilatedCvMask?.delete();
      cvKernel?.delete();
      bgdModel?.delete();
      fgdModel?.delete();
      finalAlphaCvMask?.delete();
      resultRgbaCvMat?.delete();
      tempVec?.delete();
      this.$isProcessing.set(false);
    }
  }

  start = () => {
    // This module might not have an explicit "start" state like SegmentAnything,
    // as operations are more direct.
    // However, if we need to prepare the UI or select the module, this is where it would go.
    this.log.debug('Module interaction started (e.g., UI shown)');
    // For now, we don't change the global "segmenting adapter" as this isn't an interactive tool in the same way.
  };

  cancel = () => {
    // If there's any ongoing processing, abort it.
    if (this.$isProcessing.get()) {
      // TODO: Implement abort controller if Kompositor/OpenCV calls support it.
      this.log.warn('Cancellation of ongoing processing is not fully implemented.');
    }
    this.log.debug('Module interaction canceled (e.g., UI hidden)');
    this.$isProcessing.set(false); // Reset processing state
  };

  reset = () => {
    // Reset any specific state if needed, e.g., if we had previews or intermediate results.
    this.log.debug('Module reset');
    this.$range.set(50);
    this.$iterations.set(5);
    this.$lastResultImageObject.set(null);
  };

  /**
   * Saves the last operation's result as a new InpaintMask layer.
   */
  saveAsInpaintMask = () => {
    const { t } = { t: (key: string, fallback: string) => fallback }; // Minimal t for now
    const imageToSave = this.$lastResultImageObject.get();
    if (!imageToSave) {
      this.log.warn('No last result image to save as InpaintMask');
      toast({ status: 'warning', title: t('controlLayers.booleanCutout.noResultToSave', 'No result to save.') });
      return;
    }

    // The new InpaintMask should ideally be positioned relative to where the operation happened.
    // For now, let's use the original InpaintMask's bounding box origin.
    // A more precise position might be the bounding box of the actual output raster layer if it exists
    // or the operationBbox used during its creation.
    // If performOperation stores the operationBbox, that would be ideal.
    // For now, we'll estimate using the parent's bbox.
    const parentBbox = this.parent.transformer.getRect();

    this.log.debug({ imageName: imageToSave.image.image_name }, 'Saving result as InpaintMask');

    try {
      this.manager.stateApi.addInpaintMask({
        imageObject: imageToSave,
        position: { x: parentBbox.x, y: parentBbox.y },
        isSelected: true,
      });
      toast({
        status: 'success',
        title: t('controlLayers.booleanCutout.saveAsInpaintMaskSuccess', 'Result saved as InpaintMask.'),
      });
      // Optionally, clear the last result after saving to prevent re-saving the same data
      // this.$lastResultImageObject.set(null);
    } catch (error) {
      this.log.error({ error: serializeError(error) }, 'Failed to save as InpaintMask');
      toast({
        status: 'error',
        title: t('controlLayers.booleanCutout.saveAsInpaintMaskFailed', 'Failed to save as InpaintMask.'),
      });
    }
  };

  destroy = () => {
    this.log.debug('Destroying module');
    this.konva.group.destroy();
    // Any other cleanup
  };

  repr = () => {
    return {
      id: this.id,
      type: this.type,
      path: this.path,
      parent: this.parent.id,
      range: this.$range.get(),
      iterations: this.$iterations.get(),
      isProcessing: this.$isProcessing.get(),
      hasLastResult: this.$hasLastResult.get(),
      lastResultImageName: this.$lastResultImageObject.get()?.image.image_name ?? null,
    };
  };
}
