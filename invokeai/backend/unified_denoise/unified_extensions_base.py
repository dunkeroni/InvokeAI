from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Type

from diffusers import UNet2DConditionModel
from pydantic import BaseModel

from invokeai.app.invocations.fields import Field
from invokeai.app.invocations.model import BaseModelType
from invokeai.backend.util.logging import info
from invokeai.invocation_api import (
    BaseInvocationOutput,
    OutputField,
    invocation_output,
)

if TYPE_CHECKING:
    from invokeai.backend.unified_denoise.extension_callback_type import ExtensionCallbackType
    from invokeai.backend.unified_denoise.unified_denoise_context import DenoiseContext
    from invokeai.backend.util.original_weights_storage import OriginalWeightsStorage


DENOISE_EXTENSIONS = {}


def denoise_extension(name: str):
    """Register an extension class object under a string reference"""

    def decorator(cls: Type[UnifiedExtensionBase]):
        if name in DENOISE_EXTENSIONS:
            raise ValueError(f"Extension {name} already registered")
        info(f"Registered extension {cls.__name__} as {name}")
        DENOISE_EXTENSIONS[name] = cls
        return cls

    return decorator


class ExtensionField(BaseModel):
    """Extension information for use in the denoising process."""

    name: str = Field(description="The name of the extension class")
    # priority: int = Field(default=100, description="Execution order for multiple guidance. Lower numbers go first.")
    kwargs: dict[str, Any] = Field(default={}, description="Keyword arguments for the guidance extension")


@invocation_output("guidance_module_output")
class GuidanceDataOutput(BaseInvocationOutput):
    guidance_data_output: ExtensionField | None = OutputField(
        title="Guidance Module", description="Information to alter the denoising process"
    )


@dataclass
class CallbackMetadata:
    callback_type: ExtensionCallbackType
    order: int


@dataclass
class CallbackFunctionWithMetadata:
    metadata: CallbackMetadata
    function: Callable[[DenoiseContext], None]


def callback(callback_type: ExtensionCallbackType, order: int = 0):
    def _decorator(function):
        function._ext_metadata = CallbackMetadata(
            callback_type=callback_type,
            order=order,
        )
        return function

    return _decorator


@dataclass
class SwapMetadata:
    function_name: str


@dataclass
class SwapFunctionWithMetadata:
    metadata: SwapMetadata
    function: Callable


def swap(function_name: str):
    def _decorator(function):
        function._swap_metadata = SwapMetadata(function_name=function_name)
        return function

    return _decorator


class UnifiedExtensionBase:
    name: str = "Undefined"  # Used for warning messages and debugging.

    def __init__(self, ctx: DenoiseContext, kwargs: dict[str, Any]):
        self._callbacks: Dict[ExtensionCallbackType, List[CallbackFunctionWithMetadata]] = {}

        # Register all of the callback methods for this instance.
        for func_name in dir(self):
            func = getattr(self, func_name)
            metadata = getattr(func, "_ext_metadata", None)
            if metadata is not None and isinstance(metadata, CallbackMetadata):
                if metadata.callback_type not in self._callbacks:
                    self._callbacks[metadata.callback_type] = []
                self._callbacks[metadata.callback_type].append(CallbackFunctionWithMetadata(metadata, func))

        self._post_init(ctx, **kwargs)

    def _post_init(self, ctx: DenoiseContext, **kwargs: dict[str, Any]):
        """Post-initialization hook for the extension. Handle inputs from the user node here."""
        pass

    def get_compatible_model_types(self) -> List[BaseModelType]:
        """Returns a list of model types that this extension is compatible with."""
        return []

    def get_callbacks(self):
        return self._callbacks

    def get_swaps(self) -> Dict[str, SwapFunctionWithMetadata]:
        """Returns a dictionary of function names to SwapFunctionWithMetadata objects."""
        swaps = {}
        for func_name in dir(self):
            func = getattr(self, func_name)
            metadata = getattr(func, "_swap_metadata", None)
            if metadata is not None and isinstance(metadata, SwapMetadata):
                swaps[metadata.function_name] = SwapFunctionWithMetadata(metadata, func)
        return swaps

    @contextmanager
    def patch_extension(self, ctx: DenoiseContext):
        yield None

    @contextmanager
    def patch_unet(self, unet: UNet2DConditionModel, original_weights: OriginalWeightsStorage):
        """A context manager for applying patches to the UNet model. The context manager's lifetime spans the entire
        diffusion process. Weight unpatching is handled upstream, and is achieved by saving unchanged weights by
        `original_weights.save` function. Note that this enables some performance optimization by avoiding redundant
        operations. All other patches (e.g. changes to tensor shapes, function monkey-patches, etc.) should be unpatched
        by this context manager.

        Args:
            unet (UNet2DConditionModel): The UNet model on execution device to patch.
            original_weights (OriginalWeightsStorage): A storage with copy of the model's original weights in CPU, for
                unpatching purposes. Extension should save tensor which being modified in this storage, also extensions
                can access original weights values.
        """
        yield
