const TEXTURE_USAGE = {
	COPY_SRC: 0x01,
	COPY_DST: 0x02,
	TEXTURE_BINDING: 0x04,
	RENDER_ATTACHMENT: 0x10
};

const BUFFER_USAGE = {
	MAP_READ: 0x01,
	COPY_DST: 0x08,
	UNIFORM: 0x40
};

const MAP_MODE = {
	READ: 0x01
};

const OUTPUT_FORMAT = 'rgba8unorm';
const COPY_BYTES_PER_ROW_ALIGNMENT = 256;

const SHARED_SHADER = /* wgsl */ `
struct Sizes { src: vec2f, dst: vec2f }
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var<uniform> sizes: Sizes;

fn mitchell(xIn: f32) -> f32 {
  let x = abs(xIn);
  let B = 1.0 / 3.0;
  let C = 1.0 / 3.0;
  if (x < 1.0) {
    return ((12.0 - 9.0 * B - 6.0 * C) * x*x*x +
      (-18.0 + 12.0 * B + 6.0 * C) * x*x + (6.0 - 2.0 * B)) / 6.0;
  }
  if (x < 2.0) {
    return ((-B - 6.0 * C) * x*x*x + (6.0 * B + 30.0 * C) * x*x +
      (-12.0 * B - 48.0 * C) * x + (8.0 * B + 24.0 * C)) / 6.0;
  }
  return 0.0;
}

fn srgbToLinear(c: vec3f) -> vec3f {
  let low = c / 12.92;
  let high = pow((c + vec3f(0.055)) / 1.055, vec3f(2.4));
  return select(high, low, c <= vec3f(0.04045));
}

fn linearToSrgb(cIn: vec3f) -> vec3f {
  let c = max(cIn, vec3f(0.0));
  let low = c * 12.92;
  let high = 1.055 * pow(c, vec3f(1.0 / 2.4)) - vec3f(0.055);
  return select(high, low, c <= vec3f(0.0031308));
}

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(p[i], 0.0, 1.0);
}
`;

const HORIZONTAL_SHADER = SHARED_SHADER + /* wgsl */ `
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let scale = sizes.dst.x / sizes.src.x;
  let filterScale = min(scale, 1.0);
  let center = pos.x / scale - 0.5;
  var color = vec4f(0.0);
  var total = 0.0;
  for (var offset = -48; offset <= 48; offset++) {
    let sampleX = i32(floor(center)) + offset;
    let w = mitchell((f32(sampleX) - center) * filterScale) * filterScale;
    if (w != 0.0) {
      let px = textureLoad(inputTex, vec2i(clamp(sampleX, 0, i32(sizes.src.x) - 1), i32(pos.y)), 0);
      color += vec4f(srgbToLinear(px.rgb), px.a) * w;
      total += w;
    }
  }
  return color / total;
}
`;

const VERTICAL_SHADER = SHARED_SHADER + /* wgsl */ `
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let scale = sizes.dst.y / sizes.src.y;
  let filterScale = min(scale, 1.0);
  let center = pos.y / scale - 0.5;
  var color = vec4f(0.0);
  var total = 0.0;
  for (var offset = -48; offset <= 48; offset++) {
    let sampleY = i32(floor(center)) + offset;
    let w = mitchell((f32(sampleY) - center) * filterScale) * filterScale;
    if (w != 0.0) {
      let px = textureLoad(inputTex, vec2i(i32(pos.x), clamp(sampleY, 0, i32(sizes.src.y) - 1)), 0);
      color += px * w;
      total += w;
    }
  }
  let linear = color / total;
  return vec4f(linearToSrgb(linear.rgb), linear.a);
}
`;

class MitchellResizer {
	constructor(device, horizontalPipeline, verticalPipeline) {
		this.device = device;
		this.horizontalPipeline = horizontalPipeline;
		this.verticalPipeline = verticalPipeline;
		this.lost = false;
		device.lost.then(() => {
			this.lost = true;
		});
	}

	async render(source, canvas, width, height) {
		if (this.lost) throw new Error('WebGPU device was lost');

		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Browser cannot create a 2D canvas context');

		const sourceTexture = this.device.createTexture({
			size: [source.width, source.height],
			format: 'rgba8unorm',
			usage:
				TEXTURE_USAGE.TEXTURE_BINDING |
				TEXTURE_USAGE.COPY_DST |
				TEXTURE_USAGE.RENDER_ATTACHMENT
		});
		const intermediate = this.device.createTexture({
			size: [width, source.height],
			format: 'rgba16float',
			usage: TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING
		});
		const output = this.device.createTexture({
			size: [width, height],
			format: OUTPUT_FORMAT,
			usage: TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.COPY_SRC
		});
		const unpaddedBytesPerRow = width * 4;
		const bytesPerRow =
			Math.ceil(unpaddedBytesPerRow / COPY_BYTES_PER_ROW_ALIGNMENT) *
			COPY_BYTES_PER_ROW_ALIGNMENT;
		const readback = this.device.createBuffer({
			size: bytesPerRow * height,
			usage: BUFFER_USAGE.COPY_DST | BUFFER_USAGE.MAP_READ
		});
		const horizontalUniform = this.device.createBuffer({
			size: 16,
			usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST
		});
		const verticalUniform = this.device.createBuffer({
			size: 16,
			usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST
		});

		try {
			this.device.queue.copyExternalImageToTexture(
				{ source },
				{ texture: sourceTexture },
				[source.width, source.height]
			);
			this.device.queue.writeBuffer(
				horizontalUniform,
				0,
				new Float32Array([source.width, source.height, width, source.height])
			);
			this.device.queue.writeBuffer(
				verticalUniform,
				0,
				new Float32Array([width, source.height, width, height])
			);

			const horizontalBindGroup = this.device.createBindGroup({
				layout: this.horizontalPipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: sourceTexture.createView() },
					{ binding: 1, resource: { buffer: horizontalUniform } }
				]
			});
			const verticalBindGroup = this.device.createBindGroup({
				layout: this.verticalPipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: intermediate.createView() },
					{ binding: 1, resource: { buffer: verticalUniform } }
				]
			});

			const encoder = this.device.createCommandEncoder();
			const horizontalPass = encoder.beginRenderPass({
				colorAttachments: [
					{
						view: intermediate.createView(),
						loadOp: 'clear',
						storeOp: 'store',
						clearValue: [0, 0, 0, 1]
					}
				]
			});
			horizontalPass.setPipeline(this.horizontalPipeline);
			horizontalPass.setBindGroup(0, horizontalBindGroup);
			horizontalPass.draw(3);
			horizontalPass.end();

			const verticalPass = encoder.beginRenderPass({
				colorAttachments: [
					{
						view: output.createView(),
						loadOp: 'clear',
						storeOp: 'store',
						clearValue: [0, 0, 0, 1]
					}
				]
			});
			verticalPass.setPipeline(this.verticalPipeline);
			verticalPass.setBindGroup(0, verticalBindGroup);
			verticalPass.draw(3);
			verticalPass.end();
			encoder.copyTextureToBuffer(
				{ texture: output },
				{ buffer: readback, bytesPerRow, rowsPerImage: height },
				[width, height]
			);

			this.device.queue.submit([encoder.finish()]);
			await readback.mapAsync(MAP_MODE.READ);

			const mapped = new Uint8Array(readback.getMappedRange());
			const pixels = new Uint8ClampedArray(unpaddedBytesPerRow * height);
			for (let row = 0; row < height; row += 1) {
				const sourceOffset = row * bytesPerRow;
				const destinationOffset = row * unpaddedBytesPerRow;
				pixels.set(
					mapped.subarray(sourceOffset, sourceOffset + unpaddedBytesPerRow),
					destinationOffset
				);
			}
			readback.unmap();

			context.putImageData(new ImageData(pixels, width, height), 0, 0);
		} finally {
			sourceTexture.destroy();
			intermediate.destroy();
			output.destroy();
			if (readback.mapState === 'mapped') readback.unmap();
			readback.destroy();
			horizontalUniform.destroy();
			verticalUniform.destroy();
		}
	}
}

let resizerPromise;

/** Returns a shared Mitchell resizer, or null when WebGPU is unavailable. */
export function getMitchellResizer() {
	if (!resizerPromise) resizerPromise = createMitchellResizer();
	return resizerPromise;
}

async function createMitchellResizer() {
	const gpu = navigator.gpu;
	if (!gpu) return null;

	try {
		const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
		if (!adapter) return null;

		const device = await adapter.requestDevice();
		const horizontalModule = device.createShaderModule({ code: HORIZONTAL_SHADER });
		const verticalModule = device.createShaderModule({ code: VERTICAL_SHADER });
		const horizontalPipeline = await device.createRenderPipelineAsync({
			layout: 'auto',
			vertex: { module: horizontalModule, entryPoint: 'vs' },
			fragment: {
				module: horizontalModule,
				entryPoint: 'fs',
				targets: [{ format: 'rgba16float' }]
			},
			primitive: { topology: 'triangle-list' }
		});
		const verticalPipeline = await device.createRenderPipelineAsync({
			layout: 'auto',
			vertex: { module: verticalModule, entryPoint: 'vs' },
			fragment: { module: verticalModule, entryPoint: 'fs', targets: [{ format: OUTPUT_FORMAT }] },
			primitive: { topology: 'triangle-list' }
		});

		return new MitchellResizer(device, horizontalPipeline, verticalPipeline);
	} catch (error) {
		console.warn('Mitchell WebGPU initialization failed; using fallback resizer', error);
		return null;
	}
}
