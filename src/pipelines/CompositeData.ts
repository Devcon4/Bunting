
export const CompositeData: {
  pipeline: GPURenderPipeline;
  gbufferGroup: GPUBindGroup;
  gbufferGroupLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
  final: {
    image: GPUTexture;
    view: GPUTextureView;
  };
} = {} as any;
