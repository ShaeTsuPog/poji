const CHAPTER_CODE_RE = /\bc(\d+)\b/i;
/** danke-Empire style: "Series - 001 (v01) - p000 ..." */
const VOLUME_CHAPTER_RE = /\s-\s(\d+)\s+\(v\d+\)\s+-/i;
const TAG_RE = /\[([^\]]+)\]/g;

/** Bracket tags that are metadata, not chapter titles. */
const SKIP_TAGS = new Set([
	'cover',
	'toc',
	'dig',
	'digital',
	'digital-only',
	'digital-hd',
	'danke-empire',
	'viz media',
	'1r0n'
]);

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * @param {string} fileName
 * @returns {{ mangaName: string, volumeNumber: number | null }}
 */
export function parseVolumeFileName(fileName) {
	const base = fileName.replace(/\.cbz$/i, '');
	const match = base.match(/^(.+?)\s+v(\d+)\b/i);
	if (match) {
		return { mangaName: match[1].trim(), volumeNumber: parseInt(match[2], 10) };
	}
	return { mangaName: base.trim(), volumeNumber: null };
}

/**
 * @param {string} path Image path inside the CBZ archive.
 */
function parseChapterNumber(basename) {
	const chapterMatch = basename.match(CHAPTER_CODE_RE);
	if (chapterMatch) return parseInt(chapterMatch[1], 10);

	const volumeChapterMatch = basename.match(VOLUME_CHAPTER_RE);
	if (volumeChapterMatch) return parseInt(volumeChapterMatch[1], 10);

	return null;
}

function parseImagePath(path) {
	const basename = path.split('/').pop() ?? path;
	const chapterNumber = parseChapterNumber(basename);
	const tags = [...basename.matchAll(TAG_RE)].map((match) => match[1]);
	return { path, chapterNumber, tags };
}

/**
 * @param {string[]} tags
 * @returns {string | null}
 */
function extractChapterTitle(tags) {
	const lowerTags = tags.map((tag) => tag.toLowerCase());
	const digIndex = lowerTags.indexOf('dig');

	if (digIndex >= 0) {
		for (let i = digIndex + 1; i < tags.length; i++) {
			if (!SKIP_TAGS.has(lowerTags[i])) return tags[i];
		}
	}

	for (let i = 0; i < tags.length; i++) {
		if (!SKIP_TAGS.has(lowerTags[i])) return tags[i];
	}

	return null;
}

/**
 * Groups sorted image paths into chapters using filename conventions.
 *
 * @param {string[]} imagePaths Sorted image paths inside the CBZ.
 * @returns {{ id: string, number: number, name: string, pages: string[] }[]}
 */
export function groupIntoChapters(imagePaths) {
	/** @type {Map<number, { paths: string[], names: string[] }>} */
	const groups = new Map();

	for (const path of imagePaths) {
		const { chapterNumber, tags } = parseImagePath(path);
		const key = chapterNumber ?? 0;
		if (!groups.has(key)) groups.set(key, { paths: [], names: [] });
		const group = groups.get(key);
		group.paths.push(path);
		const title = extractChapterTitle(tags);
		if (title) group.names.push(title);
	}

	if (groups.size === 1 && groups.has(0)) {
		return [
			{
				id: 'all',
				number: 1,
				name: 'Full volume',
				pages: [...imagePaths]
			}
		];
	}

	return [...groups.entries()]
		.filter(([key]) => key !== 0)
		.sort(([a], [b]) => a - b)
		.map(([number, { paths, names }]) => {
			/** @type {Map<string, number>} */
			const nameCounts = new Map();
			for (const name of names) {
				nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
			}

			let bestName = null;
			let bestCount = 0;
			for (const [name, count] of nameCounts) {
				// Publisher/scanner tags repeat on every page; real titles do not.
				if (count >= paths.length) continue;
				if (count > bestCount) {
					bestName = name;
					bestCount = count;
				}
			}

			return {
				id: `c${String(number).padStart(3, '0')}`,
				number,
				name: bestName ?? `Chapter ${number}`,
				pages: paths.sort((a, b) => collator.compare(a, b))
			};
		});
}

/**
 * @param {File} file
 */
export function volumeId(file) {
	return `${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * @param {{ volumeNumber: number | null, chapters: { id: string, name: string }[] }} volume
 * @param {string} chapterId
 */
function volumeLabelFor(volume, chapterId) {
	const chapter = volume.chapters.find((entry) => entry.id === chapterId);
	const volumeLabel = volume.volumeNumber != null ? `Vol. ${volume.volumeNumber}` : 'Volume';
	return chapter ? `${volumeLabel} · ${chapter.name}` : volumeLabel;
}

/**
 * @param {{ mangaName: string, volumeNumber: number | null, chapters: { id: string, number: number, name: string }[] }} volume
 * @param {string} chapterId
 */
export function formatChapterTitle(volume, chapterId) {
	const chapter = volume.chapters.find((entry) => entry.id === chapterId);
	if (!chapter) return volume.mangaName;

	return `${volume.mangaName} · ${volumeLabelFor(volume, chapterId)}`;
}

/**
 * @param {{ volumeNumber: number | null, chapters: { id: string, number: number, name: string }[] }} volume
 * @param {string} chapterId
 */
export function formatChapterLabel(volume, chapterId) {
	return volumeLabelFor(volume, chapterId);
}
