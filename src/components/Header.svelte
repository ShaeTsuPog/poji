<script>
	import { ChevronDown, LogOut, Settings, User } from 'lucide-svelte';
	import {
		clearAccessToken,
		getAuthorizationUrl,
		getCachedViewer,
		getViewer,
		isAuthenticated
	} from '../lib/anilist-auth.js';

	let { onauthchange, onsettingsopen } = $props();

	const clientId = import.meta.env.VITE_ANILIST_CLIENT_ID ?? '';

	let connected = $state(isAuthenticated());
	/** @type {{ id: number, name: string, avatarUrl: string | null } | null} */
	let viewer = $state(isAuthenticated() ? getCachedViewer() : null);
	let logoPressed = $state(false);

	async function refreshViewer() {
		if (!isAuthenticated()) {
			connected = false;
			viewer = null;
			return;
		}

		try {
			const result = await getViewer({ maxAgeMs: 60 * 1000 });
			if (result) {
				connected = true;
				viewer = result;
			} else {
				clearAccessToken();
				connected = false;
				viewer = null;
				onauthchange?.();
			}
		} catch {
			connected = isAuthenticated();
		}
	}

	refreshViewer();

	function connect() {
		if (!clientId) return;
		window.location.href = getAuthorizationUrl(clientId);
	}

	function disconnect() {
		clearAccessToken();
		connected = false;
		viewer = null;
		onauthchange?.();
	}

	function openSettings() {
		onsettingsopen?.();
	}

	/** @param {PointerEvent} event */
	function handleLogoPointerDown(event) {
		if (event.button !== 0) return;
		logoPressed = true;
	}

	function handlePressUp() {
		logoPressed = false;
	}
</script>

<svelte:window onpointerup={handlePressUp} onpointercancel={handlePressUp} />

<header class="topbar">
	<div class="inner">
		<div class="brand">
			<button
				type="button"
				class={['logo', { pressed: logoPressed }]}
				onpointerdown={handleLogoPointerDown}
				onpointerup={handlePressUp}
				onpointercancel={handlePressUp}
			>poji</button>
		</div>

		<div class="actions">
			{#if connected && viewer}
				<div class="profile">
					<div class="profile-trigger" aria-haspopup="menu" aria-label="Account menu">
						{#if viewer.avatarUrl}
							<img class="avatar" src={viewer.avatarUrl} alt="" />
						{:else}
							<span class="avatar-fallback" aria-hidden="true">
								{viewer.name.charAt(0).toUpperCase()}
							</span>
						{/if}
						<ChevronDown size={14} class="profile-chevron" aria-hidden="true" />
					</div>
					<div class="menu" role="menu">
						<div class="menu-row menu-name">
							<User size={14} aria-hidden="true" />
							<span>{viewer.name}</span>
						</div>
						<button type="button" class="menu-row menu-item" role="menuitem" onclick={openSettings}>
							<Settings size={14} aria-hidden="true" />
							<span>Settings</span>
						</button>
						<button type="button" class="menu-row menu-item" role="menuitem" onclick={disconnect}>
							<LogOut size={14} aria-hidden="true" />
							<span>Log out</span>
						</button>
					</div>
				</div>
			{:else}
				{#if clientId}
					<button type="button" class="login-btn" onclick={connect}>Login</button>
				{/if}
				<button type="button" class="settings-trigger" aria-label="Settings" onclick={openSettings}>
					<Settings size={17} aria-hidden="true" />
				</button>
			{/if}
		</div>
	</div>
</header>

<style>
	.topbar {
		flex-shrink: 0;
		background: #0d0d0f;
		border-bottom: 1px solid #2a2a32;
		padding: 0 var(--layout-padding-inline);
	}

	.inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: min(var(--layout-max-width), 100%);
		height: 4.5rem;
		margin: 0 auto;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.logo {
		padding: 0;
		border: none;
		background: transparent;
		display: inline-flex;
		align-items: baseline;
		user-select: none;
		cursor: pointer;
		transform: scale(1);
		transition: transform 120ms cubic-bezier(0.33, 1, 0.68, 1);
		font-family:
			'Helvetica Neue',
			Helvetica,
			Arial,
			sans-serif;
		font-size: 1.625rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1;
		color: #8a7ff0;
	}

	.logo.pressed {
		transform: scale(0.94);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2rem;
		font-family: 'Overpass', sans-serif;
	}

	.settings-trigger {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		border-radius: 0.375rem;
		background: transparent;
		color: #8a8a92;
		cursor: pointer;
		transition:
			background-color 150ms ease,
			color 150ms ease;
	}

	.settings-trigger:hover {
		background: rgba(255, 255, 255, 0.06);
		color: #d8d8de;
	}

	.login-btn {
		padding: 0.4rem 0.9rem;
		border: none;
		border-radius: 0.375rem;
		background: transparent;
		color: #9a9aa3;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: color 150ms ease;
	}

	.login-btn:hover {
		color: #c8c8d0;
	}

	.profile {
		position: relative;
	}

	.profile-trigger {
		all: unset;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		cursor: pointer;
		font-family: inherit;
	}

	.profile-trigger:focus-visible .avatar,
	.profile-trigger:focus-visible .avatar-fallback {
		box-shadow: 0 0 0 2px rgba(138, 127, 240, 0.45);
	}

	.avatar {
		width: 2rem;
		height: 2rem;
		object-fit: cover;
		border-radius: 0.25rem;
	}

	.avatar-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 0.25rem;
		background: #2a2a32;
		color: #d8d8de;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.profile-trigger :global(.profile-chevron) {
		flex-shrink: 0;
		color: #6a6a72;
	}

	.menu {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		min-width: 10rem;
		padding: 0.375rem;
		border: 1px solid #2a2a32;
		border-radius: 0.5rem;
		background: #141418;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
		z-index: 20;
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transition:
			opacity 150ms ease,
			visibility 150ms ease;
	}

	.menu::before {
		content: '';
		position: absolute;
		bottom: 100%;
		left: 0;
		right: 0;
		height: 0.5rem;
	}

	.profile:hover .menu,
	.profile:focus-within .menu {
		opacity: 1;
		visibility: visible;
		pointer-events: auto;
	}

	.menu-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		min-height: 1.875rem;
		padding: 0 0.625rem;
		box-sizing: border-box;
		font-family: inherit;
		font-size: 0.8rem;
		font-weight: 500;
		color: #9a9aa3;
	}

	.menu-row :global(svg) {
		display: block;
		flex-shrink: 0;
		width: 14px;
		height: 14px;
		color: #9a9aa3;
	}

	.menu-row span {
		line-height: 14px;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transform: translateY(1.5px); /* god knows why it's not aligning right */
	}

	.menu-name {
		user-select: none;
	}

	.menu-item {
		border: none;
		border-radius: 0.375rem;
		background: transparent;
		text-align: left;
		cursor: pointer;
		appearance: none;
	}

	.menu-item:hover {
		background: rgba(138, 127, 240, 0.12);
	}

	.menu-item:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}
</style>
