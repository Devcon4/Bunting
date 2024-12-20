import { Err, Ok, Result } from './errorHandling';
import { IdentityTransform, Transform } from './transform';
import { uuid } from './uuid';
import { Mat4, mat4, vec2, Vec2, vec3 } from './wgpu-matrix.extensions';

const CameraData: {
	cameras: Map<uuid, Camera>;
	current: uuid;
} = {
	cameras: new Map<uuid, Camera>(),
} as any;

export const ResizeCameras = Result(async (viewport: Vec2) => {
	for (const camera of CameraData.cameras.values()) {
		camera.Aspect = viewport[0] / viewport[1];
		camera.viewport = viewport;

		const res = await UpdateCamera(camera);

		if (!res.Ok) {
			return Err('Error updating camera :: ', res.Error);
		}
	}
	return Ok(viewport);
});

export const GetCamera = Result(async (cameraId?: uuid) => {
	if (!cameraId) {
		cameraId = CameraData.current;
	}

	if (!CameraData.cameras.has(cameraId)) {
		return Err(`Camera: ${cameraId} does not exist.`);
	}

	return Ok(CameraData.cameras.get(cameraId));
});

export const UpdateCamera = Result(async (camera: Camera) => {
	if (!CameraData.cameras.has(camera.cameraId)) {
		return Err(`Camera: ${camera.cameraId} does not exist.`);
	}

	CameraData.cameras.set(camera.cameraId, camera);
	return Ok(camera);
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
		...camera,
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
	cameraId: uuid;
	transform: Transform;
	Fov: number;
	Near: number;
	Far: number;
	Aspect: number;
	viewport: Vec2;
};

export const CameraView = (camera: Camera): Mat4 => {

  const eye = camera.transform.translation;
  const forward = vec3.transformQuat(vec3.fromValues(0, 0, -1), camera.transform.rotation);
  const up = vec3.transformQuat(vec3.fromValues(0, 1, 0), camera.transform.rotation);

  // console.log('eye', eye);
  // console.log('forward', forward);
  // console.log('up', up);

  const res = mat4.lookAt(eye, vec3.add(eye, forward), up);

  // console.log('res', res);

  return res;
};

export const CameraProjection = (camera: Camera): Mat4 => {
	const fov = (camera.Fov * Math.PI) / 180; // convert fov to radians
  return mat4.perspective(fov, camera.Aspect, camera.Near, camera.Far);
};

export const CameraInverseView = (camera: Camera): Mat4 => {
  return mat4.invert(CameraView(camera));
};

export const CameraInverseProjection = (camera: Camera): Mat4 => {
  return mat4.invert(CameraProjection(camera));
};

export const DefaultCamera: Camera = {
	cameraId: uuid(),
	transform: IdentityTransform(),
	Fov: 45,
	Near: 0.1,
	Far: 1000,
	Aspect: 16 / 9,
	viewport: vec2.fromValues(1080, 720),
};
