import { EngineData } from './engine';
import { Err, Ok, Result } from './errorHandling';

// get the returned Ok value from initWebGpu
export type WebGpuData = Extract<
	Awaited<ReturnType<typeof initWebGpu>>,
	{ Ok: true }
>['Value'];

export const initWebGpu = Result(async () => {
	if (!navigator.gpu) {
		return Err('WebGPU is not supported in this browser.');
	}

	const adapter = await navigator.gpu.requestAdapter();

	if (!adapter) {
		return Err('No adapter found.');
	}

	const device = await adapter.requestDevice();

	const canvas = document.getElementById('canvas') as HTMLCanvasElement;

	if (!canvas) {
		return Err('Canvas not found.');
	}

	const resize = () => {
		EngineData.isResized = true;
		const width = window.innerWidth;
		const height = window.innerHeight;

		canvas.width = width;
		canvas.height = height;
		EngineData.canvasSize = { width, height };
	};

	// setup resize observer to resize canvas when window is resized
	const resizeObserver = new ResizeObserver(resize);

	resizeObserver.observe(window.document.body);

	resize();

	// const observer = new ResizeObserver((entries) => {
	// 	EngineData.isResized = true;
	// 	for (const entry of entries) {
	// 		const width =
	// 			entry.devicePixelContentBoxSize?.[0].inlineSize ||
	// 			entry.contentBoxSize[0].inlineSize * devicePixelRatio;
	// 		const height =
	// 			entry.devicePixelContentBoxSize?.[0].blockSize ||
	// 			entry.contentBoxSize[0].blockSize * devicePixelRatio;
	// 		const canvas = entry.target as HTMLCanvasElement;
	// 		canvas.width = Math.max(
	// 			1,
	// 			Math.min(width, device.limits.maxTextureDimension2D)
	// 		);
	// 		canvas.height = Math.max(
	// 			1,
	// 			Math.min(height, device.limits.maxTextureDimension2D)
	// 		);
	// 	}
	// });
	// try {
	// 	observer.observe(canvas, { box: 'device-pixel-content-box' });
	// } catch {
	// 	observer.observe(canvas, { box: 'content-box' });
	// }

	// window.addEventListener('resize', async () => {
	// 	console.log('Resize begin');
	// 	// const release = await EngineData.resizing.acquire();
	// 	const width = window.innerWidth * window.devicePixelRatio;
	// 	const height = window.innerHeight * window.devicePixelRatio;

	// 	canvas.width = width;
	// 	canvas.height = height;

	// 	for (let pipeline of PipelineData.resizedHooks) {
	// 		await pipeline.hook(EngineData);
	// 	}
	// 	// release();

	// 	console.log('Resize end');
	// });

	// resizeObserver.observe(window.document.body);

	const context = canvas.getContext('webgpu');
	const format = navigator.gpu.getPreferredCanvasFormat();

	if (!context) {
		return Err('WebGPU context not found.');
	}

	const width = canvas.width;
	const height = canvas.height;
	const canvasSize = { width, height };

	context.configure({
		device: device,
		format: format,
		usage: GPUTextureUsage.RENDER_ATTACHMENT,
		alphaMode: 'opaque',
	});

	return Ok({
		// resizing: new Mutex(),
		isResized: false,
		adapter,
		device,
		context,
		format,
		canvasSize,
	});
});
