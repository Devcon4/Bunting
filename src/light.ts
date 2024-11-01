import { EngineData } from './engine';
import { Err, Ok, Result } from './errorHandling';
import { LightingData } from './pipelines/LightingData';
import { Transform } from './transform';
import { uuid } from './uuid';

export type Light = {
  lightId: uuid,
  transform: Transform,
  color: [number, number, number, number],
  intensity: number,
  range: number,
  angle: number,
  lightGroup: GPUBindGroup,
  lightBuffer: GPUBuffer,
}

export const CreateLight = Result(async (
  transform: Transform,
  color: [number, number, number, number],
  intensity: number,
  range: number = 0,
  angle: number = 0
) => {
  const lightBuffer = EngineData.device.createBuffer({
    label: 'Light Buffer',
    size: (4 + 4 + 4 + 4) * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const buffer = new Float32Array(4 + 4 + 4 + 4);

  buffer.set(color, 0);
  buffer.set(transform.translation, 4);
  buffer.set(transform.rotation, 8);
  buffer.set([intensity, range, angle, 0], 12);

  EngineData.device.queue.writeBuffer(
    lightBuffer,
    0,
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength
  );

  const lightGroup = EngineData.device.createBindGroup({
    label: 'Light Bind Group',
    layout: LightingData.lightGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: lightBuffer,
        },
      },
    ],
  });

  const light: Light = {
    lightId: uuid(),
    transform,
    color,
    intensity,
    range,
    angle,
    lightGroup,
    lightBuffer,
  };

  LightingData.lights.set(light.lightId, light);

  return Ok(light);
});

export const UpdateLight = Result(async (lightId: uuid, update: Partial<Exclude<Light, 'lightId' | 'lightGroup' | 'lightBuffer'>>) => {
  const light = LightingData.lights.get(lightId);

  if (!light) {
    return Err('Light not found');
  }

  const updated = { ...light, ...update };

  const buffer = new Float32Array(4 + 4 + 4 + 4);

  buffer.set(updated.color, 0);
  buffer.set(updated.transform.translation, 4);
  buffer.set(updated.transform.rotation, 8);
  buffer.set([updated.intensity, updated.range, updated.angle, 0], 12);

  EngineData.device.queue.writeBuffer(
    light.lightBuffer,
    0,
    buffer,
  );

  LightingData.lights.set(lightId, updated);

  return Ok(light);
});