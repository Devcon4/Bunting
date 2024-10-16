import { EngineData } from '../engine';
import { Ok } from '../errorHandling';
import { Pipeline } from '../Pipeline';

const TriangleData: {
  vertexBuffer: GPUBuffer,
  pipeline: GPURenderPipeline
} = {} as any;

Pipeline.RegisterInit({name: 'Triangle Pipeline'})(async (data: EngineData) => {
  console.log('Triangle pipeline initializing...');

  const vertices = new Float32Array([
    0.0, 0.5,
    -0.5, -0.5,
    0.5, -0.5
  ]);

  const rawVertexBuffer = data.device.createBuffer({
    label: 'Triangle Vertex Buffer',
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true
  });

  const vertexBuffer = rawVertexBuffer.getMappedRange();
  new Float32Array(vertexBuffer).set(vertices);
  rawVertexBuffer.unmap();

  const vertexShaderModule = data.device.createShaderModule({
    code: await fetch('./shaders/triangle.vert.wgsl').then(res => res.text())
  });

  const fragmentShaderModule = data.device.createShaderModule({
    code: await fetch('./shaders/triangle.frag.wgsl').then(res => res.text())
  });

  const vertexBufferLayout: GPUVertexBufferLayout = {
    arrayStride: 2 * 4,
    attributes: [{
      shaderLocation: 0,
      offset: 0,
      format: 'float32x2'
    }]
  };

  const pipeline = data.device.createRenderPipeline({
    vertex: {
      module: vertexShaderModule,
      entryPoint: 'main',
      buffers: [vertexBufferLayout]
    },
    fragment: {
      module: fragmentShaderModule,
      entryPoint: 'main',
      targets: [{
        format: data.format
      }]
    },
    primitive: {
      topology: 'triangle-list'
    },
    layout: "auto" // TODO: Investigate this
  });

  TriangleData.vertexBuffer = rawVertexBuffer;
  TriangleData.pipeline = pipeline;

  return Ok(data);
});

Pipeline.RegisterRun({name: 'Triangle Pipeline'})(async (data: EngineData) => {
  const commandEncoder = data.device.createCommandEncoder();

  const textureView = data.context.getCurrentTexture().createView();
  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [{
      view: textureView,
      loadOp: 'clear',
      clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
      storeOp: 'store'
    }]
  };

  const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);

  renderPass.setPipeline(TriangleData.pipeline);
  renderPass.setVertexBuffer(0, TriangleData.vertexBuffer);

  renderPass.draw(3, 1, 0, 0);
  renderPass.end();

  data.device.queue.submit([commandEncoder.finish()]);

  return Ok(data);
});

Pipeline.RegisterCleanup({name: 'Triangle Pipeline'})(async () => {
  console.log('Triangle pipeline cleaning up...');

  TriangleData.vertexBuffer.destroy();

  return Ok();
});
