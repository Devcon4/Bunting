import { Light } from '../light';
import { uuid } from '../uuid';
import { ImageGroup } from './cubePipeline';


export const LightingData: {
  lights: Map<uuid, Light>;
  lightingFinal: ImageGroup;
  sampler: GPUSampler;
  pipeline: GPURenderPipeline;
  gbufferGroupLayout: GPUBindGroupLayout;
  uboGroupLayout: GPUBindGroupLayout;
  lightGroupLayout: GPUBindGroupLayout;
  gbufferGroup: GPUBindGroup;
  uboGroup: GPUBindGroup;
  ubo: GPUBuffer;
} = { lights: new Map<uuid, Light>() } as any;
