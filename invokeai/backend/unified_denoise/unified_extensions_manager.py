from __future__ import annotations

from contextlib import ExitStack, contextmanager
from typing import TYPE_CHECKING, Callable, Dict, List, Optional, Type

import torch
from diffusers import UNet2DConditionModel
from invokeai.app.invocations.model import BaseModelType

from invokeai.app.services.session_processor.session_processor_common import CanceledException
from invokeai.backend.unified_denoise.unified_extensions_base import CallbackFunctionWithMetadata, UnifiedExtensionBase
from invokeai.backend.util.original_weights_storage import OriginalWeightsStorage
from invokeai.backend.unified_denoise.unified_extensions_base import DENOISE_EXTENSIONS, ExtensionField, UnifiedExtensionBase
from invokeai.backend.unified_denoise.unified_denoise_context import DenoiseContext, DenoiseInputs
from invokeai.backend.unified_denoise.extension_callback_type import ExtensionCallbackType


class UnifiedExtensionsManager:
    def __init__(self, is_canceled: Optional[Callable[[], bool]] = None):
        self._is_canceled = is_canceled

        # A list of extensions in the order that they were added to the ExtensionsManager.
        self._extensions: List[UnifiedExtensionBase] = []
        self._ordered_callbacks: Dict[ExtensionCallbackType, List[CallbackFunctionWithMetadata]] = {}
        self._swaps: Dict[str, tuple[Callable, UnifiedExtensionBase]] = {}
    
    def assert_compatibility(self, model_type: BaseModelType):
        """Chheck that each extension is compatible with the provided model."""
        for ext in self._extensions:
            if model_type not in ext.get_compatible_model_types():
                raise ValueError(f"Extension {ext.name} is not compatible with model {model_type}")

    def call_swappable(self, function_name: str, core: object, *args, **kwargs) -> None:
        """
        Call a swappable core function by name. If a swap is registered, call it.
        Otherwise, call the method from the provided core object.
        """
        swap_fn = self.get_swap(function_name)
        if swap_fn is not None:
            return swap_fn(*args, **kwargs)
        core_fn = getattr(core, function_name, None)
        if core_fn is None:
            raise AttributeError(f"Core object has no function '{function_name}'")
        return core_fn(*args, **kwargs)

    def add_extension_from_field(self, extension_field: ExtensionField, ctx: DenoiseContext):
        """Adds an extension to the manager from an ExtensionField."""
        if extension_field.name not in DENOISE_EXTENSIONS:
            raise ValueError(f"Extension {extension_field.name} is not registered.")
        ext_class: Type[UnifiedExtensionBase] = DENOISE_EXTENSIONS[extension_field.name]
        extension = ext_class(ctx=ctx, kwargs=extension_field.kwargs)
        extension.name = extension_field.name  # Set the name from the field
        self.add_extension(extension)

    def add_extension(self, extension: UnifiedExtensionBase):
        self._extensions.append(extension)
        self._regenerate_ordered_callbacks()
        self._register_extension_swaps(extension)

    def _register_extension_swaps(self, extension: UnifiedExtensionBase):
        swaps = getattr(extension, "get_swaps", None)
        if swaps is not None:
            for function_name, swap_fn_with_meta in extension.get_swaps().items():
                self.register_swap(function_name, swap_fn_with_meta.function, extension)

    def register_swap(self, function_name: str, func: Callable, extension: UnifiedExtensionBase):
        if function_name in self._swaps:
            raise RuntimeError(f"Function '{function_name}' is already swapped by another extension.")
        self._swaps[function_name] = (func, extension)

    def unregister_swap(self, function_name: str, extension: UnifiedExtensionBase):
        if function_name in self._swaps and self._swaps[function_name][1] == extension:
            del self._swaps[function_name]

    def get_swap(self, function_name: str) -> Optional[Callable]:
        entry = self._swaps.get(function_name)
        if entry:
            return entry[0]
        return None

    def _regenerate_ordered_callbacks(self):
        """Regenerates self._ordered_callbacks. Intended to be called each time a new extension is added."""
        self._ordered_callbacks = {}

        # Fill the ordered callbacks dictionary.
        for extension in self._extensions:
            for callback_type, callbacks in extension.get_callbacks().items():
                if callback_type not in self._ordered_callbacks:
                    self._ordered_callbacks[callback_type] = []
                self._ordered_callbacks[callback_type].extend(callbacks)

        # Sort each callback list.
        for callback_type, callbacks in self._ordered_callbacks.items():
            # Note that sorted() is stable, so if two callbacks have the same order, the order that they extensions were
            # added will be preserved.
            self._ordered_callbacks[callback_type] = sorted(callbacks, key=lambda x: x.metadata.order)

    def run_callback(self, callback_type: ExtensionCallbackType, ctx: DenoiseContext):
        if self._is_canceled and self._is_canceled():
            raise CanceledException

        callbacks = self._ordered_callbacks.get(callback_type, [])
        for cb in callbacks:
            cb.function(ctx)
    

    @contextmanager
    def patch_extensions(self, ctx: DenoiseContext):
        if self._is_canceled and self._is_canceled():
            raise CanceledException

        with ExitStack() as exit_stack:
            for ext in self._extensions:
                exit_stack.enter_context(ext.patch_extension(ctx))

            yield None

    @contextmanager
    def patch_unet(self, unet: UNet2DConditionModel, cached_weights: Optional[Dict[str, torch.Tensor]] = None):
        if self._is_canceled and self._is_canceled():
            raise CanceledException

        original_weights = OriginalWeightsStorage(cached_weights)
        try:
            with ExitStack() as exit_stack:
                for ext in self._extensions:
                    exit_stack.enter_context(ext.patch_unet(unet, original_weights))

                yield None

        finally:
            with torch.no_grad():
                for param_key, weight in original_weights.get_changed_weights():
                    unet.get_parameter(param_key).copy_(weight)
