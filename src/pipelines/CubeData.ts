import { Transform } from '../transform';
import { CubeVertex, ImageGroup } from './cubePipeline';


export const CubeData: {
  pipeline: GPURenderPipeline;
  uboGroup: GPUBindGroup;
  ubo: GPUBuffer;
  depth: ImageGroup;
  sampler: GPUSampler;
  mesh: ReturnType<typeof CubeVertex>[];
  meshTransform: Transform;
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
  materialGroupLayout: GPUBindGroupLayout;
  GBuffer: {
    albedo: ImageGroup;
    normal: ImageGroup;
    emissive: ImageGroup;
    metalicRoughnessAO: ImageGroup;
  };
} = {} as any;
