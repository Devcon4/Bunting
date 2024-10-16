import { EngineData } from '../engine';
import { Err, Ok, Result } from '../errorHandling';
import { Module } from '../Module';
import { PipelineData } from '../Pipeline';

Module.RegisterInit({name: 'renderModule'})(Result(async (data: EngineData) => {
  console.log('Render module initializing...');
    

    for (let pipeline of PipelineData.initHooks) {
      const res = await pipeline.hook(data);

      if (!res.Ok) {
        return Err('Pipeline initialization failed :: ', res.Error);
      }

      if (!res.Value) {
        return Err(`No data returned from pipeline: ${pipeline.metadata.name} initialization.`);
      }

      data = res.Value as EngineData;
    }

    return Ok(data);
}));

Module.RegisterRun({name: 'renderModule'})(Result(async (data: EngineData) => {
  for (let pipeline of PipelineData.runHooks) {
    const res = await pipeline.hook(data);

    if (!res.Ok) {
      return Err('Pipeline run failed :: ', res.Error);
    }
  }

  return Ok();
}));

Module.RegisterCleanup({name: 'renderModule'})(Result(async (data: EngineData) => {
  console.log('Render module cleaning up...');

  for (let pipeline of PipelineData.cleanupHooks) {
    await pipeline.hook(data);
  }

  return Ok();
}));
