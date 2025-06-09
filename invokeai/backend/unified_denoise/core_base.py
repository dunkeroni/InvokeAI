from typing import Type, Callable
from invokeai.backend.util.logging import info
from invokeai.backend.stable_diffusion.denoise_context import DenoiseContext

DENOISE_CORES = {}

def denoise_core(name: str):
    """Register an core class object under a string reference"""

    def decorator(cls: Type[BaseCore]):
        if name in DENOISE_CORES:
            raise ValueError(f"Extension {name} already registered")
        info(f"Registered extension {cls.__name__} as {name}")
        DENOISE_CORES[name] = cls
        return cls

    return decorator


class BaseCore():
    """Base class for denoising cores. Cores are registered as extensions in the format "CORE_modeltype"."""

    def __init__(self, is_canceled: Callable[[], bool] | None = None):
        self._is_canceled = is_canceled

    def run(self, ctx: DenoiseContext):
        """Run the core logic."""
        raise NotImplementedError("Subclasses must implement this method.")