import {
  CreateCamera,
  GetCamera,
  UpdateCamera
} from '../camera';
import { Ecs } from '../Ecs';
import { EngineData } from '../engine';
import { Err, Ok, Result } from '../errorHandling';
import { CreateLight } from '../light';
import LoadModel from '../model';
import { GeometryData } from '../pipelines/GeometryData';
import { IdentityTransform } from '../transform';
import { quat, vec3 } from '../wgpu-matrix.extensions';


Ecs.RegisterInit({ name: 'InitialSystem' })(
	Result(async (data: EngineData) => {
		console.log('Initial system initializing...');
		const camera = await CreateCamera({
			transform: {
        ...IdentityTransform(),
				translation: vec3.fromValues(0, 0, -4),
				rotation: quat.fromEulerDegree(0, 0, 0), // looking down the y-axis
			},
		});

		if (!camera.Ok) {
			return Err('Error creating camera :: ', camera.Error);
		}

		const helmetRes = await LoadModel(
			'http://localhost:6010/models/damagedHelmet/DamagedHelmet.gltf'
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
      scale: vec3.fromValues(1, 1, 1),
			translation: vec3.fromValues(0, 0, 0),
			rotation: quat.fromEulerDegree(180, 0, 0),
		};

    helmet.transform = {
      scale: vec3.fromValues(1, 1, 1),
      rotation: quat.fromEulerDegree(180,0,0),
      translation: vec3.fromValues(0,0,0),
    };

    const lightRes = await CreateLight(
      {
        ...IdentityTransform(),
      },
      [1, 0, 0, 1],
      1,
    )

    // quat.rotateX(helmet.transform.rotation, helmet.transform.rotation, 40 * Math.PI / 180);

    // const logNode = (node: ModelNode) => {
    //   console.log('node :: ', node.transform);
    //   if (node.children) {
    //     node.children.forEach(logNode);
    //   }
    // };

    // console.log('model :: ', helmet.transform);
    // for (const node of helmet.nodes) {
    //   logNode(node);
    // }



    // const helmet2res = await LoadModel(
		// 	'http://localhost:6010/models/BarramundiFish.glb'
		// );

    // if (!helmet2res.Ok) {
    //   return Err('Error loading helmet model :: ', helmet2res.Error);
    // }

    // const helmet2 = helmet2res.Value

    // helmet2.transform = {
    //   ...IdentityTransform(),
    //   translation: [0, 0, 0],
    //   rotation: quat.fromEuler(quat.create(), 0, 0, 0),
    // };

		// GeometryData.models.push(plane);
		GeometryData.models.push(helmet);

		// console.log('helmet', helmet);
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

		// quat.multiply(
		// 	camera.transform.rotation,
		// 	camera.transform.rotation,
		// 	quat.fromEuler(quat.create(), 0.1, 0, 0)
		// );
		// quat.multiply(
		// 	camera.transform.rotation,
		// 	camera.transform.rotation,
		// 	quat.fromEuler(quat.create(), 0, 0, 0)
		// );

    // quat.multiply(
    //   helmet.transform.rotation,
    //   helmet.transform.rotation,
    // );
    quat.rotateY(helmet.transform.rotation, .01, helmet.transform.rotation);
    // quat.rotateY(camera.transform.rotation, 0.01, camera.transform.rotation);
    
		// vec3.add(
		// 	helmet.transform.translation,
		// 	helmet.transform.translation,
		// 	[0, 0.1, -0.1]
		// );

		// GeometryData.models[0] = helmet;

		UpdateCamera(camera);

		return Ok(data);
	})
);
