import { Mat4, mat4, quat, Quat, vec3, Vec3 } from './wgpu-matrix.extensions';

export type Transform = {
	translation: Vec3;
	rotation: Quat;
	scale: Vec3;
};

export const TransformMatrix = (transform: Transform): Mat4 => {

  const translation = mat4.translation(transform.translation);
  const rot = mat4.fromQuat(quat.normalize(transform.rotation));
  const scale = mat4.scaling(transform.scale);

  // console.log('translation', translation);
  // console.log('rot', rot);
  // console.log('scale', scale);

  // mat4.multiply(res, translation, rot);
  // mat4.multiply(res, res, scale);

  const res = mat4.multiply(mat4.multiply(translation, rot), scale);
  return res;

	// mat4.fromRotationTranslationScale(
	// 	res,
	// 	transform.rotation,
	// 	transform.translation,
	// 	transform.scale
	// );
};

// export const MultiplyTransforms = (a: Transform, b: Transform): Transform => {
// 	const res = IdentityTransform();

// 	// add translations, multiply rotations, multiply scales
// 	vec3.add(res.translation, a.translation, b.translation);
// 	quat.multiply(res.rotation, a.rotation, b.rotation);
// 	vec3.multiply(res.scale, a.scale, b.scale);

// 	return res;
// };

export const MultiplyTransforms = (a: Transform, b: Transform): Transform => {
  const aMat = TransformMatrix(a);
  const bMat = TransformMatrix(b);

  const mult = mat4.multiply(aMat, bMat);
  return MatrixTransform(mult);
}

export const IdentityTransform = (): Transform => ({
	translation: vec3.create(),
  rotation: quat.identity(),
	scale: vec3.fromValues(1, 1, 1),
});

export const MatrixTransform = (matrix: Mat4): Transform => {
  const res = IdentityTransform();

  mat4.getTranslation(matrix, res.translation);
  quat.fromMat(matrix, res.rotation);
  mat4.getScaling(matrix, res.scale);

  return res;
};