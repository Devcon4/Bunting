import { EcsData } from '../Ecs';
import { Module } from '../Module';
import { EngineData } from '../engine';
import { Err, Ok, Result } from '../errorHandling';


Module.RegisterAfterInit({name: 'ecsModule', priority: 512})(Result(async (data: EngineData) => {
  console.log('Render module after initializing...');

    // ecs system init happen in module afterInit. This is so that the engine is setup before the systems are initialized.
    for (let pipeline of EcsData.initHooks) {
      const res = await pipeline.hook(data);

      if (!res.Ok) {
        return Err('Pipeline initialization failed :: ', res.Error);
      }

      data = res.Value as EngineData;
    }

    return Ok(data);
}));

Module.RegisterRun({name: 'ecsModule'})(Result(async (data: EngineData) => {
  for (let pipeline of EcsData.jobHooks) {
    const res = await pipeline.hook(data); // update to run each matching entity.

    if (!res.Ok) {
      return Err('Pipeline run failed :: ', res.Error);
    }
  }

  return Ok();
}));

Module.RegisterCleanup({name: 'ecsModule'})(Result(async (data: EngineData) => {
  console.log('Render module cleaning up...');

  for (let pipeline of EcsData.cleanupHooks) {
    await pipeline.hook(data);
  }

  return Ok();
}));
