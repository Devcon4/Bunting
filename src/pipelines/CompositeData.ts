
export const CompositeData: {
  pipeline: GPURenderPipeline;
  imageGroup: GPUBindGroup;
  imageGroupLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
  final: {
    image: GPUTexture;
    view: GPUTextureView;
  };
} = {} as any;
