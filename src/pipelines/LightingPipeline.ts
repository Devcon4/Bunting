import { EngineData } from '../engine';
import { Err, Ok, Result } from '../errorHandling';
import { Pipeline } from '../Pipeline';
import { CubeData } from './CubeData';
import { LightingData } from './LightingData';

Pipeline.RegisterResized({ name: 'Lighting Pipeline' })(
  Result(async (data: EngineData) => {
    if (!EngineData.device) {
      return Ok(data);
    }

    await EngineData.device.queue.onSubmittedWorkDone();

    LightingData.lightingFinal.texture.destroy();

    const res = await CreateTextures(data);

    if (!res.Ok) {
      return Err('Error creating textures :: ', res.Error);
    }

    return Ok(data);
  }));

const CreateTextures = Result(async (data: EngineData) => {
	const size = data.canvasSize;
  
  const LightingFinal = data.device.createTexture({
		size,
		label: 'Lighting Final',
		format: data.format,
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
	});

	const sampler = data.device.createSampler({
		label: 'Composite Sampler',
		magFilter: 'linear',
		minFilter: 'linear',
		addressModeU: 'clamp-to-edge',
		addressModeV: 'clamp-to-edge',
		mipmapFilter: 'linear',
		addressModeW: 'repeat',
	});

  const lightingFinalView = LightingFinal.createView();

  const gbufferGroup = data.device.createBindGroup({
    label: 'Lighting GBuffer Bind Group',
    layout: LightingData.gbufferGroupLayout,
    entries: [
      { binding: 0, resource: CubeData.GBuffer.albedo.view },
      { binding: 1, resource: CubeData.GBuffer.normal.view },
      { binding: 2, resource: CubeData.GBuffer.emissive.view },
      { binding: 3, resource: CubeData.GBuffer.metalicRoughnessAO.view },
      { binding: 4, resource: CubeData.depth.view },
      { binding: 5, resource: sampler },
    ],
  });

  const uboBuffer = data.device.createBuffer({
    label: 'Lighting UBO',
    size: 4 + 4 + 4 + 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  LightingData.ubo = uboBuffer;

  const uboGroup = data.device.createBindGroup({
    label: 'Lighting UBO Bind Group',
    layout: LightingData.uboGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: LightingData.ubo,
        },
      },
    ],
  });

  LightingData.uboGroup = uboGroup;

  LightingData.lightingFinal = {
    texture: LightingFinal,
    view: lightingFinalView,
  };

  LightingData.sampler = sampler;
  LightingData.gbufferGroup = gbufferGroup;

  return Ok(data);
});

Pipeline.RegisterInit({ name: 'Lighting Pipeline' })(
  Result(async (data: EngineData) => {

    console.log('Lighting pipeline initializing...');

    const vertexShaderModule = data.device.createShaderModule({
      label: 'Lighting Vertex Shader Module',
      code: await fetch('./shaders/lighting.vert.wgsl').then((res) =>
        res.text()
      ),
    });

    const fragmentShaderModule = data.device.createShaderModule({
      label: 'Lighting Fragment Shader Module',
      code: await fetch('./shaders/lighting.frag.wgsl').then((res) =>
        res.text()
      ),
    });

    const gbufferGroupLayout = data.device.createBindGroupLayout({
      label: 'Lighting GBuffer Bind Group Layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
        { binding: 5, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    });

    const uboGroupLayout = data.device.createBindGroupLayout({
			label: 'Lighting UBO Bind Group Layout',
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'uniform',
					},
				},
			],
		});

    const lightGroupLayout = data.device.createBindGroupLayout({
			label: 'Lighting Light Bind Group Layout',
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'uniform',
					},
				},
			],
		});

    const pipelineLayout = data.device.createPipelineLayout({
      label: 'Lighting Pipeline Layout',
      bindGroupLayouts: [gbufferGroupLayout, uboGroupLayout, lightGroupLayout],
    });

    const pipeline = data.device.createRenderPipeline({
      label: 'Lighting Pipeline',
      layout: pipelineLayout,
      vertex: {
        module: vertexShaderModule,
        entryPoint: 'main',
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: 'main',
        targets: [
          {
            format: data.format,
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    LightingData.pipeline = pipeline;
    LightingData.gbufferGroupLayout = gbufferGroupLayout;
    LightingData.uboGroupLayout = uboGroupLayout;
    LightingData.lightGroupLayout = lightGroupLayout;

    const res = await CreateTextures(data);

    if (!res.Ok) {
      return Err('Error creating textures :: ', res.Error);
    }

    return Ok(data);
  }));

Pipeline.RegisterRun({ name: 'Lighting Pipeline' })(
  Result(async (data: EngineData) => {
    const encoder = data.device.createCommandEncoder({
      label: 'Lighting Command Encoder',
    });
    
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: LightingData.lightingFinal.view,
          storeOp: 'store',
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    };

    const renderPass = encoder.beginRenderPass(renderPassDescriptor);

    renderPass.setPipeline(LightingData.pipeline);
    renderPass.setViewport(0, 0, data.canvasSize.width, data.canvasSize.height, 0, 1);
    renderPass.setScissorRect(0, 0, data.canvasSize.width, data.canvasSize.height);
    renderPass.setBindGroup(0, LightingData.gbufferGroup);
    renderPass.setBindGroup(1, LightingData.uboGroup);

    for (const [_, light] of LightingData.lights) {
      renderPass.setBindGroup(2, light.lightGroup);
      renderPass.draw(6, 1, 0, 0);
    }

    renderPass.end();

    data.device.queue.submit([encoder.finish()]);

    return Ok(data);
  }));