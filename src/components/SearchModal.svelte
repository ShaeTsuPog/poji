<script>
	import { onMount, tick } from 'svelte';
	import { Search, X } from 'lucide-svelte';
	import { closeModal } from '../lib/modal-animation.js';

	/**
	 * @typedef {Object} SearchResult
	 * @property {string} mangaName
	 * @property {string} chapterLabel
	 * @property {string} volumeId
	 * @property {string} chapterId
	 * @property {number} [pageIndex]
	 */

	/** @type {{ results: SearchResult[], openingId?: string | null, onselect: (result: SearchResult) => void | Promise<void>, onclose: () => void }} */
	let { results, openingId = null, onselect, onclose } = $props();

	let dialog = $state.raw(null);
	let input = $state.raw(null);
	let query = $state('');
	let activeIndex = $state(0);
	let closed = false;

	let filteredResults = $derived.by(() => {
		const terms = query
			.trim()
			.toLocaleLowerCase()
			.split(/\s+/)
			.filter(Boolean);

		if (terms.length === 0) return results;

		return results.filter((result) => {
			const name = result.mangaName.toLocaleLowerCase();
			return terms.every((term) => name.includes(term));
		});
	});

	let activeResult = $derived(filteredResults[activeIndex] ?? null);

	onMount(async () => {
		dialog?.showModal();
		await tick();
		input?.focus();
		input?.select();
	});

	$effect(() => {
		query;
		activeIndex = 0;
	});

	$effect(() => {
		if (activeIndex >= filteredResults.length) {
			activeIndex = Math.max(0, filteredResults.length - 1);
		}
	});

	async function close() {
		if (closed) return;
		closed = true;
		await closeModal(dialog);
		onclose();
	}

	function handleBackdropClick(event) {
		if (event.target === dialog) close();
	}

	function moveSelection(delta) {
		if (filteredResults.length === 0) return;
		activeIndex = (activeIndex + delta + filteredResults.length) % filteredResults.length;
	}

	async function selectActive() {
		if (!activeResult || openingId != null) return;
		await onselect(activeResult);
		close();
	}

	/** @param {KeyboardEvent} event */
	function handleKeydown(event) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			moveSelection(1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			moveSelection(-1);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			void selectActive();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			close();
		}
	}

	function handleCancel(event) {
		event.preventDefault();
		void close();
	}

	/** @param {SearchResult} result */
	function resultId(result) {
		return `search-result-${result.volumeId}-${result.chapterId}`;
	}
</script>

<dialog class="modal" bind:this={dialog} onclick={handleBackdropClick} onkeydown={handleKeydown} oncancel={handleCancel}>
	<div class="panel">
		<div class="search-row">
			<Search size={18} aria-hidden="true" />
			<input
				bind:this={input}
				type="search"
				placeholder="Search manga"
				aria-label="Search manga"
				aria-controls="search-results"
				aria-activedescendant={activeResult ? resultId(activeResult) : undefined}
				value={query}
				oninput={(event) => (query = event.currentTarget.value)}
			/>
			<button type="button" class="close-btn" aria-label="Close search" onclick={close}>
				<X size={18} aria-hidden="true" />
			</button>
		</div>

		<ul id="search-results" class="results" role="listbox" aria-label="Manga">
			{#each filteredResults as result, index (result.mangaName)}
				<li role="option" aria-selected={index === activeIndex} id={resultId(result)}>
					<button
						type="button"
						class={['result', { active: index === activeIndex }]}
						disabled={openingId != null}
						aria-busy={openingId === `${result.volumeId}:${result.chapterId}`}
						onmouseenter={() => (activeIndex = index)}
						onclick={() => {
							activeIndex = index;
							void selectActive();
						}}
					>
						<span class="title">{result.mangaName}</span>
						<span class="chapter">{result.chapterLabel}</span>
					</button>
				</li>
			{:else}
				<li class="empty">No manga found.</li>
			{/each}
		</ul>
	</div>
</dialog>

<style>
	.modal {
		margin: auto;
		padding: 0;
		border: none;
		background: transparent;
		max-width: min(560px, calc(100vw - 2rem));
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
		overflow: hidden;
		height: min(400px, calc(100vh - 3rem));
		border: 1px solid #2a2a32;
		border-radius: 0.75rem;
		background: #16161a;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 3.25rem;
		padding: 0 0.875rem;
		border-bottom: 1px solid #2a2a32;
		color: #8a8a92;
	}

	input {
		flex: 1;
		min-width: 0;
		height: 3.25rem;
		border: none;
		outline: none;
		background: transparent;
		color: #e8e8ea;
		font: inherit;
		font-size: 1rem;
	}

	input::placeholder {
		color: #6a6a72;
	}

	input::-webkit-search-cancel-button {
		display: none;
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		border: none;
		border-radius: 0.5rem;
		background: transparent;
		color: #8a8a92;
		cursor: pointer;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: #e8e8ea;
	}

	.results {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		margin: 0;
		padding: 0.375rem;
		overflow-y: auto;
		list-style: none;
	}

	.result {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-height: 2.75rem;
		padding: 0.5rem 0.625rem;
		border: none;
		border-radius: 0.5rem;
		background: transparent;
		color: #d8d8de;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.result.active {
		background: rgba(138, 127, 240, 0.14);
		color: #fff;
	}

	.result:disabled {
		cursor: wait;
		opacity: 0.72;
	}

	.title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.92rem;
		font-weight: 500;
	}

	.chapter {
		flex-shrink: 0;
		color: #9f98ed;
		font-size: 0.78rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.empty {
		padding: 1.75rem 0.75rem;
		color: #8a8a92;
		font-size: 0.9rem;
		text-align: center;
	}
</style>
