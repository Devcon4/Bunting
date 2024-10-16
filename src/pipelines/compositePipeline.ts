import { EngineData } from '../engine';
import { Ok, Result } from '../errorHandling';
import { Pipeline } from '../Pipeline';
import { GeometryData } from './geometryPipeline';

export const CompositeData: {
  pipeline: GPURenderPipeline,
  gbufferGroup: GPUBindGroup,
  sampler: GPUSampler,
  final: {
    image: GPUTexture,
    view: GPUTextureView
  }
} = {} as any;

Pipeline.RegisterInit({name: 'Composite Pipeline', priority: 4096 })(Result(async (data: EngineData) => {
  console.log('Composite pipeline initializing...');

  const vertexShaderModule = data.device.createShaderModule({
    label: 'Composite Vertex Shader Module',
    code: await fetch('./shaders/composite.vert.wgsl').then(res => res.text())
  });

  const fragmentShaderModule = data.device.createShaderModule({
    label: 'Composite Fragment Shader Module',
    code: await fetch('./shaders/composite.frag.wgsl').then(res => res.text())
  });

  const gbufferGroupLayout = data.device.createBindGroupLayout({
    label: 'Composite GBuffer Bind Group Layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float'} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float'} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float'} },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float'} },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }
    ]
  });

  const pipelineLayout = data.device.createPipelineLayout({
    label: 'Composite Pipeline Layout',
    bindGroupLayouts: [gbufferGroupLayout],
  });

  const pipeline = await data.device.createRenderPipelineAsync({
    label: 'Composite Render Pipeline',
    vertex: {
      module: vertexShaderModule,
      entryPoint: 'main',
    },
    fragment: {
      module: fragmentShaderModule,
      entryPoint: 'main',
      targets: [{ format: data.format }]
    },
    primitive: {
      topology: 'triangle-list',
    },
    layout: pipelineLayout
  });

  const image = data.context.getCurrentTexture();
  const view = image.createView();

  const sampler = data.device.createSampler({
    label: 'Composite Sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    mipmapFilter: 'linear',
    addressModeW: 'repeat',
  });

  const gbufferGroup = data.device.createBindGroup({
    label: 'Composite GBuffer Bind Group',
    layout: gbufferGroupLayout,
    entries: [
      { binding: 0, resource: GeometryData.GBuffer.albedo.view },
      { binding: 1, resource: GeometryData.GBuffer.normal.view },
      { binding: 2, resource: GeometryData.GBuffer.emissive.view },
      { binding: 3, resource: GeometryData.GBuffer.metalicRoughnessAO.view },
      { binding: 4, resource: sampler }
    ]
  });

  CompositeData.gbufferGroup = gbufferGroup;
  CompositeData.pipeline = pipeline;
  CompositeData.sampler = sampler;
  CompositeData.final = {
    image,
    view
  };

  return Ok(data);
}));

Pipeline.RegisterResized({name: 'Composite Pipeline', priority: 1024 })(Result(async (data: EngineData) => {

  if (!data.context) {
    // Resize might be called before context is initialized.
    return Ok(data);
  }

  const image = data.context.getCurrentTexture();
  const view = image.createView();

  CompositeData.final = {
    image,
    view
  };

  return Ok(data);
}));

Pipeline.RegisterRun({name: 'Composite Pipeline', priority: 1024 })(Result(async (data: EngineData) => {
  const encoder = data.device.createCommandEncoder({
    label: 'Composite Command Encoder'
  });

  const textureView = data.context.getCurrentTexture().createView();
  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        view: textureView,
        storeOp: 'store',
        loadOp: 'clear',
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }
      }
    ]
  };

  const renderPass = encoder.beginRenderPass(renderPassDescriptor);

  renderPass.setPipeline(CompositeData.pipeline);
  renderPass.setBindGroup(0, CompositeData.gbufferGroup);

  renderPass.draw(6, 1, 0, 0);

  renderPass.end();
  data.device.queue.submit([encoder.finish()]);

  return Ok(data);
}));

Pipeline.RegisterCleanup({name: 'Composite Pipeline', priority: 1024 })(Result(async (data: EngineData) => {
  CompositeData.final.image.destroy();

  return Ok(data);
}));