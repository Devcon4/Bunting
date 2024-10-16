import { quat } from 'gl-matrix';
import { CameraProjection, CameraView, CreateCamera } from '../camera';
import { Ecs } from '../Ecs';
import { EngineData } from '../engine';
import { Err, Ok, Result } from '../errorHandling';
import LoadModel from '../model';
import { Pipeline } from '../Pipeline';
import { GeometryData } from '../pipelines/geometryPipeline';
import { IdentityTransform } from '../transform';

Ecs.RegisterInit({ name: 'InitialSystem'})(Result(async(data: EngineData) => {
  console.log('Initial system initializing...');
  const camera = await CreateCamera({
    transform: {
      ...IdentityTransform,
      translation: [-20,0,10],
      rotation: quat.fromEuler(quat.create(), 180, 0, 0) // looking down the y-axis
    }
  });

  if (!camera.Ok) {
    return Err('Error creating camera :: ', camera.Error);
  }

  const view = CameraView(camera.Value);
  console.log('view', view);
  const projection = CameraProjection(camera.Value);
  console.log('projection', projection);

  const helmetRes = await LoadModel('http://localhost:6010/models/DamagedHelmet.glb');

  if (!helmetRes.Ok)
  {
    return Err('Error loading helmet model :: ', helmetRes.Error);
  }

  const planeRes = await LoadModel('http://localhost:6010/models/test_plane_old.glb');

  if (!planeRes.Ok) {
    return Err('Error loading plane model :: ', planeRes.Error);
  }

  const helmet = helmetRes.Value;
  const plane = planeRes.Value;

  plane.transform = {
    ...IdentityTransform,
    translation: [0,0,0],
    rotation: quat.fromEuler(quat.create(), 0, -90, 0),
  };

  GeometryData.models.push(helmet);
  // GeometryData.models.push(plane);

  console.log('helmet', helmet);
  console.log('plane', plane);
  return Ok(data);
}));

Pipeline.RegisterResized({ name: 'Geometry Pipeline'})(Result(async(data: EngineData) => {
  console.log('Geometry pipeline resized...');

  return Ok(data);
}));