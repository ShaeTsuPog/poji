import Pica from 'pica';
import { SCALE_ALGORITHMS } from './library.js';
import { getMitchellResizer } from './mitchell-resizer.js';

export const pica = new Pica();

/**
 * Detects whether each optional scaling implementation can actually complete a resize.
 * Browser canvas scaling is always available when the app itself can render.
 */
export async function detectScalingCapabilities() {
	const [mitchell, lanczos] = await Promise.all([supportsMitchell(), supportsLanczos()]);
	return { mitchell, lanczos, browser: true };
}

async function supportsMitchell() {
	try {
		const resizer = await getMitchellResizer();
		if (!resizer) return false;

		const source = document.createElement('canvas');
		source.width = 2;
		source.height = 2;
		const context = source.getContext('2d');
		if (!context) return false;
		context.fillStyle = '#fff';
		context.fillRect(0, 0, 2, 2);

		const target = document.createElement('canvas');
		await resizer.render(source, target, 1, 1);

		// A completed WebGPU submission does not guarantee that the rendered
		// canvas can be copied into Canvas2D. Safari may return a black image
		// from this handoff without reporting a WebGPU error, so exercise the
		// same path used by the reader and verify its output.
		const readable = document.createElement('canvas');
		readable.width = 1;
		readable.height = 1;
		const readableContext = readable.getContext('2d');
		if (!readableContext) return false;
		readableContext.drawImage(target, 0, 0);
		const [red, green, blue, alpha] = readableContext.getImageData(0, 0, 1, 1).data;
		if (red < 250 || green < 250 || blue < 250 || alpha < 250) {
			throw new Error(
				`WebGPU canvas readback returned an unexpected pixel: rgba(${red}, ${green}, ${blue}, ${alpha})`
			);
		}

		return true;
	} catch (error) {
		console.warn('Mitchell + linear light scaling is unavailable', error);
		return false;
	}
}

async function supportsLanczos() {
	try {
		const source = document.createElement('canvas');
		source.width = 2;
		source.height = 2;
		const context = source.getContext('2d');
		if (!context) return false;
		context.fillStyle = '#fff';
		context.fillRect(0, 0, 2, 2);

		const target = document.createElement('canvas');
		target.width = 1;
		target.height = 1;
		await pica.resize(source, target, { filter: 'lanczos3' });
		return true;
	} catch (error) {
		console.warn('Pica Lanczos scaling is unavailable', error);
		return false;
	}
}

export function scalingAlgorithmSupported(algorithm, capabilities) {
	if (algorithm === SCALE_ALGORITHMS.MITCHELL) return capabilities.mitchell;
	if (algorithm === SCALE_ALGORITHMS.LANCZOS) return capabilities.lanczos;
	return algorithm === SCALE_ALGORITHMS.BROWSER;
}
