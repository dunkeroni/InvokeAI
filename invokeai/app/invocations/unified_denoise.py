from typing import Callable, List, Optional, Type, Any, Union

import torch

from invokeai.app.invocations.baseinvocation import BaseInvocation, Classification, invocation
from invokeai.app.invocations.fields import (
    CogView4ConditioningField,
    FieldDescriptions,
    Input,
    InputField,
    LatentsField,
    WithBoard,
    WithMetadata,
    UIType,
    ConditioningField,
)
from invokeai.app.invocations.model import BaseModelType, TransformerField, UNetField, ModelIdentifierField
from invokeai.app.invocations.primitives import LatentsOutput
from invokeai.app.services.shared.invocation_context import InvocationContext
from invokeai.backend.stable_diffusion.diffusers_pipeline import PipelineIntermediateState
from invokeai.backend.unified_denoise.core_base import DENOISE_CORES, BaseCore
from invokeai.backend.unified_denoise.unified_denoise_context import DenoiseContext, DenoiseInputs
from invokeai.backend.unified_denoise.unified_extensions_base import DENOISE_EXTENSIONS, ExtensionField
from invokeai.backend.unified_denoise.unified_extensions_manager import UnifiedExtensionsManager
from invokeai.backend.unified_denoise.extension_callback_type import ExtensionCallbackType


CONDITIONING_TYPES = Union[ConditioningField, list[ConditioningField],
                    CogView4ConditioningField]

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
    extensions: Optional[Union[ExtensionField, List[ExtensionField]]] = InputField(
        default=[], description=FieldDescriptions.denoise_extensions, input=Input.Connection
    )
    denoising_start: float = InputField(default=0.0, ge=0, le=1, description=FieldDescriptions.denoising_start)
    #denoising_end: float = InputField(default=1.0, ge=0, le=1, description=FieldDescriptions.denoising_end)
    model: ModelIdentifierField = InputField(
        description=FieldDescriptions.cogview4_model, input=Input.Connection, title="Model", ui_type=UIType.Any
    )
    positive_conditioning: CONDITIONING_TYPES = InputField(
        description=FieldDescriptions.positive_cond, input=Input.Connection, ui_type=UIType.Any
    )
    negative_conditioning: Optional[CONDITIONING_TYPES] = InputField(
        description=FieldDescriptions.negative_cond, input=Input.Connection, default=None, ui_type=UIType.Any
    )
    guidance_scale: float | list[float] = InputField(default=3.5, description=FieldDescriptions.cfg_scale, title="Guidance Scale")
    width: int = InputField(default=1024, multiple_of=32, description="Width of the generated image.")
    height: int = InputField(default=1024, multiple_of=32, description="Height of the generated image.")
    steps: int = InputField(default=25, gt=0, description=FieldDescriptions.steps)
    seed: int = InputField(default=0, description="Randomness seed for reproducibility.")


    def select_core(self, inputs: DenoiseInputs) -> BaseCore:
        """Select the core to use for the denoising process based on the model type."""
        model_type: BaseModelType = BaseModelType.Any
        if isinstance(inputs.model_field, UNetField):
            model_type = self.model.unet.base
        elif isinstance(inputs.model_field, TransformerField):
            model_type = self.model.transformer.base
        else:
            raise ValueError(f"Unsupported model type: {type(inputs.model_field)}")

        inputs.model_type = model_type

        model_core_string = f"CORE_{model_type}"
        if model_core_string not in DENOISE_CORES:
            raise NotImplementedError(f"No {model_core_string} core registered for {model_type}.")
        coretype: Type[BaseCore] = DENOISE_CORES[model_core_string]
        return coretype(is_canceled=inputs.context.util.is_canceled)


    @torch.no_grad()
    def invoke(self, context: InvocationContext) -> LatentsOutput:
        """Run the denoising process with the provided model and inputs."""

        # PREP VARIABLES

        orig_latents = None
        if self.latents:
            latents = context.tensors.load(self.latents.latents_name)
            orig_latents = latents.clone()

        #dataclass for referencing inputs
        denoise_inputs = DenoiseInputs(
            context=context,
            orig_latents=orig_latents,
            model_field=self.model,
            denoising_start=self.denoising_start,
            positive_conditioning=self.positive_conditioning,
            negative_conditioning=self.negative_conditioning,
            guidance_scale=self.guidance_scale,
            width=self.width,
            height=self.height,
            steps=self.steps,
            seed=self.seed,
        )

        core = self.select_core(denoise_inputs)
        ext_manager = UnifiedExtensionsManager(is_canceled=context.util.is_canceled)

        # denoise context holds all the state variables for the denoising process.
        ctx = DenoiseContext(
            inputs=denoise_inputs,
            core=core,
            extension_manager=ext_manager,
        )

        # instance the list of extensions if they exist
        if self.extensions:
            if not isinstance(self.extensions, list):
                self.extensions = [self.extensions]
            for ext in self.extensions:
                ext_manager.add_extension_from_field(ext, ctx)

        # Raise an error if no extensions are provided
        ext_manager.assert_compatibility(ctx.inputs.model_type)

        # RUN DENOISE PROCESS

        # let the core validate inputs
        ext_manager.call_swappable("validate", core, ctx)

        # create scheduler, setup timesteps, set model-specific default variables, etc.
        ext_manager.call_swappable("setup", core, ctx)

        # give all extensions a chance to raise exceptions before starting
        ext_manager.run_callback(ExtensionCallbackType.VALIDATE, ctx)

        # create noise if necessary, apply to latents
        ext_manager.call_swappable("initialize_noise", core, ctx)

        # let extensions modify the denoise context before starting
        ext_manager.run_callback(ExtensionCallbackType.PRE_DENOISE_LOOP, ctx)

        




        latents = self._run_diffusion(context)
        latents = latents.detach().to("cpu")

        name = context.tensors.save(tensor=latents)
        return LatentsOutput.build(latents_name=name, latents=latents, seed=None)

    def _build_step_callback(self, context: InvocationContext) -> Callable[[PipelineIntermediateState], None]:
        def step_callback(state: PipelineIntermediateState) -> None:
            context.util.sd_step_callback(state, BaseModelType.CogView4)

        return step_callback
