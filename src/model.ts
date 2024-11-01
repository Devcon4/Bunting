import {
  Accessor,
  Material,
  Node,
  NodeIO,
  Texture,
  TextureInfo,
  TypedArray,
} from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { EngineData } from './engine';
import { Err, Ok, Result } from './errorHandling';
import { CubeData } from './pipelines/CubeData';
import { IdentityTransform, Transform } from './transform';
import { uuid } from './uuid';
import { quat, vec2, Vec2, vec3, Vec3, Vec4 } from './wgpu-matrix.extensions';

export type BuntingImage = {
	image: GPUTexture;
	sampler: GPUSampler;
	view: GPUTextureView;
};

export type ModelPrimitive = {
	firstIndex: number;
	indexCount: number;
	materialIndex: number;
};

// export type ModelTexture = {
//   textureIndex: number,
//   // samplerIndex: number
// };

export type ModelMaterial = {
	name: string;
	albedoImage: BuntingImage;
	normalImage: BuntingImage;
	metallicRoughnessImage: BuntingImage;
	emissiveImage?: BuntingImage;
	materialGroup: GPUBindGroup;
};

export type ModelNode = {
	transform: Transform;
	primitives: ModelPrimitive[];
	children: ModelNode[];
};

export type ModelVertex = {
	position: Vec3;
	normal: Vec3;
	uv: Vec2;
};

export type Model = {
	modelId: uuid;
	transform: Transform;
	// textures: ModelTexture[],
	materials: ModelMaterial[];
	nodes: ModelNode[];
	vertices: GPUBuffer;
	indices: GPUBuffer;
	vertexCount: number;
};

const getLocalTransform = (node: Node): Transform => {
	const translation = node.getTranslation();
	const rotation = node.getRotation();
	const scale = node.getScale();

	return {
		translation: vec3.fromValues(translation[0], translation[1], translation[2]),
    rotation: quat.fromValues(rotation[0], rotation[1], rotation[2], rotation[3]),
		scale: vec3.fromValues(scale[0], scale[1], scale[2]),
	};
};

const normalizeAccessor = (
  accessor: Accessor | null,
  targets: [number[], number[]] = [[0, 0], [1, 1]],
  defaultValue: TypedArray = new Float32Array(0),
  minMax: [number[], number[]] = [[0, 0], [1, 1]],
): ((index: number) => number) => {
  const array = accessor?.getArray() || defaultValue;
  // console.log('accessor', array);
  const [minDefault, maxDefault] = minMax;
  const [targetMin, targetMax] = targets;

  const min = accessor?.getMin(targetMin) || minDefault;
  const max = accessor?.getMax(targetMax) || maxDefault;
  // console.log('min', min);
  // console.log('max', max);

  return (index: number) => {
    const mini = min[index % min.length];
    const maxi = max[index % max.length];
    const targetMini = targetMin[index % targetMin.length];
    const targetMaxi = targetMax[index % targetMax.length];

    const normalizedValue = (array[index] - mini) / (maxi - mini);
    // const mappedValue = normalizedValue * (targetMax[index % targetMax.length] - targetMin[index % targetMin.length]) + targetMin[index % targetMin.length];
    const mappedValue = normalizedValue * (targetMaxi - targetMini) + targetMini;
    // return mappedValue;
    return normalizedValue;
    // return vec2.fromValues(array[offset], array[offset + 1]);
  };
};

const LoadModel = Result(async (path: string) => {
	const io = new NodeIO(window.fetch.bind(window))
    .registerExtensions(ALL_EXTENSIONS)
	  .setAllowNetwork(true)
	  .setLogger(console)
	const modelFile = await io.read(path);

  // await modelFile.transform(normals());

	const root = modelFile.getRoot();
	const nodes = root.listNodes();
	const rawMats = root.listMaterials();
	const childNodes = [];

	const meshVertices: ModelVertex[] = [];
	const meshIndices: number[] = [];

	const emptyImage = Result(async (colorFactor?: Vec4) => {
		const tex = EngineData.device.createTexture({
			label: 'Empty Texture',
			size: { width: 1, height: 1, depthOrArrayLayers: 1 },
			format: EngineData.format,
			usage:
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.RENDER_ATTACHMENT |
				GPUTextureUsage.COPY_DST,
		});

		const data = new Float32Array(colorFactor || [0, 0, 0, 1]);

		EngineData.device.queue.writeTexture(
			{ texture: tex },
			data,
			{ offset: 0, bytesPerRow: 4, rowsPerImage: 1 },
			{ width: 1, height: 1, depthOrArrayLayers: 1 }
		);

		const sampler = EngineData.device.createSampler({
			label: 'Empty Sampler',
			magFilter: 'linear',
			minFilter: 'linear',
			addressModeU: 'clamp-to-edge',
			addressModeV: 'clamp-to-edge',
			mipmapFilter: 'linear',
			addressModeW: 'repeat',
		});

		const view = tex.createView({
			label: 'Empty Texture View',
		});

		const res: BuntingImage = {
			image: tex,
			sampler,
			view,
		};

		return Ok(res);
	});

	const loadImage = Result(
		async (textureInfo: TextureInfo, texture: Texture) => {
			const texName = textureInfo.getName() || 'Unnamed Texture';
			const size = texture.getSize();

			const imageData = texture.getImage();

			if (!imageData) {
				return Err('No image data found.');
			}

			const blobData = new Blob([imageData], { type: texture.getMimeType() });

			const data = await createImageBitmap(blobData);

			if (!data) {
				return Err('No image data found.');
			}

			if (!size) {
				return Err('No image size found.');
			}

			const [width, height] = size;

			const tex = EngineData.device.createTexture({
				label: `Model Texture: ${texName}`,
				size: { width, height, depthOrArrayLayers: 1 },
				format: EngineData.format,
				usage:
					GPUTextureUsage.TEXTURE_BINDING |
					GPUTextureUsage.RENDER_ATTACHMENT |
					GPUTextureUsage.COPY_DST,
			});

			EngineData.device.queue.copyExternalImageToTexture(
				{ source: data },
				{ texture: tex },
				{ width, height, depthOrArrayLayers: 1 }
			);

			// const magFilter: GPUFilterMode = textureInfo.getMagFilter() as unknown as GPUFilterMode || 'linear';
			// const minFilter: GPUFilterMode = textureInfo.getMinFilter() as unknown as GPUFilterMode || 'linear';
			// const addressModeU: GPUAddressMode = textureInfo.getWrapS() as unknown as GPUAddressMode || 'repeat';
			// const addressModeV: GPUAddressMode = textureInfo.getWrapT() as unknown as GPUAddressMode || 'repeat';

			// const sampler = EngineData.device.createSampler({
			//   label: `Model Sampler: ${texName}`,
			//   magFilter,
			//   minFilter,
			//   addressModeU: 'clamp-to-edge',
			//   addressModeV: 'clamp-to-edge',
			//   mipmapFilter: 'linear',
			//   addressModeW: 'repeat',
			// });

			const view = tex.createView({
				label: `Model Texture View: ${texName}`,
			});

			const res: BuntingImage = {
				image: tex,
				// sampler,
				view,
			} as BuntingImage;

			return Ok(res);
		}
	);

	const loadImageOrDefault = Result(
		async (
			textureInfo: TextureInfo | null,
			texture: Texture | null,
			colorFactor?: Vec4
		) => {
			if (!textureInfo || !texture) {
				return await emptyImage(colorFactor);
			}

			return await loadImage(textureInfo, texture);
		}
	);

	const loadNode = Result(async <T>(node: Node) => {
		const mesh = node.getMesh();

		const ModelNode: ModelNode = {
			transform: getLocalTransform(node),
			primitives: [],
			children: [],
		};

		for (const primitive of mesh?.listPrimitives() || []) {
			// console.log('semantics', primitive.listSemantics());
			const posAccessor = primitive.getAttribute('POSITION');
			const normAccessor = primitive.getAttribute('NORMAL')?.setNormalized(true);
			const uvAccessor = primitive.getAttribute('TEXCOORD_0');
			const indicesAccessor = primitive.getIndices();
			const material = primitive.getMaterial();

			if (!posAccessor) {
				return Err('POSITION attribute not found.');
			}

			if (!indicesAccessor) {
				return Err('Indices not found.');
			}

			if (!normAccessor) {
				return Err('NORMAL attribute not found.');
			}

      const verticesCount = posAccessor.getCount();
			// const vertices = normalizeAccessor(posAccessor, [[-1, -1, -1], [1, 1, 1]]);
      const vertexData = posAccessor.getArray() as Float32Array;
      const vertices = (index: number) => vertexData[index];
  
			const defaultUV = new Float32Array((verticesCount / 3) * 2);
			if (!uvAccessor) {
				for (let i = 0; i < vertices.length / 3; i++) {
					const x = vertices(i * 3);
          const y = vertices(i * 3 + 1);
					defaultUV[i * 2] = (x + 1) / 2; // U coordinate
					defaultUV[i * 2 + 1] = (y + 1) / 2; // V coordinate
				}
			}

			if (!material) {
				return Err('Material not found.');
			}

			// const normals = normalizeAccessor(normAccessor, [[-1, -1, -1], [1, 1, 1]]);
      const normalData = normAccessor.getArray() as Float32Array;
      const normals = (index: number) => normalData[index];
			const uvs = normalizeAccessor(uvAccessor, [[0,0], [1, 1]], defaultUV);
			const indices = indicesAccessor.getArray() as Uint16Array;

      const vertexCount = posAccessor.getArray()?.length || 0 / 3;

      for (let i = 0; i < vertexCount; i++) {
        // const position = vec3.fromValues(
        //   vertices[i * 3],
        //   vertices[i * 3 + 1],
        //   vertices[i * 3 + 2]
        // );

        const offset = i * 3 ;

        const position = vec3.fromValues(
          vertices(offset),
          vertices(offset + 1),
          vertices(offset + 2)
        );

        // const normal = vec3.fromValues(
        //   normals[offset],
        //   normals[offset + 1],
        //   normals[offset + 2]
        // );

        const normal = vec3.fromValues(
          normals(offset),
          normals(offset + 1),
          normals(offset + 2)
        );
        

        const uv = vec2.fromValues(uvs(i * 2), uvs(i * 2 + 1));
        // const uv = vec2.fromValues(uvs(i * 2), uvs(i * 2 + 1));

        meshVertices.push({
          position,
          normal,
          uv
        });
      }

      console.log('normals', normAccessor.getArray());

      console.log('vertices', meshVertices);

			for (let i = 0; i < indices.length; i++) {
				meshIndices.push(indices[i]);
			}

			const materialIndex = rawMats.indexOf(material);

			ModelNode.primitives.push({
				firstIndex: meshIndices.length - indices.length,
				indexCount: indices.length,
				materialIndex,
			});
		}

		for (const child of node.listChildren()) {
			const result = (await loadNode(child)) as Result<ModelNode, T>;
			if (!result.Ok) {
				return Err('Error loading child node :: ', result.Error);
			} else {
				ModelNode.children.push(result.Value);
			}
		}

		return Ok(ModelNode);
	});

	for (const node of nodes) {
		const result = await loadNode(node);
		if (!result.Ok) {
			return Err(result.Error);
		}

		childNodes.push(result.Value);
	}

	const vertexSize = 12 + 12 + 8;
	const vertexBuffer = EngineData.device.createBuffer({
		label: 'Model Vertex Buffer',
		size: meshVertices.length * vertexSize,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	});

	// const vertexData = new Float32Array(meshVertices.length * 8); // 3 position, 3 normal, 2 uv floats

  const vertexBufferData = new Float32Array(meshVertices.length * 8);

  meshVertices.forEach((v, i) => {
    vertexBufferData.set([
      ...v.position,
      ...v.normal,
      ...v.uv
    ], i * 8);
  });

  console.log('vertexData', vertexBufferData);

	// for (let i = 0; i < meshVertices.length; i++) {
	// 	const v = meshVertices[i];
	// 	const offset = (i * 8);

  //   vertexData.set([
  //     v.position[0],
  //     v.position[1],
  //     v.position[2],
  //     v.normal[0],
  //     v.normal[1],
  //     v.normal[2],
  //     v.uv[0],
  //     v.uv[1]
  //   ], offset);

	// 	// vertexData.set(v.position, offset);
	// 	// vertexData.set(v.normal, offset + 3);
	// 	// vertexData.set(v.uv, offset + 6);
	// }

  EngineData.device.queue.writeBuffer(vertexBuffer, 0, vertexBufferData.buffer);

	// new Float32Array(vertexBuffer.getMappedRange()).set(vertexData);
	// vertexBuffer.unmap();

  const indexData = new Uint16Array(meshIndices);

	const indexBuffer = EngineData.device.createBuffer({
		label: 'Model Index Buffer',
		size: indexData.byteLength,
		usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
	});

  EngineData.device.queue.writeBuffer(indexBuffer, 0, indexData.buffer);

	// new Uint16Array(indexBuffer.getMappedRange()).set(meshIndices);
	// indexBuffer.unmap();

	// const textures = root.listTextures().map<ModelTexture>((t, i) => ({textureIndex: i}));
	const loadMaterial = Result(async (material: Material) => {
		const [albedoTex, albedoTexInfo] = [
			material.getBaseColorTexture(),
			material.getBaseColorTextureInfo(),
		];
		const [normalTex, normalTexInfo] = [
			material.getNormalTexture(),
			material.getNormalTextureInfo(),
		];
		const [metallicRoughnessTex, metallicRoughnessTexInfo] = [
			material.getMetallicRoughnessTexture(),
			material.getMetallicRoughnessTextureInfo(),
		];
		const [emissiveTex, emissiveTexInfo] = [
			material.getEmissiveTexture(),
			material.getEmissiveTextureInfo(),
		];
    const baseColorFactor = material.getBaseColorFactor();
    const colorArr = new Float32Array(baseColorFactor || [0, 0, 0, 1]);
		const albedoImage = await loadImageOrDefault(
			albedoTexInfo,
			albedoTex,
      colorArr
		);
		const normalImage = await loadImageOrDefault(normalTexInfo, normalTex);
		const emissiveImage = await loadImageOrDefault(
			emissiveTexInfo,
			emissiveTex
		);
		const metallicRoughnessImage = await loadImageOrDefault(
			metallicRoughnessTexInfo,
			metallicRoughnessTex
		);

		if (!albedoImage.Ok) {
			return Err('Error loading albedo texture :: ', albedoImage.Error);
		}

		if (!normalImage.Ok) {
			return Err('Error loading normal texture :: ', normalImage.Error);
		}

		if (!metallicRoughnessImage.Ok) {
			return Err(
				'Error loading metallic roughness texture :: ',
				metallicRoughnessImage.Error
			);
		}

		if (!emissiveImage.Ok) {
			return Err('Error loading emissive texture :: ', emissiveImage.Error);
		}

		const materialGroup = EngineData.device.createBindGroup({
			layout: CubeData.materialGroupLayout,
			entries: [
				{ binding: 0, resource: albedoImage.Value.view },
				{ binding: 1, resource: normalImage.Value.view },
				{ binding: 2, resource: emissiveImage.Value.view },
				{ binding: 3, resource: metallicRoughnessImage.Value.view },
				{ binding: 4, resource: CubeData.sampler },
			],
		});

		const res: ModelMaterial = {
			name: material.getName() || 'Unnamed Material',
			albedoImage: albedoImage.Value,
			normalImage: normalImage.Value,
			emissiveImage: emissiveImage?.Value,
			metallicRoughnessImage: metallicRoughnessImage.Value,
			materialGroup,
		};

		return Ok(res);
	});

	const materials: ModelMaterial[] = [];

	for (const material of rawMats) {
		const result = await loadMaterial(material);
		if (!result.Ok) {
			return Err('Error loading material :: ', result.Error);
		}

		materials.push(result.Value);
	}

	const model: Model = {
		modelId: uuid(),
		transform: IdentityTransform(),
		materials,
		// textures,
		nodes: childNodes,
		vertices: vertexBuffer,
		indices: indexBuffer,
		vertexCount: meshVertices.length,
	};

	return Ok(model);
});

export default LoadModel;
