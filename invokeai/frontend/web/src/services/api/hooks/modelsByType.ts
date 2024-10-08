import { EMPTY_ARRAY } from 'app/store/constants';
import { useMemo } from 'react';
import { modelConfigsAdapterSelectors, useGetModelConfigsQuery } from 'services/api/endpoints/models';
import type { AnyModelConfig } from 'services/api/types';
import {
  isClipEmbedModelConfig,
  isControlNetModelConfig,
  isControlNetOrT2IAdapterModelConfig,
  isFluxMainModelModelConfig,
  isFluxVAEModelConfig,
  isIPAdapterModelConfig,
  isLoRAModelConfig,
  isNonRefinerMainModelConfig,
  isNonRefinerNonFluxMainModelConfig,
  isNonSDXLMainModelConfig,
  isRefinerMainModelModelConfig,
  isSDXLMainModelModelConfig,
  isSpandrelImageToImageModelConfig,
  isT2IAdapterModelConfig,
  isT5EncoderModelConfig,
  isTIModelConfig,
  isVAEModelConfig,
} from 'services/api/types';

const buildModelsHook =
  <T extends AnyModelConfig>(typeGuard: (config: AnyModelConfig) => config is T) =>
  () => {
    const result = useGetModelConfigsQuery(undefined);
    const modelConfigs = useMemo(() => {
      if (!result.data) {
        return EMPTY_ARRAY;
      }

      return modelConfigsAdapterSelectors.selectAll(result.data).filter(typeGuard);
    }, [result]);

    return [modelConfigs, result] as const;
  };

export const useSDMainModels = buildModelsHook(isNonRefinerNonFluxMainModelConfig);
export const useMainModels = buildModelsHook(isNonRefinerMainModelConfig);
export const useNonSDXLMainModels = buildModelsHook(isNonSDXLMainModelConfig);
export const useRefinerModels = buildModelsHook(isRefinerMainModelModelConfig);
export const useFluxModels = buildModelsHook(isFluxMainModelModelConfig);
export const useSDXLModels = buildModelsHook(isSDXLMainModelModelConfig);
export const useLoRAModels = buildModelsHook(isLoRAModelConfig);
export const useControlNetAndT2IAdapterModels = buildModelsHook(isControlNetOrT2IAdapterModelConfig);
export const useControlNetModels = buildModelsHook(isControlNetModelConfig);
export const useT2IAdapterModels = buildModelsHook(isT2IAdapterModelConfig);
export const useT5EncoderModels = buildModelsHook(isT5EncoderModelConfig);
export const useClipEmbedModels = buildModelsHook(isClipEmbedModelConfig);
export const useSpandrelImageToImageModels = buildModelsHook(isSpandrelImageToImageModelConfig);
export const useIPAdapterModels = buildModelsHook(isIPAdapterModelConfig);
export const useEmbeddingModels = buildModelsHook(isTIModelConfig);
export const useVAEModels = buildModelsHook(isVAEModelConfig);
export const useFluxVAEModels = buildModelsHook(isFluxVAEModelConfig);
