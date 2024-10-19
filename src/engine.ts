import { Err, Ok, Result, SyncResult } from './errorHandling';
import { initWebGpu, WebGpuData } from './webgpuSetup';

import { ModuleData } from './Module';
import { PipelineData } from './Pipeline';

// Functional
const engineInit = Result(async (data: Partial<EngineData>) => {
	console.log('Engine initializing...');

	const webGpuResult = await initWebGpu();
	if (!webGpuResult.Ok) {
		return Err('WebGPU initialization failed.', webGpuResult.Error);
	}

	let fullData = {
		...data,
		...webGpuResult.Value,
	} as EngineData;

	for (const module of ModuleData.initHooks) {
		console.log(`Initializing module ${module.metadata.name}...`);
		const initRes = await module.hook(fullData);

		if (!initRes.Ok) {
			return Err(
				`Module ${module.metadata.name} initialization failed.`,
				initRes.Error
			);
		}

		if (!initRes.Value) {
			return Err(
				`No data returned from module: ${module.metadata.name} initialization.`
			);
		}

		fullData = initRes.Value as EngineData;
	}

	return Ok(fullData);
});

const engineRun = Result(async (data: EngineData) => {
	if (data.isResized) {
		console.log('Engine resized...');
		for (let pipeline of PipelineData.resizedHooks) {
			await pipeline.hook(EngineData);
		}

		data.isResized = false;
		EngineData.isResized = false;
	}
	for (const module of ModuleData.runHooks) {
		// console.log(`Running module ${module.metadata.name}...`);
		const runRes = await module.hook(data);

		if (!runRes.Ok) {
			return Err('Module run failed :: ', runRes.Error);
		}
	}

	return Ok();
});

const engineCleanup = SyncResult((data: EngineData) => {
	console.log('Engine cleanup...');

	for (const module of ModuleData.cleanupHooks) {
		console.log(`Cleaning up module ${module.metadata.name}...`);
		module.hook(data);
	}

	return Ok();
});

const engineStart = Result(async (data: EngineData) => {
	console.log('Engine starting...');
	// Set global EngineData values now that we have the full data object.

	for (const module of ModuleData.afterInitHooks) {
		console.log(`Running afterInit module ${module.metadata.name}...`);
		const runRes = await module.hook(data);

		if (!runRes.Ok) {
			return Err('Module afterInit failed.', runRes.Error);
		}
	}

	const loop = async () => {
		const runRes = await engineRun(EngineData);

		if (!runRes.Ok) {
			return Err('Engine run failed.', runRes.Error);
		}

		requestAnimationFrame(loop);
	};

	requestAnimationFrame(loop);
	return Ok();
});

const createEngine = async <T extends EngineData>(data: Partial<T>) => {
	const initRes = await engineInit(data);

	if (!initRes.Ok) {
		return Err('Engine initialization failed.', initRes.Error);
	}

	EngineData = {
		...EngineData,
		...initRes.Value,
	};

	const startFn = Result(async () => {
		const loop = await engineStart(EngineData);

		if (!loop.Ok) {
			engineCleanup(initRes.Value);
			return Err('Engine start failed.', loop.Error);
		}

		return Ok();
	});

	return Ok(startFn);
};

export default createEngine;

export type EngineData = WebGpuData & {};

export let EngineData: EngineData = {} as any;

export type LifecycleMetadata = {
	name: string;
	priority: number;
};
type LifecycleFunc<U, V> = (data: EngineData) => Promise<Result<U, V>>;
type Lifecycle<U, V> = {
	metadata: LifecycleMetadata;
	hook: LifecycleFunc<U, V>;
};

export type DefaultLifecycleHooks = 'init' | 'afterInit' | 'run' | 'cleanup';

export type LifecycleExports<hooks extends string = DefaultLifecycleHooks> = {
	[key in hooks as `Register${Capitalize<key>}`]: RegisterLifecycleFunc;
};

export type LifecycleData<hooks extends string = DefaultLifecycleHooks> = {
	[key in hooks as `${key}Hooks`]: Lifecycle<unknown, unknown>[];
};

export type RegisterLifecycleFunc = (
	metadata: Partial<LifecycleMetadata>
) => <U, V>(func: LifecycleFunc<U, V>) => void;
