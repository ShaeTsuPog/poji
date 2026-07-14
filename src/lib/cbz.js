import { unzip } from 'unzipit';
import { groupIntoChapters, parseVolumeFileName, formatChapterTitle, volumeId } from './parse.js';
import { STORAGE_MODES } from './library.js';

const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|bmp)$/i;

const MIME = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	webp: 'image/webp',
	avif: 'image/avif',
	bmp: 'image/bmp'
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function isPageEntry(name) {
	if (name.startsWith('__MACOSX/')) return false;
	const basename = name.split('/').pop();
	return IMAGE_RE.test(basename) && !basename.startsWith('.');
}

/**
 * @param {string} name
 */
function mimeForEntry(name) {
	const ext = name.split('.').pop()?.toLowerCase() ?? '';
	return MIME[ext] ?? 'application/octet-stream';
}

/**
 * Lists image paths inside a CBZ without decompressing page data.
 *
 * @param {Blob} blob
 * @returns {Promise<string[]>}
 */
async function listPageNames(blob) {
	const { entries } = await unzip(blob);
	return Object.keys(entries)
		.filter(isPageEntry)
		.sort((a, b) => collator.compare(a, b));
}

/**
 * Imports a .cbz file for the library: metadata, chapter groupings, and the raw archive blob.
 *
 * @param {File} file
 * @param {{ storageMode?: 'file-system' | 'indexed-db', fileHandle?: FileSystemFileHandle }} [options]
 */
export async function importCbz(file, options) {
	const names = await listPageNames(file);

	if (names.length === 0) {
		throw new Error('No images found inside this CBZ.');
	}

	const { mangaName, volumeNumber } = parseVolumeFileName(file.name);
	const chapters = groupIntoChapters(names);

	return {
		id: volumeId(file),
		fileName: file.name,
		mangaName,
		volumeNumber,
		importedAt: Date.now(),
		chapters,
		storageMode: options?.storageMode ?? STORAGE_MODES.INDEXED_DB,
		...(options?.fileHandle ? { fileHandle: options.fileHandle } : { blob: file })
	};
}

/**
 * @param {FileSystemFileHandle} fileHandle
 */
async function ensureReadPermission(fileHandle) {
	if (!fileHandle.queryPermission || !fileHandle.requestPermission) return;

	const options = { mode: 'read' };
	if ((await fileHandle.queryPermission(options)) === 'granted') return;
	if ((await fileHandle.requestPermission(options)) !== 'granted') {
		throw new Error('Poji needs permission to read this CBZ file.');
	}
}

/**
 * @param {import('./library.js').StoredVolume} volume
 * @returns {Promise<Blob>}
 */
async function getVolumeBlob(volume) {
	if (volume.storageMode === STORAGE_MODES.FILE_SYSTEM) {
		if (!volume.fileHandle) {
			throw new Error('This volume is missing its file handle. Re-import the CBZ to restore it.');
		}
		await ensureReadPermission(volume.fileHandle);
		return volume.fileHandle.getFile();
	}

	if (!volume.blob) {
		throw new Error('This volume is missing its stored CBZ data.');
	}

	return volume.blob;
}

/**
 * @param {Blob} blob
 * @returns {Promise<Blob>}
 */
export async function loadFirstPage(blob) {
	const { entries } = await unzip(blob);
	const name = Object.keys(entries)
		.filter(isPageEntry)
		.sort((a, b) => collator.compare(a, b))[0];

	if (!name) {
		throw new Error('No images found inside this CBZ.');
	}

	return entries[name].blob(mimeForEntry(name));
}

/**
 * @param {import('./library.js').StoredVolume} volume
 * @returns {Promise<Blob>}
 */
export async function loadVolumeCover(volume) {
	return loadFirstPage(await getVolumeBlob(volume));
}

/**
 * Loads a single chapter's pages from a stored volume.
 *
 * @param {import('./library.js').StoredVolume} volume
 * @param {string} chapterId
 * @returns {Promise<{ name: string, pages: Blob[], pageNames: string[] }>}
 */
export async function loadChapter(volume, chapterId) {
	const chapter = volume.chapters.find((entry) => entry.id === chapterId);
	if (!chapter) {
		throw new Error('Chapter not found.');
	}

	const blob = await getVolumeBlob(volume);
	const { entries } = await unzip(blob);
	const pages = await Promise.all(
		chapter.pages.map(async (name) => {
			const entry = entries[name];
			if (!entry) {
				throw new Error(`Missing page: ${name}`);
			}
			return entry.blob(mimeForEntry(name));
		})
	);

	if (pages.length === 0) {
		throw new Error('No images found for this chapter.');
	}

	return {
		name: formatChapterTitle(volume, chapterId),
		pages,
		pageNames: chapter.pages
	};
}

/**
 * Opens a .cbz file and returns its pages as image Blobs, sorted naturally
 * by filename (so "page2" comes before "page10").
 *
 * @param {File} file
 * @returns {Promise<{ name: string, pages: Blob[], pageNames: string[] }>}
 */
export async function loadCbz(file) {
	const volume = await importCbz(file);
	const { entries } = await unzip(file);
	const names = Object.keys(entries)
		.filter(isPageEntry)
		.sort((a, b) => collator.compare(a, b));
	const pages = await Promise.all(names.map((name) => entries[name].blob(mimeForEntry(name))));

	return { name: volume.fileName, pages, pageNames: names };
}
