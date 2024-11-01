import { EngineData } from '../engine';
import { Err, Ok, Result } from '../errorHandling';
import { Pipeline } from '../Pipeline';
import { CompositeData } from './CompositeData';
import { LightingData } from './LightingData';

const createBindGroup = Result(async (data: EngineData) => {
	const image = data.context.getCurrentTexture();
	const view = image.createView();

	const sampler = data.device.createSampler({
		label: 'Composite Sampler',
		magFilter: 'linear',
		minFilter: 'linear',
		addressModeU: 'clamp-to-edge',
		addressModeV: 'clamp-to-edge',
		mipmapFilter: 'linear',
		addressModeW: 'repeat',
	});

	// const depthOnlyView = GeometryData.depth.texture.createView({
	// 	aspect: 'depth-only',
	// });

	const imageGroup = data.device.createBindGroup({
		label: 'Composite Image Bind Group',
		layout: CompositeData.imageGroupLayout,
		entries: [
			{ binding: 0, resource: LightingData.lightingFinal.view },
			{ binding: 1, resource: sampler },
		],
	});

	CompositeData.imageGroup = imageGroup;
	CompositeData.sampler = sampler;
	CompositeData.final = {
		image,
		view,
	};

	return Ok(data);
});

Pipeline.RegisterInit({ name: 'Composite Pipeline', priority: 4096 })(
	Result(async (data: EngineData) => {
		console.log('Composite pipeline initializing...');

		const vertexShaderModule = data.device.createShaderModule({
			label: 'Composite Vertex Shader Module',
			code: await fetch('./shaders/composite.vert.wgsl').then((res) =>
				res.text()
			),
		});

		const fragmentShaderModule = data.device.createShaderModule({
			label: 'Composite Fragment Shader Module',
			code: await fetch('./shaders/composite.frag.wgsl').then((res) =>
				res.text()
			),
		});

		const imageGroupLayout = data.device.createBindGroupLayout({
			label: 'Composite Image Bind Group Layout',
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: 'float' },
				},
				{
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					sampler: { type: 'filtering' },
				},
			],
		});

		const pipelineLayout = data.device.createPipelineLayout({
			label: 'Composite Pipeline Layout',
			bindGroupLayouts: [imageGroupLayout],
		});

		const pipeline = await data.device.createRenderPipelineAsync({
			label: 'Composite Render Pipeline',
			vertex: {
				module: vertexShaderModule,
				entryPoint: 'main',
			},
			fragment: {
				module: fragmentShaderModule,
				entryPoint: 'main',
				targets: [{ format: data.format }],
			},
			primitive: {
				topology: 'triangle-list',
			},
			layout: pipelineLayout,
		});

		CompositeData.pipeline = pipeline;
		CompositeData.imageGroupLayout = imageGroupLayout;

		const res = await createBindGroup(data);

		if (!res.Ok) {
			return Err('Error creating bind group :: ', res.Error);
		}

		return Ok(data);
	})
);

Pipeline.RegisterResized({ name: 'Composite Pipeline' })(
	Result(async (data: EngineData) => {
		if (!data.context) {
			return Ok(data);
		}
		await data.device.queue.onSubmittedWorkDone();
		const res = await createBindGroup(data);

		if (!res.Ok) {
			return Err('Error creating bind group :: ', res.Error);
		}

		return Ok(data);
	})
);

Pipeline.RegisterRun({ name: 'Composite Pipeline', priority: 1024 })(
	Result(async (data: EngineData) => {
		const encoder = data.device.createCommandEncoder({
			label: 'Composite Command Encoder',
		});

		const textureView = data.context.getCurrentTexture().createView();
		const renderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					storeOp: 'store',
					loadOp: 'clear',
					clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
				},
			],
		};

		const renderPass = encoder.beginRenderPass(renderPassDescriptor);

		renderPass.setPipeline(CompositeData.pipeline);
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
		renderPass.setBindGroup(0, CompositeData.imageGroup);

		renderPass.draw(6, 1, 0, 0);

		renderPass.end();

		data.device.queue.submit([encoder.finish()]);

		return Ok(data);
	})
);

Pipeline.RegisterCleanup({ name: 'Composite Pipeline', priority: 1024 })(
	Result(async (data: EngineData) => {
		CompositeData.final.image.destroy();

		return Ok(data);
	})
);
