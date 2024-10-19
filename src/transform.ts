import { mat4, quat, vec3 } from 'gl-matrix';

export type Transform = {
	translation: vec3;
	rotation: quat;
	scale: vec3;
};

export const TransformMatrix = (transform: Transform): mat4 => {
	const res = mat4.create();

	mat4.fromRotationTranslationScale(
		res,
		transform.rotation,
		transform.translation,
		transform.scale
	);
	return res;
};

export const MultiplyTransforms = (a: Transform, b: Transform): Transform => {
	const res = IdentityTransform();

	// add translations, multiply rotations, multiply scales
	vec3.add(res.translation, a.translation, b.translation);
	quat.multiply(res.rotation, a.rotation, b.rotation);
	vec3.multiply(res.scale, a.scale, b.scale);

	return res;
};

export const IdentityTransform = (): Transform => ({
	translation: vec3.create(),
	rotation: quat.create(),
	scale: vec3.fromValues(1, 1, 1),
});
