import { DefaultLifecycleHooks, LifecycleData, LifecycleExports, LifecycleMetadata, RegisterLifecycleFunc } from './engine';

export type PipelineLifecycleHooks = DefaultLifecycleHooks | 'resized';


export const PipelineData: LifecycleData<PipelineLifecycleHooks> = {
  initHooks: [],
  afterInitHooks: [],
  resizedHooks: [],
  runHooks: [],
  cleanupHooks: []
};
const RegisterPipelineLifecycle = (hook: PipelineLifecycleHooks): RegisterLifecycleFunc => metadata => func => {
  const meta = {
    priority: 1024,
    ...metadata
  } as LifecycleMetadata;

  // higher priority hooks run first
  PipelineData[`${hook}Hooks`] = [...PipelineData[`${hook}Hooks`], { metadata: meta, hook: func }].sort((a, b) => a.metadata.priority - b.metadata.priority);
};

export const Pipeline: LifecycleExports<PipelineLifecycleHooks> = {
  RegisterInit: RegisterPipelineLifecycle('init'),
  RegisterAfterInit: RegisterPipelineLifecycle('afterInit'),
  RegisterResized: RegisterPipelineLifecycle('resized'),
  RegisterRun: RegisterPipelineLifecycle('run'),
  RegisterCleanup: RegisterPipelineLifecycle('cleanup'),
};


