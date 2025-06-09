from typing import Callable, Optional, Union, List, Type
import torch
import torchvision.transforms as tv_transforms
from diffusers.models.transformers.transformer_cogview4 import CogView4Transformer2DModel
from torchvision.transforms.functional import resize as tv_resize
from tqdm import tqdm

from invokeai.app.invocations.baseinvocation import BaseInvocation, Classification, invocation
from invokeai.app.invocations.constants import LATENT_SCALE_FACTOR
from invokeai.app.invocations.fields import (
    CogView4ConditioningField,
    FieldDescriptions,
    Input,
    InputField,
    LatentsField,
    WithBoard,
    WithMetadata,
)
from invokeai.app.invocations.model import TransformerField, UNetField, BaseModelType
from invokeai.app.invocations.primitives import LatentsOutput
from invokeai.app.services.shared.invocation_context import InvocationContext
from invokeai.backend.flux.sampling_utils import clip_timestep_schedule_fractional
from invokeai.backend.rectified_flow.rectified_flow_inpaint_extension import RectifiedFlowInpaintExtension
from invokeai.backend.stable_diffusion.diffusers_pipeline import PipelineIntermediateState
from invokeai.backend.stable_diffusion.diffusion.conditioning_data import CogView4ConditioningInfo
from invokeai.backend.util.devices import TorchDevice
from invokeai.backend.unified_denoise.unified_extensions_base import ExtensionField

from invokeai.backend.unified_denoise.unified_extensions_base import UnifiedExtensionBase, DENOISE_EXTENSIONS
from invokeai.backend.unified_denoise.core_base import BaseCore
from invokeai.backend.unified_denoise.unified_extensions_manager import UnifiedExtensionsManager
from invokeai.backend.unified_denoise.unified_denoise_context import DenoiseContext, DenoiseInputs


@invocation(
    "unified_denoise",
    title="Denoise - Unified",
    tags=["image", "unified"],
    category="image",
    version="1.0.0",
    classification=Classification.Prototype,
)
class UnifiedDenoiseInvocation(BaseInvocation, WithMetadata, WithBoard):
    """Run the denoising process with any model."""

    # If latents is provided, this means we are doing image-to-image.
    latents: Optional[LatentsField] = InputField(
        default=None, description=FieldDescriptions.latents, input=Input.Connection
    )
    # Modifiers for the denoising process.
    extensions: Optional[ExtensionField | List[ExtensionField]] = InputField(
        default=[], description=FieldDescriptions.denoise_extensions, input=Input.Connection
    )
    denoising_start: float = InputField(default=0.0, ge=0, le=1, description=FieldDescriptions.denoising_start)
    #denoising_end: float = InputField(default=1.0, ge=0, le=1, description=FieldDescriptions.denoising_end)
    model: TransformerField | UNetField = InputField(
        description=FieldDescriptions.cogview4_model, input=Input.Connection, title="Model"
    )
    positive_conditioning: CogView4ConditioningField = InputField(
        description=FieldDescriptions.positive_cond, input=Input.Connection
    )
    negative_conditioning: CogView4ConditioningField = InputField(
        description=FieldDescriptions.negative_cond, input=Input.Connection
    )
    cfg_scale: float | list[float] = InputField(default=3.5, description=FieldDescriptions.cfg_scale, title="CFG Scale")
    width: int = InputField(default=1024, multiple_of=32, description="Width of the generated image.")
    height: int = InputField(default=1024, multiple_of=32, description="Height of the generated image.")
    steps: int = InputField(default=25, gt=0, description=FieldDescriptions.steps)
    seed: int = InputField(default=0, description="Randomness seed for reproducibility.")

    @torch.no_grad()
    def invoke(self, context: InvocationContext) -> LatentsOutput:
        """Run the denoising process with the provided model and inputs."""

        if self.latents:
            latents = context.tensors.load(self.latents.latents_name)
            orig_latents = latents.clone()
        else:
            latents = None

        denoise_inputs = DenoiseInputs(
            orig_latents=orig_latents,
            model_field=self.model,
            denoising_start=self.denoising_start,
            positive_conditioning=self.positive_conditioning,
            negative_conditioning=self.negative_conditioning,
            cfg_scale=self.cfg_scale,
            width=self.width,
            height=self.height,
            steps=self.steps,
            seed=self.seed,
        )
        denoise_ctx = DenoiseContext(
            inputs=denoise_inputs,
            device=TorchDevice.get_torch_device(),
            util=context.util,
            step_callback=self._build_step_callback(context),
        )


        # Determine which core to use. Cores are registered as extensions in the format "CORE_modeltype"
        model_type: BaseModelType = BaseModelType.Any
        if isinstance(self.model, UNetField):
            model_type = self.model.unet.base
        elif isinstance(self.model, TransformerField):
            model_type = self.model.transformer.base

        model_core_string = f"CORE_{model_type}"
        if model_core_string not in DENOISE_EXTENSIONS:
            raise NotImplementedError(f"No {model_core_string} extension registered for {model_type}.")
        core: Type[BaseCore] = DENOISE_EXTENSIONS[model_core_string]
        assert isinstance(core, BaseCore)

        ext_manager = UnifiedExtensionsManager(is_canceled=context.util.is_canceled)

        # create list of extensions if they exist
        if self.extensions:
            if not isinstance(self.extensions, list):
                self.extensions = [self.extensions]
            for ext in self.extensions:
                if isinstance(ext, ExtensionField):
                    ext_class = DENOISE_EXTENSIONS.get(ext.name)
                    if ext_class is None:
                        raise ValueError(f"Extension {ext.name} not found.")
                    ext_manager.add_extension(ext)
                else:
                    raise ValueError(f"Invalid extension type: {type(ext)}. Expected ExtensionField.")
        





        latents = self._run_diffusion(context)
        latents = latents.detach().to("cpu")

        name = context.tensors.save(tensor=latents)
        return LatentsOutput.build(latents_name=name, latents=latents, seed=None)


    def _build_step_callback(self, context: InvocationContext) -> Callable[[PipelineIntermediateState], None]:
        def step_callback(state: PipelineIntermediateState) -> None:
            context.util.sd_step_callback(state, BaseModelType.CogView4)

        return step_callback
