import { DefaultLifecycleHooks, LifecycleData, LifecycleExports, LifecycleMetadata, RegisterLifecycleFunc } from './engine';


export const ModuleData: LifecycleData = {
  initHooks: [],
  afterInitHooks: [],
  runHooks: [],
  cleanupHooks: []
};
const RegisterModuleLifecycle = (hook: DefaultLifecycleHooks): RegisterLifecycleFunc => metadata => func => {
  const meta = {
    priority: 1024,
    ...metadata
  } as LifecycleMetadata;

  // higher priority hooks run first
  ModuleData[`${hook}Hooks`] = [...ModuleData[`${hook}Hooks`], { metadata: meta, hook: func }].sort((a, b) => b.metadata.priority - a.metadata.priority);
};

export const Module: LifecycleExports = {
  RegisterInit: RegisterModuleLifecycle('init'),
  RegisterAfterInit: RegisterModuleLifecycle('afterInit'),
  RegisterRun: RegisterModuleLifecycle('run'),
  RegisterCleanup: RegisterModuleLifecycle('cleanup'),
};
