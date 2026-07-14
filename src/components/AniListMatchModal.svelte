<script>
	import { onMount } from 'svelte';
	import { searchManga, formatMediaTitle } from '../lib/anilist.js';
	import { closeModal } from '../lib/modal-animation.js';

	let { mangaName, aniListId = null, aniListTitle = null, onconfirm, onclose } = $props();

	let query = $state('');
	let results = $state([]);
	let loading = $state(false);
	let error = $state(null);
	let selected = $state(null);
	let confirming = $state(false);

	let dialog = $state.raw(null);
	let closed = false;

	onMount(() => {
		query = mangaName;
		dialog?.showModal();
		runSearch(mangaName);
	});

	/** @param {string} value */
	async function runSearch(value) {
		const trimmed = value.trim();
		if (!trimmed) {
			results = [];
			return;
		}

		loading = true;
		error = null;
		try {
			results = await searchManga(trimmed);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Search failed.';
			results = [];
		} finally {
			loading = false;
		}
	}

	function handleSearchInput(event) {
		query = event.currentTarget.value;
	}

	function handleSearchSubmit(event) {
		event.preventDefault();
		runSearch(query);
	}

	/** @param {import('../lib/anilist.js').AniListMedia} media */
	function selectMedia(media) {
		selected = media;
	}

	async function confirm() {
		if (!selected) return;
		confirming = true;
		error = null;
		try {
			await onconfirm({
				aniListId: selected.id,
				aniListTitle: formatMediaTitle(selected.title),
				coverImageUrl:
					selected.coverImage?.extraLarge ??
					selected.coverImage?.large ??
					selected.coverImage?.medium ??
					null
			});
			close();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save the match.';
		} finally {
			confirming = false;
		}
	}

	async function close() {
		if (closed) return;
		closed = true;
		await closeModal(dialog);
		onclose();
	}

	function handleBackdropClick(event) {
		if (event.target === dialog) {
			close();
		}
	}

	function handleClose() {
		close();
	}

	function handleDialogClose() {
		close();
	}

	function handleCancel(event) {
		event.preventDefault();
		void close();
	}
</script>

<dialog class="modal" bind:this={dialog} onclick={handleBackdropClick} onclose={handleDialogClose} oncancel={handleCancel}>
	<div class="panel">
		<header class="header">
			<h2>Match on AniList</h2>
			<button type="button" class="icon-btn" aria-label="Close" onclick={handleClose}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
					<path d="M18 6 6 18" />
					<path d="m6 6 12 12" />
				</svg>
			</button>
		</header>

		{#if aniListId}
			<p class="current-match">
				Currently matched to <strong>{aniListTitle ?? `ID ${aniListId}`}</strong>
			</p>
		{/if}

		<form class="search" onsubmit={handleSearchSubmit}>
			<input
				type="search"
				class="search-input"
				placeholder="Search AniList…"
				value={query}
				oninput={handleSearchInput}
			/>
			<button type="submit" class="search-btn" disabled={loading}>Search</button>
		</form>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<div class="results" aria-busy={loading}>
			{#if loading && results.length === 0}
				<p class="status">Searching…</p>
			{:else if results.length === 0}
				<p class="status">No results. Try a different search.</p>
			{:else}
				<ul class="result-list">
					{#each results as media, index (media.id)}
						<li style:--result-index={index}>
							<button
								type="button"
								class={['result', { selected: selected?.id === media.id }]}
								onclick={() => selectMedia(media)}
							>
								{#if media.coverImage?.medium}
									<img class="cover" src={media.coverImage.medium} alt="" />
								{:else}
									<div class="cover placeholder" aria-hidden="true"></div>
								{/if}
								<span class="result-title">{formatMediaTitle(media.title)}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<footer class="footer">
			<button type="button" class="btn secondary" onclick={handleClose}>Cancel</button>
			<button
				type="button"
				class="search-btn"
				disabled={!selected || confirming}
				onclick={confirm}
			>
				{confirming ? 'Saving…' : 'Confirm match'}
			</button>
		</footer>
	</div>
</dialog>

<style>
	.modal {
		margin: auto;
		padding: 0;
		border: none;
		background: transparent;
		max-width: min(480px, calc(100vw - 2rem));
		width: 100%;
		user-select: none;
	}

	.modal::backdrop {
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(4px);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		height: min(80vh, 560px);
		padding: 1.25rem;
		border: 1px solid #2a2a32;
		border-radius: 1rem;
		background: #16161a;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: #fff;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border: none;
		border-radius: 0.5rem;
		background: transparent;
		color: #9a9aa3;
		cursor: pointer;
	}

	.icon-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: #e8e8ea;
	}

	.icon-btn svg {
		width: 1.125rem;
		height: 1.125rem;
	}

	.current-match {
		margin: 0;
		font-size: 0.85rem;
		color: #9a9aa3;
	}

	.current-match strong {
		color: #c9c4f7;
	}

	.search {
		display: flex;
		gap: 0.5rem;
	}

	.search-input {
		flex: 1;
		min-width: 0;
		padding: 0.625rem 0.75rem;
		border: 1px solid #2a2a32;
		border-radius: 0.5rem;
		background: #0d0d0f;
		color: #e8e8ea;
		font-size: 0.9rem;
	}

	.search-input:focus {
		outline: none;
		border-color: #8a7ff0;
	}

	.search-input::-webkit-search-decoration,
	.search-input::-webkit-search-results-button,
	.search-input::-webkit-search-results-decoration {
		display: none;
	}

	.search-input::-webkit-search-cancel-button {
		-webkit-appearance: none;
		appearance: none;
		width: 0.875rem;
		height: 0.875rem;
		margin-right: 0.125rem;
		background: center / contain no-repeat
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239a9aa3' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M18 6 6 18M6 6l12 12'/%3E%3C/svg%3E");
		cursor: pointer;
		opacity: 0.55;
	}

	.search-input::-webkit-search-cancel-button:hover {
		opacity: 0.85;
	}

	.search-input::-ms-clear {
		display: none;
	}

	.search-btn {
		padding: 0.625rem 1rem;
		border: none;
		border-radius: 0.5rem;
		background: rgba(138, 127, 240, 0.2);
		color: #c9c4f7;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.search-btn:hover:not(:disabled) {
		background: rgba(138, 127, 240, 0.3);
	}

	.search-btn:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.error {
		margin: 0;
		font-size: 0.85rem;
		color: #f0867f;
	}

	.results {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.status {
		margin: 0;
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		font-size: 0.9rem;
		color: #9a9aa3;
	}

	.result-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.result-list li {
		opacity: 0;
		transform: translateY(10px);
		animation: result-enter 220ms ease-out forwards;
		animation-delay: min(calc(var(--result-index) * 32ms), 220ms);
	}

	.result {
		all: unset;
		box-sizing: border-box;
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background-color 150ms ease;
	}

	.result:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.result.selected {
		background: rgba(138, 127, 240, 0.15);
	}

	.cover {
		width: 2.5rem;
		height: 3.5rem;
		flex-shrink: 0;
		border-radius: 0.25rem;
		object-fit: cover;
		background: #2a2a32;
	}

	.cover.placeholder {
		display: block;
	}

	.result-title {
		font-size: 0.9rem;
		color: #e8e8ea;
		line-height: 1.3;
	}

	.footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding-top: 0.25rem;
	}

	.btn {
		padding: 0.625rem 1rem;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.btn.secondary {
		background: rgba(255, 255, 255, 0.06);
		color: #d8d8de;
	}

	.btn.secondary:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	@keyframes result-enter {
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.result-list li {
			opacity: 1;
			transform: none;
			transition: none !important;
			animation: none !important;
		}
	}
</style>
