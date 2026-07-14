const MODAL_ANIMATION_MS = 120;
const closingDialogs = new WeakMap();

/** @param {HTMLDialogElement | null} dialog */
export function closeModal(dialog) {
	if (!dialog?.open) return Promise.resolve(false);

	const existingClose = closingDialogs.get(dialog);
	if (existingClose) return existingClose;

	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (prefersReducedMotion) {
		dialog.close();
		return Promise.resolve(true);
	}

	dialog.dataset.closing = 'true';

	const closePromise = new Promise((resolve) => {
		let done = false;
		let timeoutId = window.setTimeout(finish, MODAL_ANIMATION_MS);

		function cleanup() {
			window.clearTimeout(timeoutId);
			dialog.removeEventListener('animationend', handleAnimationEnd);
			dialog.removeEventListener('animationcancel', finish);
			closingDialogs.delete(dialog);
		}

		function finish() {
			if (done) return;
			done = true;
			cleanup();
			dialog.close();
			delete dialog.dataset.closing;
			resolve(true);
		}

		/** @param {AnimationEvent} event */
		function handleAnimationEnd(event) {
			if (event.target === dialog) {
				finish();
			}
		}

		dialog.addEventListener('animationend', handleAnimationEnd);
		dialog.addEventListener('animationcancel', finish);
	});

	closingDialogs.set(dialog, closePromise);
	return closePromise;
}
