import { importCbz, loadVolumeCover } from './cbz.js';
import {
	getSeries,
	getSeriesOrder,
	listVolumes,
	saveSeriesCover,
	saveSeriesOrder,
	saveVolume,
	STORAGE_MODES
} from './library.js';
import { ensureLocalProgress } from './progress.js';

/** @param {string} name */
function normalizeMangaName(name) {
	return name.trim().replace(/\s+/g, ' ');
}

/**
 * @param {import('./library.js').StoredVolume[]} volumes
 */
function sortVolumesForCover(volumes) {
	return [...volumes].sort((a, b) => {
		if (a.volumeNumber != null && b.volumeNumber != null) {
			return a.volumeNumber - b.volumeNumber;
		}
		if (a.volumeNumber != null) return -1;
		if (b.volumeNumber != null) return 1;
		return a.importedAt - b.importedAt;
	});
}

/** @param {string} mangaName */
async function refreshLocalCover(mangaName) {
	const normalizedMangaName = normalizeMangaName(mangaName);
	const matchedSeries = await getSeries(normalizedMangaName);
	if (matchedSeries?.aniListId) return;

	const volumes = await listVolumes();
	const firstVolume = sortVolumesForCover(
		volumes.filter((volume) => normalizeMangaName(volume.mangaName) === normalizedMangaName)
	)[0];

	if (!firstVolume) return;

	await saveSeriesCover({
		mangaName: normalizedMangaName,
		blob: await loadVolumeCover(firstVolume),
		source: 'local',
		updatedAt: Date.now()
	});
}

/**
 * @typedef {{
 *   file: File,
 *   fileHandle?: FileSystemFileHandle
 * }} VolumeImportItem
 */

/**
 * @param {File[] | FileSystemFileHandle[] | VolumeImportItem[]} items
 * @returns {Promise<VolumeImportItem[]>}
 */
async function normalizeImportItems(items) {
	return Promise.all(
		items.map(async (item) => {
			if (item instanceof File) return { file: item };
			if ('file' in item) return item;
			return { file: await item.getFile(), fileHandle: item };
		})
	);
}

/**
 * @param {File[] | FileSystemFileHandle[] | VolumeImportItem[]} items
 * @param {{
 *   storageMode?: 'file-system' | 'indexed-db',
 *   onProgress?: (progress: { current: number, total: number, fileName: string }) => void,
 *   onVolumeImported?: () => void | Promise<void>
 * }} [callbacks]
 * @returns {Promise<{ error: string | null }>}
 */
export async function importVolumeFiles(items, callbacks) {
	const { storageMode = STORAGE_MODES.INDEXED_DB, onProgress, onVolumeImported } = callbacks ?? {};
	const importItems = await normalizeImportItems(items);
	const cbzItems = importItems.filter((item) => /\.cbz$/i.test(item.file.name));
	if (cbzItems.length === 0) {
		if (importItems.length > 0) {
			return { error: 'That doesn\u2019t look like a .cbz file.' };
		}
		return { error: null };
	}

	/** @type {string[]} */
	const failures = [];
	/** @type {Set<string>} */
	const importedManga = new Set();
	const [volumesBeforeImport, savedSeriesOrder] = await Promise.all([
		listVolumes(),
		getSeriesOrder()
	]);
	const existingManga = new Set(
		volumesBeforeImport.map((volume) => normalizeMangaName(volume.mangaName))
	);

	for (const [index, item] of cbzItems.entries()) {
		const { file, fileHandle } = item;
		onProgress?.({ current: index, total: cbzItems.length, fileName: file.name });
		try {
			const shouldStoreHandle = storageMode === STORAGE_MODES.FILE_SYSTEM && fileHandle;
			const volume = await importCbz(file, {
				storageMode: shouldStoreHandle ? STORAGE_MODES.FILE_SYSTEM : STORAGE_MODES.INDEXED_DB,
				fileHandle
			});
			await saveVolume(volume);
			importedManga.add(normalizeMangaName(volume.mangaName));
			await refreshLocalCover(volume.mangaName);
			await onVolumeImported?.();
			onProgress?.({ current: index + 1, total: cbzItems.length, fileName: file.name });
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Failed to import the CBZ.';
			failures.push(`${file.name}: ${message}`);
		}
	}

	for (const mangaName of importedManga) {
		await ensureLocalProgress(mangaName);
	}

	const newManga = [...importedManga].filter((mangaName) => !existingManga.has(mangaName));
	if (newManga.length > 0) {
		const orderedExistingManga = savedSeriesOrder.filter((mangaName) => existingManga.has(mangaName));
		const orderedExistingSet = new Set(orderedExistingManga);
		const unorderedExistingManga = [...existingManga]
			.filter((mangaName) => !orderedExistingSet.has(mangaName))
			.sort((a, b) => a.localeCompare(b));
		await saveSeriesOrder([...orderedExistingManga, ...unorderedExistingManga, ...newManga]);
	}

	if (importedManga.size > 0) {
		await onVolumeImported?.();
	}

	if (failures.length === cbzItems.length) {
		return { error: failures.join('\n') };
	}

	if (failures.length > 0) {
		const imported = cbzItems.length - failures.length;
		return {
			error: `Imported ${imported} volume${imported === 1 ? '' : 's'}. Some files failed:\n${failures.join('\n')}`
		};
	}

	return { error: null };
}
