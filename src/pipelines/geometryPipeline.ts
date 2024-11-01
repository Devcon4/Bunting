import { CameraInverseView, CameraProjection, GetCamera } from '../camera';
import { EngineData } from '../engine';
import { Err, Ok, Result } from '../errorHandling';
import { Model, ModelNode } from '../model';
import { Pipeline } from '../Pipeline';
import { MultiplyTransforms, Transform, TransformMatrix } from '../transform';
import { Mat4 } from '../wgpu-matrix.extensions';
import { GeometryData } from './GeometryData';

Pipeline.RegisterResized({ name: 'Geometry Pipeline' })(
	async (data: EngineData) => {
		if (!EngineData.device) {
			// Device not initialized yet
			return Ok(data);
		}

		// wait for the queue to be idle
		await EngineData.device.queue.onSubmittedWorkDone().then(async () => {
			// Resize the gbuffer textures, and depth texture.
			GeometryData.depth?.texture.destroy();
			GeometryData.GBuffer.albedo.texture.destroy();
			GeometryData.GBuffer.normal.texture.destroy();
			GeometryData.GBuffer.emissive.texture.destroy();
			GeometryData.GBuffer.metalicRoughnessAO.texture.destroy();

			const res = await CreateTextures(data);

			if (!res.Ok) {
				return Err('Error creating textures :: ', res.Error);
			}
		});

		return Ok(data);
	}
);

const CreateTextures = Result(async (data: EngineData) => {
	const size = data.canvasSize;

	const depthTexture = data.device.createTexture({
		size,
		label: 'Depth Texture',
		format: 'depth24plus',
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
	});

	const GBufferAlbedo = data.device.createTexture({
		size,
		label: 'GBuffer Albedo',
		format: data.format,
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
	});
  

	const GBufferNormal = data.device.createTexture({
		size,
		label: 'GBuffer Normal',
		format: data.format,
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
	});

	const GBufferEmissive = data.device.createTexture({
		size,
		label: 'GBuffer Emissive',
		format: data.format,
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
	});

	const GBufferMetalicRoughnessAO = data.device.createTexture({
		size,
		label: 'GBuffer MetalicRoughnessAO',
		format: data.format,
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
	});

	const depthView = depthTexture.createView();
	const albedoView = GBufferAlbedo.createView();
	const normalView = GBufferNormal.createView();
	const emissiveView = GBufferEmissive.createView();
	const metalicRoughnessAOView = GBufferMetalicRoughnessAO.createView();

	GeometryData.GBuffer = {
		albedo: { view: albedoView, texture: GBufferAlbedo },
		normal: { view: normalView, texture: GBufferNormal },
		emissive: { view: emissiveView, texture: GBufferEmissive },
		metalicRoughnessAO: {
			view: metalicRoughnessAOView,
			texture: GBufferMetalicRoughnessAO,
		},
	};
	GeometryData.depth = { view: depthView, texture: depthTexture };

	return Ok(data);
});

Pipeline.RegisterInit({ name: 'Geometry Pipeline', priority: 1000 })(
	Result(async (data: EngineData) => {
		console.log('Geometry pipeline initializing...');

		const vertexShaderModule = data.device.createShaderModule({
			label: 'Geometry Vertex Shader Module',
			code: await fetch('./shaders/geometry.vert.wgsl').then((res) =>
				res.text()
			),
		});

		const fragmentShaderModule = data.device.createShaderModule({
			label: 'Geometry Fragment Shader Module',
			code: await fetch('./shaders/geometry.frag.wgsl').then((res) =>
				res.text()
			),
		});

		const vertexBufferLayout: GPUVertexBufferLayout = {
			arrayStride: (3 + 3 + 2) * 4, // 3 floats for position, 3 floats for normal, 2 floats for uv
			attributes: [
				{
					shaderLocation: 0,
					offset: 0,
					format: 'float32x2',
				},
				{
					shaderLocation: 1,
					offset: 3 * 4,
					format: 'float32x2',
				},
				{
					shaderLocation: 2,
					offset: 6 * 4,
					format: 'float32x2',
				},
			],
		};

		const uboGroupLayout = data.device.createBindGroupLayout({
			label: 'Geometry UBO Bind Group Layout',
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {
						type: 'uniform',
					},
				},
			],
		});

		const materialGroupLayout = data.device.createBindGroupLayout({
			label: 'Geometry Model Bind Group Layout',
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: 'float' },
				},
				{
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: 'float' },
				},
				{
					binding: 2,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: 'float' },
				},
				{
					binding: 3,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: 'float' },
				},
				{
					binding: 4,
					visibility: GPUShaderStage.FRAGMENT,
					sampler: { type: 'filtering' },
				},
			],
		});

		const pipelineLayout = data.device.createPipelineLayout({
			label: 'Geometry Pipeline Layout',
			bindGroupLayouts: [materialGroupLayout, uboGroupLayout],
		});

		const pipeline = await data.device.createRenderPipelineAsync({
			label: 'Geometry Pipeline',
			vertex: {
				module: vertexShaderModule,
				entryPoint: 'main',
				buffers: [vertexBufferLayout],
			},
			fragment: {
				module: fragmentShaderModule,
				entryPoint: 'main',
				targets: [
					{ format: data.format }, // albedo
					{ format: data.format }, // normal
					{ format: data.format }, // emissive
					{ format: data.format }, // metalicRoughnessAO
				],
			},
			primitive: {
				topology: 'triangle-list',
				cullMode: 'back',
				frontFace: 'cw',
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'less',
				format: 'depth24plus',
			},
			layout: pipelineLayout,
		});

		const sampler = data.device.createSampler({
			label: 'Geometry Sampler',
			magFilter: 'linear',
			minFilter: 'linear',
			addressModeU: 'clamp-to-edge',
			addressModeV: 'clamp-to-edge',
			addressModeW: 'clamp-to-edge',
			mipmapFilter: 'linear',
			maxAnisotropy: 1,
		});

		const uboBuffer = data.device.createBuffer({
			label: 'Geometry UBO Buffer',
			size: 3 * 16 * 4, // 3 matrices, 16 floats each + 1 vec4 color
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		GeometryData.ubo = uboBuffer;

		const uboGroup = data.device.createBindGroup({
			label: 'Geometry UBO Bind Group',
			layout: uboGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: GeometryData.ubo,
					},
				},
			],
		});

		GeometryData.uboGroup = uboGroup;
		GeometryData.materialGroupLayout = materialGroupLayout;
		GeometryData.sampler = sampler;

		const res = await CreateTextures(data);

		if (!res.Ok) {
			return Err('Error creating textures :: ', res.Error);
		}

		GeometryData.pipeline = pipeline;

		return Ok(data);
	})
);

Pipeline.RegisterRun({ name: 'Geometry Pipeline' })(
	Result(async (data: EngineData) => {
		// console.log('Geometry pipeline running...');
		const commandEncoder = data.device.createCommandEncoder({
			label: 'Geometry Command Encoder',
		});

		const createAttachment = (
			view: GPUTextureView
		): GPURenderPassColorAttachment => ({
			view,
			storeOp: 'store',
			loadOp: 'clear',
			clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
		});

		const renderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				createAttachment(GeometryData.GBuffer.albedo.view),
				createAttachment(GeometryData.GBuffer.normal.view),
				createAttachment(GeometryData.GBuffer.emissive.view),
				createAttachment(GeometryData.GBuffer.metalicRoughnessAO.view),
			],
			depthStencilAttachment: {
				view: GeometryData.depth.view,
				depthLoadOp: 'clear',
				depthClearValue: 1.0,
				depthStoreOp: 'store',
				// stencilLoadOp: 'clear',
				// stencilClearValue: 0,
				// stencilStoreOp: 'store',
			},
		};

		const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);

		renderPass.setPipeline(GeometryData.pipeline);
		renderPass.setViewport(
			0,
			0,
			data.canvasSize.width,
			data.canvasSize.height,
			0,
			1
		);
		renderPass.setScissorRect(
			0,
			0,
			data.canvasSize.width,
			data.canvasSize.height
		);
    const cameraRes = await GetCamera();
    if (!cameraRes.Ok) {
      return Err('Error getting current camera :: ', cameraRes.Error);
    }

    const view = CameraInverseView(cameraRes.Value);
    const projection = CameraProjection(cameraRes.Value);

    const setUbo = (modelMatrix: Mat4) => {
      console.log('modelMatrix :: ', modelMatrix);
      const uboData = new Float32Array(3 * 16); // 3 matrices, 16 floats each

      uboData.set(view, 0);
      uboData.set(projection, 16);
      uboData.set(modelMatrix, 32);
      data.device.queue.writeBuffer(GeometryData.ubo, 0, uboData);
    };

		const drawModel = Result(async (model: Model) => {
			renderPass.setVertexBuffer(0, model.vertices);
			renderPass.setIndexBuffer(model.indices, 'uint16');
      // setUbo(mat4.identity());

			const drawNode = (
				root: Model,
				parentTransform: Transform,
				node: ModelNode
			) => {
        // console.log('node :: ', node.transform.translation);
        // console.log('root :: ', root.transform.translation);
				const absoluteTransform = MultiplyTransforms(
					node.transform,
					parentTransform,
				);

				for (let child of node.children) {
					drawNode(root, absoluteTransform, child);
				}

				const modelMatrix = TransformMatrix(absoluteTransform);
        // console.log('modelMatrix :: ', modelMatrix);
        // console.log('root :: ', TransformMatrix(root.transform));
        // console.log('node :: ', TransformMatrix(node.transform));
        // console.log('absoluteTransform :: ', absoluteTransform.rotation);

				setUbo(modelMatrix);
        // console.log('transform :: ', absoluteTransform);
        // console.log('modelMatrix :: ', modelMatrix);

				// set node transform group
				for (let primitive of node.primitives) {
					const material = root.materials[primitive.materialIndex];
					renderPass.setBindGroup(0, material.materialGroup);
					renderPass.setBindGroup(1, GeometryData.uboGroup);
					renderPass.drawIndexed(
						primitive.indexCount,
						1,
						primitive.firstIndex,
						0,
						0
					);
				}
			};

			for (let node of model.nodes) {
				drawNode(model, model.transform, node);
			}

			return Ok();
		});

		for (let model of GeometryData.models) {
			const res = await drawModel(model);

			if (!res.Ok) {
				return Err(`Error drawing model ${model.modelId} :: `, res.Error);
			}
		}

		renderPass.end();

		data.device.queue.submit([commandEncoder.finish()]);

		return Ok(data);
	})
);
