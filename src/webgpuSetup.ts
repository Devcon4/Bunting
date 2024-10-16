import { EngineData } from './engine';
import { Err, Ok, Result } from './errorHandling';
import { PipelineData } from './Pipeline';

// get the returned Ok value from initWebGpu
export type WebGpuData = Extract<Awaited<ReturnType<typeof initWebGpu>>, {Ok: true}>['Value'];

export const initWebGpu = Result(async () => {

  if (!navigator.gpu) {
    return Err('WebGPU is not supported in this browser.');
  }

  const adapter = await navigator.gpu.requestAdapter();

  if (!adapter) {
    return Err('No adapter found.');
  }

  const device = await adapter.requestDevice();

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;

  if (!canvas) {
    return Err('Canvas not found.');
  }

  // setup resize observer to resize canvas when window is resized
  const resizeObserver = new ResizeObserver(() => {
    const width = window.innerWidth * window.devicePixelRatio;
    const height = window.innerHeight * window.devicePixelRatio;
    
    canvas.width = width;
    canvas.height = height;

    for (let pipeline of PipelineData.resizedHooks) {
      pipeline.hook(EngineData);
    }

  });

  resizeObserver.observe(window.document.body);

  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();

  if (!context) {
    return Err('WebGPU context not found.');
  }

  const width = canvas.width;
  const height = canvas.height;
  const canvasSize = { width, height };

  context.configure({
    device: device,
    format: format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    alphaMode: 'opaque',
  });

  return Ok({ adapter, device, context, format, canvasSize });
});
