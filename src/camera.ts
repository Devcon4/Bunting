import { mat4, vec2 } from 'gl-matrix';
import { Err, Ok, Result } from './errorHandling';
import { IdentityTransform, Transform } from './transform';
import { uuid } from './uuid';

const CameraData: {
  cameras: Map<uuid, Camera>,
  current: uuid
} = {
  cameras: new Map<uuid, Camera>(),
} as any;

export const GetCamera = Result(async (cameraId?: uuid) => {
  if (!cameraId) {
    cameraId = CameraData.current;
  }

  if (!CameraData.cameras.has(cameraId)) {
    return Err(`Camera: ${cameraId} does not exist.`);
  }

  return Ok(CameraData.cameras.get(cameraId));
});

export const SetCurrentCamera = Result(async (cameraId: uuid) => {
  if (!CameraData.cameras.has(cameraId)) {
    return Err(`Camera: ${cameraId} does not exist.`);
  }

  CameraData.current = cameraId;
  return Ok(CameraData.current);
});

export const CreateCamera = Result(async (camera: Partial<Camera>) => {
  const newCamera: Camera = {
    ...DefaultCamera,
    ...camera
  };

  CameraData.cameras.set(newCamera.cameraId, newCamera);

  if (!CameraData.current) {
    const res = await SetCurrentCamera(newCamera.cameraId);

    if (!res.Ok) {
      return Err('Error setting current camera.', res.Error);
    }
  }

  return Ok(newCamera);
});

export type Camera = {
  cameraId: uuid,
  transform: Transform,
  Fov: number,
  Near: number,
  Far: number,
  Aspect: number,
  viewport: vec2
};

export const CameraView = (camera: Camera): mat4 => {
  return mat4.invert(mat4.create(), CameraInveseView(camera));
};

export const CameraProjection = (camera: Camera): mat4 => {
  const fov = camera.Fov * Math.PI / 180; // convert fov to radians
  return mat4.perspective(mat4.create(), fov, camera.Aspect, camera.Near, camera.Far);
};

export const CameraInveseView = (camera: Camera): mat4 => {
  return mat4.fromRotationTranslationScale(mat4.create(), camera.transform.rotation, camera.transform.translation, camera.transform.scale);
};

export const CameraInverseProjection = (camera: Camera): mat4 => {
  return mat4.invert(mat4.create(), CameraProjection(camera));
};

export const DefaultCamera: Camera = {
  cameraId: uuid(),
  transform: IdentityTransform,
  Fov: 90,
  Near: 0.1,
  Far: 1000,
  Aspect: 16 / 9,
  viewport: vec2.fromValues(1080, 720)
};