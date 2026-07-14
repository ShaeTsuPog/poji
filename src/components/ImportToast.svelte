<script>
	/** @type {{ current: number, total: number, fileName?: string } | null} */
	let { importing = false, progress = null } = $props();

	let detail = $derived.by(() => {
		if (!progress) return 'Preparing import…';

		if (progress.total <= 1) {
			return progress.fileName ? `Processing ${progress.fileName}` : 'Processing volume…';
		}

		if (progress.current === 0) {
			return `0 of ${progress.total} volumes`;
		}

		return `${progress.current} of ${progress.total} volumes`;
	});
</script>

{#if importing}
	<div class="toast" role="status" aria-live="polite" aria-busy="true">
		<svg class="spinner" viewBox="0 0 24 24" aria-hidden="true">
			<circle cx="12" cy="12" r="9" />
		</svg>
		<div class="text">
			<p class="title">Importing volumes</p>
			<p class="detail">{detail}</p>
		</div>
	</div>
{/if}

<style>
	.toast {
		position: fixed;
		right: 1.25rem;
		bottom: 1.25rem;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 0.875rem;
		min-width: 14rem;
		max-width: min(20rem, calc(100vw - 2.5rem));
		padding: 0.875rem 1rem;
		border: 1px solid #2a2a32;
		border-radius: 0.75rem;
		background: #141418;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
		font-family: 'Overpass', sans-serif;
	}

	.spinner {
		flex-shrink: 0;
		width: 1.25rem;
		height: 1.25rem;
		animation: spin 0.9s linear infinite;
	}

	.spinner circle {
		fill: none;
		stroke: #8a7ff0;
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-dasharray: 40 20;
	}

	.text {
		min-width: 0;
	}

	.title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: #e8e8ea;
	}

	.detail {
		margin: 0.125rem 0 0;
		font-size: 0.8rem;
		color: #9a9aa3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
