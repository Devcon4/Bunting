import { Model } from '../model';

export type GBufferImage = {
	view: GPUTextureView;
	texture: GPUTexture;
};

export const GeometryData: {
  pipeline: GPURenderPipeline;
  uboGroup: GPUBindGroup;
  gbufferGroup: GPUBindGroup;
  sampler: GPUSampler;
  depth: GBufferImage;
  materialGroupLayout: GPUBindGroupLayout;
  GBuffer: {
    albedo: GBufferImage;
    normal: GBufferImage;
    emissive: GBufferImage;
    metalicRoughnessAO: GBufferImage;
  };
  ubo: GPUBuffer;
  models: Model[];
} = {
  models: [],
} as any;
