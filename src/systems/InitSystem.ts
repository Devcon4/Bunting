import { quat } from 'gl-matrix';
import {
	CameraProjection,
	CameraView,
	CreateCamera,
	GetCamera,
} from '../camera';
import { Ecs } from '../Ecs';
import { EngineData } from '../engine';
import { Err, Ok, Result } from '../errorHandling';
import LoadModel from '../model';
import { GeometryData } from '../pipelines/geometryPipeline';
import { IdentityTransform } from '../transform';

Ecs.RegisterInit({ name: 'InitialSystem' })(
	Result(async (data: EngineData) => {
		console.log('Initial system initializing...');
		const camera = await CreateCamera({
			transform: {
				...IdentityTransform(),
				translation: [0, 0, -200],
				rotation: quat.fromEuler(quat.create(), 0, 0, 0), // looking down the y-axis
			},
		});

		if (!camera.Ok) {
			return Err('Error creating camera :: ', camera.Error);
		}

		const view = CameraView(camera.Value);
		console.log('view', view);
		const projection = CameraProjection(camera.Value);
		console.log('projection', projection);

		const helmetRes = await LoadModel(
			'http://localhost:6010/models/DamagedHelmet.glb'
		);

		if (!helmetRes.Ok) {
			return Err('Error loading helmet model :: ', helmetRes.Error);
		}

		const planeRes = await LoadModel(
			'http://localhost:6010/models/test_plane_old.glb'
		);

		if (!planeRes.Ok) {
			return Err('Error loading plane model :: ', planeRes.Error);
		}

		const helmet = helmetRes.Value;
		const plane = planeRes.Value;

		plane.transform = {
			...IdentityTransform(),
			translation: [0, 0, 0],
			rotation: quat.fromEuler(quat.create(), 0, 0, 0),
		};

		GeometryData.models.push(helmet);
		GeometryData.models.push(plane);

		console.log('helmet', helmet);
		// console.log('plane', plane);
		return Ok(data);
	})
);

Ecs.RegisterJob({ name: 'Init System' })(
	Result(async (data: EngineData) => {
		const helmet = GeometryData.models[0];

		const cameraRes = await GetCamera();

		if (!cameraRes.Ok) {
			return Err('Error getting camera :: ', cameraRes.Error);
		}

		const camera = cameraRes.Value;

		if (!helmet) {
			return Err('Helmet model not found');
		}

		quat.multiply(
			camera.transform.rotation,
			camera.transform.rotation,
			quat.fromEuler(quat.create(), 0.1, 0, 0)
		);

		// vec3.add(
		// 	helmet.transform.translation,
		// 	helmet.transform.translation,
		// 	[0, 0.1, -0.1]
		// );

		GeometryData.models[0] = helmet;

		// UpdateCamera(camera);

		return Ok(data);
	})
);
