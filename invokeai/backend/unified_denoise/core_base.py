from typing import Callable, Type

from invokeai.backend.unified_denoise.unified_denoise_context import DenoiseContext, DenoiseInputs
from invokeai.backend.util.logging import info
import abc

import torch

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


class BaseCore(abc.ABC):
    """
    Base class for denoising cores. Provides the general denoising loop structure,
    schedule calculation, CFG scale preparation, noise generation, step callback,
    and latents initialization/update logic. Model-specific logic must be implemented
    by subclasses via the abstract hooks.
    """

    def __init__(self, is_canceled: Callable[[], bool] | None = None):
        self._is_canceled = is_canceled
    
    def _prepare_cfg_scale(self, ctx: DenoiseContext):
        """Prepare the CFG scale list.

        Args:
            num_timesteps (int): The number of timesteps in the scheduler. Could be different from num_steps depending
            on the scheduler used (e.g. higher order schedulers).

        Returns:
            list[float]: _description_
        """
        guidance_scale = ctx.inputs.guidance_scale
        if isinstance(guidance_scale, float):
            guidance = [guidance_scale] * ctx.inputs.steps
        elif isinstance(guidance_scale, list):
            assert len(guidance_scale) == ctx.inputs.steps
            guidance = guidance_scale
        else:
            raise ValueError(f"Invalid CFG scale type: {type(guidance_scale)}")

        ctx.inputs.guidance_scale = guidance

    def run(self, ctx: DenoiseContext):
        """
        Run the general denoising loop.
        """
        self._pre_denoise(ctx)
        timesteps = self._get_timesteps(ctx)
        latents = self._init_latents(ctx)
        noise = self._get_noise(ctx, latents.shape, ctx.inputs.seed)
        cfg_scales = self._get_cfg_scales(ctx)

        for step_index, timestep in enumerate(timesteps):
            if self._is_canceled and self._is_canceled():
                break

            ctx.step_index = step_index
            ctx.timestep = timestep
            ctx.latents = latents

            self._step_callback(ctx, step_index, timestep, latents)

            # Model-specific noise prediction
            noise_pred = self.predict_eps(ctx, latents, timestep, cfg_scales, noise)
            latents = self._update_latents(ctx, latents, noise_pred, timestep, step_index)

        ctx.latents = latents
        self._post_denoise(ctx)

    def _pre_denoise(self, ctx: DenoiseContext):
        """Hook for logic before denoising loop."""
        pass

    def _post_denoise(self, ctx: DenoiseContext):
        """Hook for logic after denoising loop."""
        pass

    def validate(self, ctx: DenoiseContext):
        """Add runtime validation steps based on the model type."""
        pass

    def _get_timesteps(self, ctx: DenoiseContext):
        """Calculate the denoising timesteps/schedule."""
        return self.calculate_timesteps(ctx)

    def _init_latents(self, ctx: DenoiseContext):
        """Initialize latents for denoising."""
        return ctx.inputs.orig_latents.clone()

    def _get_noise(self, ctx: DenoiseContext, shape, seed):
        """Generate noise tensor for denoising."""
        generator = torch.Generator(device=ctx.inputs.orig_latents.device).manual_seed(seed)
        return torch.randn(shape, generator=generator, device=ctx.inputs.orig_latents.device).to(dtype=ctx.inputs.orig_latents.dtype,device=ctx.inputs.orig_latents.device)

    def _get_cfg_scales(self, ctx: DenoiseContext):
        """Prepare classifier-free guidance scales."""
        return self.prepare_cfg_scales(ctx)

    def _step_callback(self, ctx: DenoiseContext, step_index, timestep, latents):
        """Optional callback at each step."""
        pass

    def _update_latents(self, ctx: DenoiseContext, latents, noise_pred, timestep, step_index):
        """Update latents using the scheduler."""
        return self.update_latents(ctx, latents, noise_pred, timestep, step_index)

    # --- Abstract hooks for model-specific logic ---

    @abc.abstractmethod
    def predict_eps(self, ctx: DenoiseContext, latents, timestep, cfg_scales, noise):
        """
        Predict the noise (epsilon) for the current step.
        Must be implemented by subclasses.
        """
        pass

    @abc.abstractmethod
    def calculate_timesteps(self, ctx: DenoiseContext):
        """
        Calculate the denoising timesteps/schedule.
        Must be implemented by subclasses.
        """
        pass

    @abc.abstractmethod
    def prepare_cfg_scales(self, ctx: DenoiseContext):
        """
        Prepare classifier-free guidance scales.
        Must be implemented by subclasses.
        """
        pass

    @abc.abstractmethod
    def update_latents(self, ctx: DenoiseContext, latents, noise_pred, timestep, step_index):
        """
        Update latents using the scheduler.
        Must be implemented by subclasses.
        """
        pass
