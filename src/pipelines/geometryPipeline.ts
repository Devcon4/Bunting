import { mat4 } from 'gl-matrix';
import { CameraInveseView, CameraProjection, GetCamera } from '../camera';
import { EngineData } from '../engine';
import { Err, Ok, Result } from '../errorHandling';
import { Model, ModelNode } from '../model';
import { Pipeline } from '../Pipeline';
import { MultiplyTransforms, Transform, TransformMatrix } from '../transform';

type GBufferImage = {
  view: GPUTextureView,
  texture: GPUTexture
};

export const GeometryData: {
  pipeline: GPURenderPipeline,
  uboGroup: GPUBindGroup,
  gbufferGroup: GPUBindGroup,
  sampler: GPUSampler,
  depth: GBufferImage,
  materialGroupLayout: GPUBindGroupLayout;
  GBuffer: {
    albedo: GBufferImage,
    normal: GBufferImage,
    emissive: GBufferImage,
    metalicRoughnessAO: GBufferImage
  },
  ubo: GPUBuffer,
  models: Model[]
} = {
  models: []
} as any;

Pipeline.RegisterInit({name: 'Geometry Pipeline', priority: 1000 })(Result(async (data: EngineData) => {
  console.log('Geometry pipeline initializing...');

  const vertexShaderModule = data.device.createShaderModule({
    label: 'Geometry Vertex Shader Module',
    code: await fetch('./shaders/geometry.vert.wgsl').then(res => res.text())
  });

  const fragmentShaderModule = data.device.createShaderModule({
    label: 'Geometry Fragment Shader Module',
    code: await fetch('./shaders/geometry.frag.wgsl').then(res => res.text())
  });

  const vertexBufferLayout: GPUVertexBufferLayout = {
    arrayStride: (3 + 3 + 2) * 4, // 3 floats for position, 3 floats for normal, 2 floats for uv 
    attributes: [
    {
      shaderLocation: 0,
      offset: 0,
      format: 'float32x2'
    },
    {
      shaderLocation: 1,
      offset: 3 * 4,
      format: 'float32x2'
    },
    {
      shaderLocation: 2,
      offset: 6 * 4,
      format: 'float32x2'
    }
  ]};

  const uboGroupLayout = data.device.createBindGroupLayout({
    label: 'Geometry UBO Bind Group Layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {
          type: 'uniform'
        }
      }
    ]
  });

  const materialGroupLayout = data.device.createBindGroupLayout({
    label: 'Geometry Model Bind Group Layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float'} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float'} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float'} },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float'} },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }
    ]
  });

  const pipelineLayout = data.device.createPipelineLayout({
    label: 'Geometry Pipeline Layout',
    bindGroupLayouts: [materialGroupLayout, uboGroupLayout]
  });

  const pipeline = await data.device.createRenderPipelineAsync({
    label: 'Geometry Pipeline',
    vertex: {
      module: vertexShaderModule,
      entryPoint: 'main',
      buffers: [vertexBufferLayout]
    },
    fragment: {
      module: fragmentShaderModule,
      entryPoint: 'main',
      targets: [
        { format: 'rgba8unorm' }, // albedo
        { format: 'rgba8unorm' }, // normal
        { format: 'rgba8unorm' }, // emissive
        { format: 'rgba8unorm' }  // metalicRoughnessAO
      ]
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
      frontFace: 'cw',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus-stencil8'
    },
    layout: pipelineLayout
  });

  const size = data.canvasSize;

  const depthTexture = data.device.createTexture({
    size,
    label: 'Depth Texture',
    format: 'depth24plus-stencil8',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  });

  const GBufferAlbedo = data.device.createTexture({
    size,
    label: 'GBuffer Albedo',
    format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  });

  const GBufferNormal = data.device.createTexture({
    size,
    label: 'GBuffer Normal',
    format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  });

  const GBufferEmissive = data.device.createTexture({
    size,
    label: 'GBuffer Emissive',
    format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  });

  const GBufferMetalicRoughnessAO = data.device.createTexture({
    size,
    label: 'GBuffer MetalicRoughnessAO',
    format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  });

  const depthView = depthTexture.createView();
  const albedoView = GBufferAlbedo.createView();
  const normalView = GBufferNormal.createView();
  const emissiveView = GBufferEmissive.createView();
  const metalicRoughnessAOView = GBufferMetalicRoughnessAO.createView();

  
  const sampler = data.device.createSampler({
    label: 'Geometry Sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    addressModeW: 'clamp-to-edge',
    mipmapFilter: 'linear',
    maxAnisotropy: 1
  });

  const uboBuffer = data.device.createBuffer({
    label: 'Geometry UBO Buffer',
    size: 3 * 16 * 4, // 3 matrices, 16 floats each
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  const uboGroup = data.device.createBindGroup({
    label: 'Geometry UBO Bind Group',
    layout: uboGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uboBuffer
        }
      }
    ]
  });

  GeometryData.ubo = uboBuffer;
  GeometryData.uboGroup = uboGroup;
  GeometryData.materialGroupLayout = materialGroupLayout;
  GeometryData.sampler = sampler;

  GeometryData.GBuffer = {
    albedo: { view: albedoView, texture: GBufferAlbedo },
    normal: { view: normalView, texture: GBufferNormal },
    emissive: { view: emissiveView, texture: GBufferEmissive },
    metalicRoughnessAO: { view: metalicRoughnessAOView, texture: GBufferMetalicRoughnessAO }
  };

  GeometryData.pipeline = pipeline;
  GeometryData.depth = { view: depthView, texture: depthTexture };

  return Ok(data);
 }));

 Pipeline.RegisterRun({name: 'Geometry Pipeline'})(Result(async (data: EngineData) => {
  // console.log('Geometry pipeline running...');
  const commandEncoder = data.device.createCommandEncoder({
    label: 'Geometry Command Encoder'
  });


  const createAttachment = (view: GPUTextureView): GPURenderPassColorAttachment => ({
    view,
    storeOp: 'store',
    loadOp: 'clear',
    clearValue: { r: 0, g: 0, b: 0, a: 0 }
  });

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      createAttachment(GeometryData.GBuffer.albedo.view),
      createAttachment(GeometryData.GBuffer.normal.view),
      createAttachment(GeometryData.GBuffer.emissive.view),
      createAttachment(GeometryData.GBuffer.metalicRoughnessAO.view),
    ],
    depthStencilAttachment: {
      view: GeometryData.depth.view,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
      stencilLoadOp: 'clear',
      stencilStoreOp: 'store',
      depthClearValue: 1.0
    },
  };

  const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);

  renderPass.setPipeline(GeometryData.pipeline);
  renderPass.setBindGroup(1, GeometryData.uboGroup);

  const drawModel = Result(async (model: Model) => {
    renderPass.setVertexBuffer(0, model.vertices);
    renderPass.setIndexBuffer(model.indices, 'uint16');

    const curr = await GetCamera();

    if (!curr.Ok) {
      return Err('Error getting current camera :: ', curr.Error);
    }

    const uboData = new Float32Array(3 * 16);
    const view = CameraInveseView(curr.Value);
    const projection = CameraProjection(curr.Value);

    uboData.set(view);
    uboData.set(projection, 16);

    const setUbo = (modelMatrix: mat4) => {
      uboData.set(modelMatrix, 32);
      data.device.queue.writeBuffer(GeometryData.ubo, 0, uboData.buffer, uboData.byteOffset, uboData.byteLength);
    };

    const drawNode = (root: Model, parentTransform: Transform, node: ModelNode) => {
      const absoluteTransform = MultiplyTransforms(node.transform, parentTransform);

      for (let child of node.children) {
        drawNode(root, absoluteTransform, child);
      }

      const modelMatrix = TransformMatrix(absoluteTransform);
      setUbo(modelMatrix);

      // set node transform group
      for (let primitive of node.primitives) {
        const material = root.materials[primitive.materialIndex];
        renderPass.setBindGroup(0, material.materialGroup);
        renderPass.drawIndexed(primitive.indexCount, 1, primitive.firstIndex, 0, 0);
      }
    };

    for (let node of model.nodes) {
      drawNode(model, model.transform, node);
    }

    return Ok();
  });

  for (let model of GeometryData.models) {
    const res = await drawModel(model);

    if (!res.Ok) {
      return Err(`Error drawing model ${model.modelId} :: `, res.Error);
    }
  }

  renderPass.end();
  data.device.queue.submit([commandEncoder.finish()]);

  return Ok(data);
 }));
