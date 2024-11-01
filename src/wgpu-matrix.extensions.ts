import { BaseArgType, quat as quatLib, RotationOrder } from 'wgpu-matrix';

const fromEulerDegree = <T extends BaseArgType = Float32Array>(xAngleInDegrees: number, yAngleInDegrees: number, zAngleInDegrees: number, order: RotationOrder = 'xyz', dst?: T | undefined) => {
  const x = xAngleInDegrees * Math.PI / 180;
  const y = yAngleInDegrees * Math.PI / 180;
  const z = zAngleInDegrees * Math.PI / 180;
  return quat.fromEuler(x, y, z, order, dst);
};

export * from 'wgpu-matrix';

export const quat = {
  ...quatLib,
  fromEulerDegree,
};

