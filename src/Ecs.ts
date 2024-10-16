import { LifecycleData, LifecycleExports, LifecycleMetadata, RegisterLifecycleFunc } from './engine';

type EcsLifecycleHooks = 'init' | 'job' | 'cleanup';

export const EcsData: LifecycleData<EcsLifecycleHooks> = {
  initHooks: [],
  jobHooks: [],
  cleanupHooks: []
};
const RegisterEcsLifecycle = (hook: EcsLifecycleHooks): RegisterLifecycleFunc => metadata => func => {
  const meta = {
    priority: 1024,
    ...metadata
  } as LifecycleMetadata;

  // higher priority hooks run first
  EcsData[`${hook}Hooks`] = [...EcsData[`${hook}Hooks`], { metadata: meta, hook: func }].sort((a, b) => b.metadata.priority - a.metadata.priority);
};

export const Ecs: LifecycleExports<EcsLifecycleHooks> = {
  RegisterInit: RegisterEcsLifecycle('init'),
  RegisterJob: RegisterEcsLifecycle('job'),
  RegisterCleanup: RegisterEcsLifecycle('cleanup'),
};
