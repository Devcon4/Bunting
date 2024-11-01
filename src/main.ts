import createEngine, { EngineData } from './engine';
import { logError } from './errorHandling';
import './style.css';

import './modules/ecsModule';
import './modules/renderModule';

import './pipelines/compositePipeline';
// import './pipelines/geometryPipeline';
import './pipelines/cubePipeline';

import './systems/InitSystem';
// import './pipelines/trianglePipeline';

type BuntingData = EngineData & {};

const main = async () => {
  // functional
  const engine = await createEngine<BuntingData>({});

  if (!engine.Ok) {
    console.group('Engine Failure ::');
    logError(engine.Error);
    console.groupEnd();
    return;
  }

  const final = await engine.Value();

  if (!final.Ok) {
    console.group('Engine Runtime Failure ::');
    logError(final.Error);
    console.groupEnd();
    return;
  }
}

main();