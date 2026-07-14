import { anilistFetch } from './anilist-fetch.js';

const TOKEN_KEY = 'anilist-access-token';
const VIEWER_KEY = 'anilist-viewer';
const VIEWER_FETCHED_AT_KEY = 'anilist-viewer-fetched-at';

/** @returns {{ id: number, name: string, avatarUrl: string | null } | null} */
export function getCachedViewer() {
	try {
		const raw = localStorage.getItem(VIEWER_KEY);
		if (!raw) return null;

		const viewer = JSON.parse(raw);
		if (
			typeof viewer?.id === 'number' &&
			typeof viewer?.name === 'string' &&
			(viewer.avatarUrl == null || typeof viewer.avatarUrl === 'string')
		) {
			return viewer;
		}
	} catch {
		// ignore invalid cache
	}

	return null;
}

/** @param {{ id: number, name: string, avatarUrl: string | null }} viewer */
function setCachedViewer(viewer) {
	localStorage.setItem(VIEWER_KEY, JSON.stringify(viewer));
	localStorage.setItem(VIEWER_FETCHED_AT_KEY, String(Date.now()));
}

function clearCachedViewer() {
	localStorage.removeItem(VIEWER_KEY);
	localStorage.removeItem(VIEWER_FETCHED_AT_KEY);
}

function getCachedViewerAgeMs() {
	const raw = localStorage.getItem(VIEWER_FETCHED_AT_KEY);
	if (!raw) return Infinity;

	const fetchedAt = Number(raw);
	if (!Number.isFinite(fetchedAt)) return Infinity;

	return Date.now() - fetchedAt;
}

/** @returns {string | null} */
export function getAccessToken() {
	return localStorage.getItem(TOKEN_KEY);
}

/** @param {string} token */
export function setAccessToken(token) {
	localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken() {
	localStorage.removeItem(TOKEN_KEY);
	clearCachedViewer();
}

export function isAuthenticated() {
	return getAccessToken() != null;
}

/**
 * @param {string} clientId
 * @returns {string}
 */
export function getAuthorizationUrl(clientId) {
	const params = new URLSearchParams({
		client_id: clientId,
		response_type: 'token'
	});
	return `https://anilist.co/api/v2/oauth/authorize?${params}`;
}

/**
 * Parses the implicit-grant access token from the URL hash after redirect.
 * @returns {boolean} Whether a token was found and stored.
 */
export function handleOAuthCallback() {
	const hash = window.location.hash.slice(1);
	if (!hash) return false;

	const params = new URLSearchParams(hash);
	const token = params.get('access_token');
	if (!token) return false;

	setAccessToken(token);
	const url = new URL(window.location.href);
	url.hash = '';
	window.history.replaceState(null, '', url.pathname + url.search);
	return true;
}

/**
 * @param {{ maxAgeMs?: number }} [options]
 * @returns {Promise<{ id: number, name: string, avatarUrl: string | null } | null>}
 */
export async function getViewer(options) {
	const token = getAccessToken();
	if (!token) return null;

	const cachedViewer = getCachedViewer();
	if (cachedViewer && options?.maxAgeMs != null && getCachedViewerAgeMs() < options.maxAgeMs) {
		return cachedViewer;
	}

	const response = await anilistFetch(
		'getViewer',
		{
			query: 'query { Viewer { id name avatar { medium } } }'
		},
		token
	);

	if (!response.ok) return null;

	const json = await response.json();
	if (json.errors) return null;

	const viewer = json.data?.Viewer;
	if (!viewer) return null;

	const result = {
		id: viewer.id,
		name: viewer.name,
		avatarUrl: viewer.avatar?.medium ?? null
	};

	setCachedViewer(result);
	return result;
}
