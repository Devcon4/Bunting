import { Material, Node, NodeIO, Texture, TextureInfo } from '@gltf-transform/core';
import { quat, vec2, vec3 } from 'gl-matrix';
import { EngineData } from './engine';
import { Err, Ok, Result } from './errorHandling';
import { GeometryData } from './pipelines/geometryPipeline';
import { IdentityTransform, Transform } from './transform';
import { uuid } from './uuid';

export type BuntingImage = {
  image: GPUTexture,
  sampler: GPUSampler,
  view: GPUTextureView
};

export type ModelPrimitive = {
  firstIndex: number,
  indexCount: number,
  materialIndex: number
};

// export type ModelTexture = {
//   textureIndex: number,
//   // samplerIndex: number
// };

export type ModelMaterial = {
  name: string,
  albedoImage: BuntingImage,
  normalImage: BuntingImage,
  metallicRoughnessImage: BuntingImage,
  emissiveImage?: BuntingImage,
  materialGroup: GPUBindGroup
};

export type ModelNode = {
  transform: Transform,
  primitives: ModelPrimitive[],
  children: ModelNode[],
};

export type ModelVertex = {
  position: vec3,
  normal: vec3,
  uv: vec2
};

export type Model = {
  modelId: uuid,
  transform: Transform,
  // textures: ModelTexture[],
  materials: ModelMaterial[],
  nodes: ModelNode[],
  vertices: GPUBuffer,
  indices: GPUBuffer,
  vertexCount: number,
};

const getLocalTransform = (node: Node): Transform => {
  const translation = node.getTranslation();
  const rotation = node.getRotation();
  const scale = node.getScale();

  return {
    translation: vec3.fromValues(translation[0], translation[1], translation[2]),
    rotation: quat.fromValues(rotation[0], rotation[1], rotation[2], rotation[3]),
    scale: vec3.fromValues(scale[0], scale[1], scale[2])
  };
  
}

const LoadModel = Result(async (path: string) => {
  const io = new NodeIO(window.fetch.bind(window));
  io.setAllowNetwork(true);
  io.setLogger(console);
  const modelFile = await io.read(path);
  const root = modelFile.getRoot();
  const nodes = root.listNodes();
  const rawMats = root.listMaterials();
  const childNodes = [];

  const meshVertices: ModelVertex[] = [];
  const meshIndices: number[] = [];

  const emptyImage = Result(async () => {
    const tex = EngineData.device.createTexture({
      label: 'Empty Texture',
      size: {width: 1, height: 1, depthOrArrayLayers: 1},
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
    });

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
      view
    };

    return Ok(res);
  });

  const loadImage = Result(async (textureInfo: TextureInfo, texture: Texture) => {

    const texName = textureInfo.getName() || 'Unnamed Texture';
    const size = texture.getSize();

    const imageData = texture.getImage();

    if (!imageData) {
      return Err('No image data found.');
    }

    const blobData = new Blob(
      [imageData],
      { type: texture.getMimeType() }
    );

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
      size: {width, height, depthOrArrayLayers: 1},
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
    });

    EngineData.device.queue.copyExternalImageToTexture(
      {source: data},
      {texture: tex},
      {width, height, depthOrArrayLayers: 1}
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
      view
    } as BuntingImage;

    return Ok(res);

  });

  const loadNode = Result(async <T>(node: Node) => {
    const mesh = node.getMesh();

    const ModelNode: ModelNode = {
      transform: getLocalTransform(node),
      primitives: [],
      children: []
    };

    for (const primitive of mesh?.listPrimitives() || []) {
      const posAccessor = primitive.getAttribute('POSITION');
      const normAccessor = primitive.getAttribute('NORMAL');
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

      if (!uvAccessor) {
        return Err('TEXCOORD_0 attribute not found.');
      }

      if (!material) {
        return Err('Material not found.');
      }
  
      const vertices = posAccessor.getArray() as Float32Array;
      const normals = normAccessor.getArray() as Float32Array;
      const uvs = uvAccessor.getArray() as Float32Array;
      const indices = indicesAccessor.getArray() as Uint16Array;

      for(let i = 0; i < vertices.length; i += 3) {
        const position = vec3.fromValues(vertices[i], vertices[i + 1], vertices[i + 2]);
        const normal = vec3.fromValues(normals[i], normals[i + 1], normals[i + 2]);
        const uv = vec2.fromValues(uvs[i], uvs[i + 1]);

        meshVertices.push({
          position,
          normal,
          uv
        });
      }

      for (let i = 0; i < indices.length; i++) {
        meshIndices.push(indices[i]);
      }

      const materialIndex = rawMats.indexOf(material);

      ModelNode.primitives.push({
        firstIndex: meshIndices.length - indices.length,
        indexCount: indices.length,
        materialIndex
      });
    }

    for(const child of node.listChildren()) {
      const result = await loadNode(child) as Result<ModelNode, T>;
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

  const vertexSize = (3 * 4) + (3 * 4) + (2 * 4);
  const vertexBuffer = EngineData.device.createBuffer({
    label: 'Model Vertex Buffer',
    size: meshVertices.length * vertexSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true
  });

  const vertexData = new Float32Array(meshVertices.length * 8); // 3 position, 3 normal, 2 uv floats

  for(let i = 0; i < meshVertices.length; i++) {
    const v = meshVertices[i];
    const offset = i * 8;
    vertexData.set(v.position, offset);
    vertexData.set(v.normal, offset + 3);
    vertexData.set(v.uv, offset + 6);
  }

  new Float32Array(vertexBuffer.getMappedRange()).set(vertexData);
  vertexBuffer.unmap();

  const indexBuffer = EngineData.device.createBuffer({
    label: 'Model Index Buffer',
    size: meshIndices.length * 2,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true
  });

  new Uint16Array(indexBuffer.getMappedRange()).set(meshIndices);
  indexBuffer.unmap();

  // const textures = root.listTextures().map<ModelTexture>((t, i) => ({textureIndex: i}));
  const loadMaterial = Result(async (material: Material) => {
    const [albedoTex, albedoTexInfo] = [material.getBaseColorTexture(), material.getBaseColorTextureInfo()];
    const [normalTex, normalTexInfo] = [material.getNormalTexture(), material.getNormalTextureInfo()];
    const [metallicRoughnessTex, metallicRoughnessTexInfo] = [material.getMetallicRoughnessTexture(), material.getMetallicRoughnessTextureInfo()];
    const [emissiveTex, emissiveTexInfo] = [material.getEmissiveTexture(), material.getEmissiveTextureInfo()];

    if (!albedoTex || !albedoTexInfo) {
      return Err('No albedo texture found.');
    }

    if (!normalTex || !normalTexInfo) {
      return Err('No normal texture found.');
    }

    if (!metallicRoughnessTex || !metallicRoughnessTexInfo) {
      return Err('No metallic roughness texture found.');
    }

    const albedoImage = await loadImage(albedoTexInfo, albedoTex);
    const normalImage = await loadImage(normalTexInfo, normalTex);
    const metallicRoughnessImage = await loadImage(metallicRoughnessTexInfo, metallicRoughnessTex);
    let emissiveImage: Result<BuntingImage, string> | undefined = undefined;
    
    if (emissiveTex && emissiveTexInfo) {
      emissiveImage = await loadImage(emissiveTexInfo, emissiveTex);

      if (!emissiveImage.Ok) {
        return Err('Error loading emissive texture :: ', emissiveImage.Error);
      }
    } else {
      // create empty emissive texture
      emissiveImage = await emptyImage();

      if (!emissiveImage.Ok) {
        return Err('Error building empty texture :: ', emissiveImage.Error);
      }
    }

    if (!albedoImage.Ok) {
      return Err('Error loading albedo texture :: ', albedoImage.Error);
    }

    if (!normalImage.Ok) {
      return Err('Error loading normal texture :: ', normalImage.Error);
    }

    if (!metallicRoughnessImage.Ok) {
      return Err('Error loading metallic roughness texture :: ', metallicRoughnessImage.Error);
    }

    const materialGroup = EngineData.device.createBindGroup({
      layout: GeometryData.materialGroupLayout,
      entries: [
        {binding: 0, resource: albedoImage.Value.view },
        {binding: 1, resource: normalImage.Value.view },
        {binding: 2, resource: metallicRoughnessImage.Value.view },
        {binding: 3, resource: emissiveImage.Value.view },
        {binding: 4, resource: GeometryData.sampler }
      ]
    });

    const res: ModelMaterial = {
      name: material.getName() || 'Unnamed Material',
      albedoImage: albedoImage.Value,
      normalImage: normalImage.Value,
      metallicRoughnessImage: metallicRoughnessImage.Value,
      emissiveImage: emissiveImage?.Value,
      materialGroup
    };

    return Ok(res);
  });

  const materials: ModelMaterial[] = [];

  for(const material of rawMats) {
    const result = await loadMaterial(material);
    if (!result.Ok) {
      return Err('Error loading material :: ', result.Error);
    }

    materials.push(result.Value);
  }

  const model: Model = {
    modelId: uuid(),
    transform: IdentityTransform,
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