<script>
	import { onMount, untrack } from 'svelte';
	import { GripVertical, Trash2, Upload } from 'lucide-svelte';
	import { closeModal } from '../lib/modal-animation.js';

	/** @typedef {{ mangaName: string, volumeCount: number }} SeriesEntry */

	/** @type {{ series: SeriesEntry[], importing?: boolean, importError?: string | null, onimportbrowse?: () => void, onsave: (order: string[]) => void | Promise<void>, onclose: () => void }} */
	let { series, importing = false, importError = null, onimportbrowse, onsave, onclose } = $props();

	/** @type {SeriesEntry[]} */
	let items = $state([]);
	let dragIndex = $state(null);
	let overIndex = $state(null);
	let dragging = $state(false);
	let saving = $state(false);
	let error = $state(null);
	let locallyRemoved = $state(new Set());

	let dialog = $state.raw(null);

	onMount(() => {
		dialog?.showModal();
	});

	$effect(() => {
		const nextSeries = series;
		items = untrack(() => mergeSeriesItems(items, nextSeries, locallyRemoved));
	});

	/**
	 * @param {SeriesEntry[]} currentItems
	 * @param {SeriesEntry[]} nextSeries
	 * @param {Set<string>} removedNames
	 */
	function mergeSeriesItems(currentItems, nextSeries, removedNames) {
		const incomingByName = new Map(nextSeries.map((entry) => [entry.mangaName, entry]));
		const currentNames = new Set(currentItems.map((entry) => entry.mangaName));
		const merged = currentItems
			.filter((entry) => incomingByName.has(entry.mangaName))
			.map((entry) => ({
				...entry,
				volumeCount: incomingByName.get(entry.mangaName)?.volumeCount ?? entry.volumeCount
			}));

		for (const entry of nextSeries) {
			if (!currentNames.has(entry.mangaName) && !removedNames.has(entry.mangaName)) {
				merged.push({ ...entry });
			}
		}

		return merged;
	}

	/** @param {number} from @param {number} to */
	function moveItem(from, to) {
		if (from === to || from == null || to == null) return;
		const next = [...items];
		const [moved] = next.splice(from, 1);
		next.splice(to, 0, moved);
		items = next;
	}

	/** @param {PointerEvent} event @param {number} index */
	function handleReorderPointerDown(event, index) {
		if (event.button !== 0) return;
		event.preventDefault();
		dragging = true;
		dragIndex = index;
		overIndex = index;
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	/** @param {PointerEvent} event */
	function handleReorderPointerMove(event) {
		if (!dragging) return;

		const target = document.elementFromPoint(event.clientX, event.clientY);
		const row = target?.closest('[data-series-index]');
		if (!row) return;

		const index = Number(row.getAttribute('data-series-index'));
		if (Number.isNaN(index) || index === overIndex) return;
		overIndex = index;
	}

	/** @param {PointerEvent} event */
	function handleReorderPointerUp(event) {
		if (!dragging) return;

		if (dragIndex != null && overIndex != null) {
			moveItem(dragIndex, overIndex);
		}

		dragging = false;
		dragIndex = null;
		overIndex = null;
		event.currentTarget.releasePointerCapture(event.pointerId);
	}

	/** @param {string} mangaName */
	function removeItem(mangaName) {
		locallyRemoved = new Set([...locallyRemoved, mangaName]);
		items = items.filter((entry) => entry.mangaName !== mangaName);
	}

	async function save() {
		saving = true;
		error = null;
		try {
			await onsave(items.map((entry) => entry.mangaName));
			void close();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save library changes.';
		} finally {
			saving = false;
		}
	}

	function handleBackdropClick(event) {
		if (event.target === dialog) {
			void close();
		}
	}

	function handleClose() {
		void close();
	}

	async function close() {
		await closeModal(dialog);
	}

	function handleCancel(event) {
		event.preventDefault();
		void close();
	}

	function handleDialogClose() {
		onclose();
	}
</script>

<dialog class="modal" bind:this={dialog} onclick={handleBackdropClick} onclose={handleDialogClose} oncancel={handleCancel}>
	<div class="panel">
		<header class="header">
			<h2>Edit library</h2>
			<button type="button" class="icon-btn" aria-label="Close" onclick={handleClose}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
					<path d="M18 6 6 18" />
					<path d="m6 6 12 12" />
				</svg>
			</button>
		</header>

		<div class="import-card">
			<div class="import-copy">
				<span class="import-title">Add volumes</span>
				<span class="import-subtitle">
					Import <code>.cbz</code> or <code>.zip</code> files, or drag and drop anywhere.
				</span>
			</div>
			<button
				type="button"
				class="import-btn"
				disabled={importing}
				aria-busy={importing}
				onclick={onimportbrowse}
			>
				<Upload size={16} aria-hidden="true" />
				<span>{importing ? 'Importing' : 'Import'}</span>
			</button>
		</div>

		<div class="section-separator" aria-hidden="true"></div>

		<p class="hint">Drag to reorder. Delete removes all volumes for a series.</p>

		{#if importError}
			<p class="error">{importError}</p>
		{/if}

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<ul class={['series-list', { dragging }]}>
			{#each items as entry, index (entry.mangaName)}
				<li
					data-series-index={index}
					class={[
						'series-row',
						{
							'drag-source': dragging && dragIndex === index,
							'drop-target': dragging && overIndex === index && dragIndex !== index
						}
					]}
				>
					<button
						type="button"
						class="drag-handle"
						aria-label={`Reorder ${entry.mangaName}`}
						onpointerdown={(event) => handleReorderPointerDown(event, index)}
						onpointermove={handleReorderPointerMove}
						onpointerup={handleReorderPointerUp}
						onpointercancel={handleReorderPointerUp}
					>
						<GripVertical size={16} aria-hidden="true" />
					</button>
					<span class="series-name">{entry.mangaName}</span>
					<span class="volume-count">{entry.volumeCount} vol.</span>
					<button
						type="button"
						class="delete-btn"
						aria-label={`Delete ${entry.mangaName}`}
						onclick={() => removeItem(entry.mangaName)}
					>
						<Trash2 size={16} aria-hidden="true" />
					</button>
				</li>
			{:else}
				<li class="empty">No series left in your library.</li>
			{/each}
		</ul>

		<footer class="footer">
			<button type="button" class="btn secondary" onclick={handleClose}>Cancel</button>
			<button type="button" class="search-btn" disabled={saving} onclick={save}>
				{saving ? 'Saving…' : 'Save'}
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
		max-width: min(520px, calc(100vw - 2rem));
		width: 100%;
		user-select: none;
	}

	.modal::backdrop {
		background: rgba(0, 0, 0, 0.65);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
		border: 1px solid #2a2a32;
		border-radius: 1rem;
		background: #16161a;
		max-height: min(80vh, 640px);
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

	.hint {
		margin: 0;
		font-size: 0.85rem;
		color: #9a9aa3;
	}

	.import-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.875rem 1rem;
		border: 1px solid #2a2a32;
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.04);
	}

	.import-copy {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.import-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: #e8e8ea;
	}

	.import-subtitle {
		font-size: 0.78rem;
		color: #9a9aa3;
	}

	.import-subtitle code {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 0.875em;
		color: #d8d8de;
	}

	.import-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		flex-shrink: 0;
		min-width: 6.75rem;
		padding: 0.625rem 0.875rem;
		border: 1px solid rgba(138, 127, 240, 0.35);
		border-radius: 0.5rem;
		background: rgba(138, 127, 240, 0.14);
		color: #e8e5ff;
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color 150ms ease,
			border-color 150ms ease,
			color 150ms ease,
			opacity 150ms ease;
	}

	.import-btn:hover:not(:disabled) {
		border-color: rgba(157, 146, 245, 0.65);
		background: rgba(138, 127, 240, 0.22);
		color: #fff;
	}

	.import-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.section-separator {
		height: 1px;
		background: #2a2a32;
	}

	@media (max-width: 520px) {
		.import-card {
			align-items: stretch;
			flex-direction: column;
		}

		.import-btn {
			width: 100%;
		}
	}

	.error {
		margin: 0;
		font-size: 0.85rem;
		color: #f0867f;
	}

	.series-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		overflow-y: auto;
		overflow-x: hidden;
		min-height: 0;
		flex: 1;
	}

	.series-list.dragging {
		user-select: none;
	}

	.series-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.625rem 0.75rem;
		border-radius: 0.625rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid #2a2a32;
	}

	.series-list:not(.dragging) .series-row {
		transition:
			background-color 150ms ease,
			border-color 150ms ease,
			opacity 150ms ease;
	}

	.series-row.drag-source {
		opacity: 0.55;
	}

	.series-row.drop-target {
		border-color: #8a7ff0;
		background: rgba(138, 127, 240, 0.1);
	}

	.drag-handle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: none;
		border-radius: 0.375rem;
		background: transparent;
		color: #6a6a72;
		flex-shrink: 0;
		cursor: grab;
		touch-action: none;
	}

	.drag-handle:active {
		cursor: grabbing;
	}

	.series-name {
		flex: 1;
		min-width: 0;
		font-size: 0.9rem;
		font-weight: 500;
		color: #e8e8ea;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.volume-count {
		flex-shrink: 0;
		font-size: 0.75rem;
		color: #9a9aa3;
	}

	.delete-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		border: none;
		border-radius: 0.5rem;
		background: transparent;
		color: #9a9aa3;
		cursor: pointer;
		transition:
			background-color 150ms ease,
			color 150ms ease;
	}

	.delete-btn:hover {
		background: rgba(240, 134, 127, 0.12);
		color: #f0867f;
	}

	.empty {
		padding: 1.5rem 0;
		text-align: center;
		font-size: 0.9rem;
		color: #9a9aa3;
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
</style>
