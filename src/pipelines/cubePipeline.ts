import { CameraInverseView, CameraProjection, CameraView, GetCamera } from '../camera';
import { EngineData } from '../engine';
import { Err, Ok, Result } from '../errorHandling';
import { Model, ModelNode } from '../model';
import { Pipeline } from '../Pipeline';
import { IdentityTransform, MultiplyTransforms, Transform, TransformMatrix } from '../transform';
import { Mat4, mat4, quat, vec3 } from '../wgpu-matrix.extensions';
import { CubeData } from './CubeData';
import { GeometryData } from './GeometryData';

export type ImageGroup = {
  texture: GPUTexture,
  view: GPUTextureView
};

export const CubeVertex = (position: [number, number, number], normal: [number, number, number], uv: [number, number]) => ({
  position,
  normal,
  uv
});

const CreateTextures = Result(async (data: EngineData) => {
  const size = data.canvasSize;

  const depthTexture = data.device.createTexture({
    size: size,
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });

  const GBufferAlbedo = data.device.createTexture({
		size,
		label: 'GBuffer Albedo',
		format: data.format,
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
	});

	const GBufferNormal = data.device.createTexture({
		size,
		label: 'GBuffer Normal',
		format: data.format,
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
	});

	const GBufferEmissive = data.device.createTexture({
		size,
		label: 'GBuffer Emissive',
		format: data.format,
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
	});

	const GBufferMetalicRoughnessAO = data.device.createTexture({
		size,
		label: 'GBuffer MetalicRoughnessAO',
		format: data.format,
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
	});

	const depthView = depthTexture.createView();
	const albedoView = GBufferAlbedo.createView();
	const normalView = GBufferNormal.createView();
	const emissiveView = GBufferEmissive.createView();
	const metalicRoughnessAOView = GBufferMetalicRoughnessAO.createView();

	CubeData.GBuffer = {
		albedo: { view: albedoView, texture: GBufferAlbedo },
		normal: { view: normalView, texture: GBufferNormal },
		emissive: { view: emissiveView, texture: GBufferEmissive },
		metalicRoughnessAO: {
			view: metalicRoughnessAOView,
			texture: GBufferMetalicRoughnessAO,
		},
	};
	CubeData.depth = { view: depthView, texture: depthTexture };
  // CubeData.final = { texture: finalTexture, view: finalTextureView };

  return Ok(data);
});

Pipeline.RegisterResized({name: 'Cube Pipeline'})(async (data: EngineData) => {
  
  if (!data.device) {
    return Ok(data);
  }

  await data.device.queue.onSubmittedWorkDone();

  // CubeData.depth.texture.destroy();
  CubeData.depth.texture.destroy();
  CubeData.GBuffer.albedo.texture.destroy();
  CubeData.GBuffer.normal.texture.destroy();
  CubeData.GBuffer.emissive.texture.destroy();
  CubeData.GBuffer.metalicRoughnessAO.texture.destroy();

  const res = await CreateTextures(data);

  if (!res.Ok) {
    return Err('Error creating textures :: ', res.Error);
  }

  return Ok(data);
});

Pipeline.RegisterInit({name: 'Cube Pipeline'})(Result(async (data: EngineData) => {
  console.log('Cube Pipeline initializing...');

  const vertexShaderModule = data.device.createShaderModule({
    label: 'Cube Vertex Shader',
    code: await fetch('./shaders/cube.vert.wgsl').then(res => res.text())
  });

  const fragmentShaderModule = data.device.createShaderModule({
    label: 'Cube Fragment Shader',
    code: await fetch('./shaders/cube.frag.wgsl').then(res => res.text())
  });

  const vertexBufferLayout: GPUVertexBufferLayout = {
    arrayStride: (3 + 3 + 2) * 4, // 3 floats for position, 3 floats for normal, 2 floats for uv
    attributes: [
      {
        shaderLocation: 0,
        offset: 0,
        format: 'float32x3'
      },
      {
        shaderLocation: 1,
        offset: 3 * 4,
        format: 'float32x3'
      },
      {
        shaderLocation: 2,
        offset: 6 * 4,
        format: 'float32x2'
      }
    ]
  };

  const uboGroupLayout = data.device.createBindGroupLayout({
    label: 'Cube UBO Bind Group Layout',
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
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
      {
        binding: 4,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' },
      },
    ],
  });

  const pipelineLayout = data.device.createPipelineLayout({
    label: 'Cube Pipeline Layout',
    bindGroupLayouts: [materialGroupLayout, uboGroupLayout]
  });

  const pipeline = data.device.createRenderPipeline({
    label: 'Cube Render Pipeline',
    vertex: {
      module: vertexShaderModule,
      entryPoint: 'main',
      buffers: [vertexBufferLayout]
    },
    fragment: {
      module: fragmentShaderModule,
      entryPoint: 'main',
      targets: [
        {format: data.format},
        {format: data.format},
        {format: data.format},
        {format: data.format},
      ]
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
      frontFace: 'ccw'
    },
    depthStencil: {
      format: 'depth24plus',
      depthWriteEnabled: true,
      depthCompare: 'less'
    },
    layout: pipelineLayout
  });

  const sampler = data.device.createSampler({
    label: 'Geometry Sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    addressModeW: 'clamp-to-edge',
    mipmapFilter: 'linear',
    maxAnisotropy: 1,
  });

  const uboBuffer = data.device.createBuffer({
    label: 'Cube UBO Buffer',
    size: 3 * 16 * 4, // 3 matrices, 16 floats each
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  CubeData.ubo = uboBuffer;
  CubeData.materialGroupLayout = materialGroupLayout;
  CubeData.sampler = sampler;

  const uboGroup = data.device.createBindGroup({
    label: 'Cube UBO Bind Group',
    layout: uboGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: CubeData.ubo
        }
      }
    ]
  });

  // full centered. Same as above but faces are centered around 0,0,0
  const cubeMesh = [
    // front
    CubeVertex([1.0, -1.0, 1.0], [0.0, 0.0, 1.0], [1.0, 0.0]),
    CubeVertex([-1.0, -1.0, 1.0], [0.0, 0.0, 1.0], [0.0, 0.0]),
    CubeVertex([-1.0, 1.0, 1.0], [0.0, 0.0, 1.0], [0.0, 1.0]),
    CubeVertex([1.0, 1.0, 1.0], [0.0, 0.0, 1.0], [1.0, 1.0]),

    // top
    CubeVertex([1.0, 1.0, 1.0], [0.0, 1.0, 0.0], [1.0, 0.0]),
    CubeVertex([-1.0, 1.0, 1.0], [0.0, 1.0, 0.0], [0.0, 0.0]),
    CubeVertex([-1.0, 1.0, -1.0], [0.0, 1.0, 0.0], [0.0, 1.0]),
    CubeVertex([1.0, 1.0, -1.0], [0.0, 1.0, 0.0], [1.0, 1.0]),

    // back
    CubeVertex([-1.0, -1.0, -1.0], [0.0, 0.0, 1.0], [0.0, 0.0]),
    CubeVertex([1.0, -1.0, -1.0], [0.0, 0.0, 1.0], [1.0, 0.0]),
    CubeVertex([1.0, 1.0, -1.0], [0.0, 0.0, 1.0], [1.0, 1.0]),
    CubeVertex([-1.0, 1.0, -1.0], [0.0, 0.0, 1.0], [0.0, 1.0]),

    // bottom
    CubeVertex([-1.0, -1.0, 1.0], [0.0, 1.0, 0.0], [0.0, 0.0]),
    CubeVertex([1.0, -1.0, 1.0], [0.0, 1.0, 0.0], [1.0, 0.0]),
    CubeVertex([1.0, -1.0, -1.0], [0.0, 1.0, 0.0], [1.0, 1.0]),
    CubeVertex([-1.0, -1.0, -1.0], [0.0, 1.0, 0.0], [0.0, 1.0]),

    // right
    CubeVertex([1.0, -1.0, -1.0], [1.0, 0.0, 0.0], [1.0, 0.0]),
    CubeVertex([1.0, -1.0, 1.0], [1.0, 0.0, 0.0], [0.0, 0.0]),
    CubeVertex([1.0, 1.0, 1.0], [1.0, 0.0, 0.0], [0.0, 1.0]),
    CubeVertex([1.0, 1.0, -1.0], [1.0, 0.0, 0.0], [1.0, 1.0]),

    // left
    CubeVertex([-1.0, -1.0, 1.0], [1.0, 0.0, 0.0], [1.0, 0.0]),
    CubeVertex([-1.0, -1.0, -1.0], [1.0, 0.0, 0.0], [0.0, 0.0]),
    CubeVertex([-1.0, 1.0, -1.0], [1.0, 0.0, 0.0], [0.0, 1.0]),
    CubeVertex([-1.0, 1.0, 1.0], [1.0, 0.0, 0.0], [1.0, 1.0]),
  ];

  CubeData.mesh = cubeMesh;


  CubeData.meshTransform = {
    ...IdentityTransform(),
    rotation: quat.fromEulerDegree(0, 0, 0),
    translation: vec3.fromValues(0, 0, 0),
    scale: vec3.fromValues(.5, .5, .5),
  };

  const vertexBufferData = new Float32Array(CubeData.mesh.length * 8);

  CubeData.mesh.forEach((vertex, i) => {
    vertexBufferData.set([
      ...vertex.position,
      ...vertex.normal,
      ...vertex.uv
    ], i * 8);
  });

	const vertexSize = 3 * 4 + 3 * 4 + 2 * 4;


  const vertexBuffer = data.device.createBuffer({
    label: 'Cube Vertex Buffer',
    size: CubeData.mesh.length * vertexSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true
  });

  new Float32Array(vertexBuffer.getMappedRange()).set(vertexBufferData);
  vertexBuffer.unmap();

  const indexBufferData = new Uint16Array([
    0, 1, 2, 2, 3, 0,
    4, 5, 6, 6, 7, 4,
    8, 9, 10, 10, 11, 8,
    12, 13, 14, 14, 15, 12,
    16, 17, 18, 18, 19, 16,
    20, 21, 22, 22, 23, 20
  ]);

  const indexBuffer = data.device.createBuffer({
    label: 'Cube Index Buffer',
    size: indexBufferData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true
  });

  new Uint16Array(indexBuffer.getMappedRange()).set(indexBufferData);
  indexBuffer.unmap();

  CubeData.vertexBuffer = vertexBuffer;
  CubeData.indexBuffer = indexBuffer;
  CubeData.indexCount = indexBufferData.length;

  CubeData.pipeline = pipeline;
  CubeData.uboGroup = uboGroup;

  const res = await CreateTextures(data);

  if (!res.Ok) {
    return Err('Error creating textures :: ', res.Error);
  }

  return Ok(data);

}));

Pipeline.RegisterRun({name: 'Cube Pipeline'})(Result(async (data: EngineData) => {
  const commandEncoder = data.device.createCommandEncoder({
    label: 'Cube Command Encoder'
  });

  const createAttachment = (view: GPUTextureView): GPURenderPassColorAttachment => ({
    view,
    loadOp: 'clear',
    storeOp: 'store',
    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }
  });

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      // createAttachment(data.context.getCurrentTexture().createView())
      createAttachment(CubeData.GBuffer.albedo.view),
      createAttachment(CubeData.GBuffer.normal.view),
      createAttachment(CubeData.GBuffer.emissive.view),
      createAttachment(CubeData.GBuffer.metalicRoughnessAO.view),

    ],
    depthStencilAttachment: {
      view: CubeData.depth.view,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
      depthClearValue: 1.0,
    }
  };

  const uboData = new Float32Array(3 * 16);

  const cameraRes = await GetCamera();

  if (!cameraRes.Ok) {
    return Err('Error getting camera :: ', cameraRes.Error);
  }

  const camera = cameraRes.Value;

  // quat.rotateY(camera.transform.rotation, 0.01);
  // quat.rotateY(CubeData.meshTransform.rotation, 0.01, CubeData.meshTransform.rotation);

  const view = CameraView(camera);
  const projection = CameraProjection(camera);
  const model = TransformMatrix(CubeData.meshTransform);

  uboData.set(view, 0);
  uboData.set(projection, 16);
  uboData.set(model, 32);

  // console.log('uboData :: ', uboData);

  const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);

  const helmetRes = GeometryData.models[0];

  if (!helmetRes) {
    return Err('Helmet model not found');
  }

  const helmet = helmetRes;

  renderPass.setPipeline(CubeData.pipeline);
  renderPass.setViewport(0, 0, data.canvasSize.width, data.canvasSize.height, 0, 1);
  renderPass.setScissorRect(0, 0, data.canvasSize.width, data.canvasSize.height);
  renderPass.setBindGroup(1, CubeData.uboGroup);


  // renderPass.setVertexBuffer(0, CubeData.vertexBuffer);
  // renderPass.setIndexBuffer(CubeData.indexBuffer, 'uint16');
  // renderPass.drawIndexed(CubeData.indexCount, 1);

  renderPass.setVertexBuffer(0, helmet.vertices);
  renderPass.setIndexBuffer(helmet.indices, 'uint16');

  // const rootTransform = TransformMatrix(helmet.transform);

  // for (let node of helmet.nodes) {
  //   const nodeTransform = TransformMatrix(node.transform);
  //   const modelTransform = mat4.multiply(rootTransform, nodeTransform);

  //   uboData.set(modelTransform, 32);
  //   data.device.queue.writeBuffer(CubeData.ubo, 0, uboData.buffer, uboData.byteOffset, uboData.byteLength);

  //   for (let primitive of node.primitives) {
  //     const material = helmet.materials[primitive.materialIndex];
  //     renderPass.setBindGroup(0, material.materialGroup);

  //     renderPass.drawIndexed(primitive.indexCount, 1, primitive.firstIndex, 0, 0);
  //   }
  // }
  const curr = await GetCamera();
  if (!curr.Ok) {
    return Err('Error getting current camera :: ', curr.Error);
  }

  const setUbo = (modelMatrix: Mat4) => {
    const uboData = new Float32Array(3 * 16); // 3 matrices, 16 floats each + 1 vec4 color
    const view = CameraInverseView(curr.Value);
    const projection = CameraProjection(curr.Value);

    // console.log('view :: ', view);
    // console.log('projection :: ', projection);
    // console.log('modelMatrix :: ', modelMatrix);

    const pvm = mat4.multiply(mat4.multiply(projection, view), modelMatrix);

    // console.log('pvm :: ', pvm);

    uboData.set(view, 0);
    uboData.set(projection, 16);
    uboData.set(modelMatrix, 32);
    data.device.queue.writeBuffer(CubeData.ubo, 0, uboData);
  };

  const drawModel = Result(async (model: Model) => {
    renderPass.setVertexBuffer(0, model.vertices);
    renderPass.setIndexBuffer(model.indices, 'uint16');

    const drawNode = (
      root: Model,
      parentTransform: Transform,
      node: ModelNode
    ) => {
      const absoluteTransform = MultiplyTransforms(
        parentTransform,
        node.transform,
      );

      for (let child of node.children) {
        drawNode(root, absoluteTransform, child);
      }

      const modelMatrix = TransformMatrix(absoluteTransform);
      // console.log('modelMatrix :: ', modelMatrix);
      // console.log('root :: ', TransformMatrix(root.transform));
      // console.log('node :: ', TransformMatrix(node.transform));
      // console.log('absoluteTransform :: ', absoluteTransform.rotation);

      setUbo(modelMatrix);
      // console.log('transform :: ', absoluteTransform);
      // console.log('modelMatrix :: ', modelMatrix);

      // set node transform group
      for (let primitive of node.primitives) {
        const material = root.materials[primitive.materialIndex];
        renderPass.setBindGroup(0, material.materialGroup);
        renderPass.setBindGroup(1, CubeData.uboGroup);
        renderPass.drawIndexed(
          primitive.indexCount,
          1,
          primitive.firstIndex,
          0,
          0
        );
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