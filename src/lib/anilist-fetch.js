const API_URL = 'https://graphql.anilist.co';

/**
 * @param {string} operation
 * @param {{ query: string, variables?: Record<string, unknown> }} body
 * @param {string | null} token
 * @returns {Promise<Response>}
 */
export function anilistFetch(operation, body, token = null) {
	console.info('[AniList]', operation, {
		at: new Date().toISOString(),
		authenticated: token != null,
		variables: body.variables ?? {}
	});

	return fetch(API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {})
		},
		body: JSON.stringify(body)
	});
}
