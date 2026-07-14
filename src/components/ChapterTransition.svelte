<script>
	/** @type {{ mangaName: string, currentChapter: string, adjacentChapter: { name: string } | null, direction: 'end' | 'start' }} */
	let { mangaName, currentChapter, adjacentChapter, direction } = $props();

	const heading = $derived(direction === 'end' ? 'Chapter complete' : 'Chapter start');
	const adjacentLabel = $derived(direction === 'end' ? 'Up next' : 'Previous chapter');
	const hint = $derived(
		direction === 'end'
			? 'Press → or tap the right side to continue'
			: 'Press ← or tap the left side to go back'
	);
	const emptyMessage = $derived(
		direction === 'end' ? "You're all caught up" : 'This is the first chapter'
	);
</script>

<div class="chapter-transition">
	<p class="series">{mangaName}</p>
	<h1>{heading}</h1>
	<p class="current">{currentChapter}</p>

	{#if adjacentChapter}
		<div class="divider" aria-hidden="true"></div>
		<p class="label">{adjacentLabel}</p>
		<p class="adjacent">{adjacentChapter.name}</p>
		<p class="hint">{hint}</p>
	{:else}
		<p class="hint empty">{emptyMessage}</p>
	{/if}
</div>

<style>
	.chapter-transition {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		max-width: 28rem;
		padding: 2rem;
		text-align: center;
	}

	.series {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 500;
		color: #9a9aa3;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	h1 {
		margin: 0.25rem 0 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: #e8e8ea;
	}

	.current {
		margin: 0;
		font-size: 1rem;
		color: #b9b9c1;
		line-height: 1.5;
	}

	.divider {
		width: 3rem;
		height: 1px;
		margin: 0.75rem 0;
		background: #3a3a42;
	}

	.label {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 500;
		color: #8a7ff0;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.adjacent {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 500;
		color: #e8e8ea;
		line-height: 1.5;
	}

	.hint {
		margin: 1rem 0 0;
		font-size: 0.85rem;
		color: #6a6a74;
	}

	.hint.empty {
		color: #9a9aa3;
	}
</style>
