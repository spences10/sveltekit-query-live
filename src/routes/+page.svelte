<script lang="ts">
	import {
		stream_recent_changes,
		type stream_pace,
		type wiki_snapshot,
	} from './wikimedia.remote';

	let running = $state(true);
	let pace = $state<stream_pace>('live');

	const feed = $derived(
		running ? stream_recent_changes({ pace }) : null,
	);
	const snapshot = $derived(feed ? await feed : stopped_snapshot());

	const integer = new Intl.NumberFormat('en-US');
	const signed = new Intl.NumberFormat('en-US', {
		signDisplay: 'exceptZero',
	});

	function relative_time(timestamp: number) {
		const seconds = Math.max(
			0,
			Math.round((Date.now() - timestamp) / 1000),
		);
		if (seconds < 60) return `${seconds}s ago`;
		const minutes = Math.round(seconds / 60);
		return `${minutes}m ago`;
	}

	function label(type: string) {
		if (type === 'new') return 'new page';
		if (type === 'log') return 'log';
		return type;
	}

	function stopped_snapshot(): wiki_snapshot {
		return {
			status: 'ended',
			message:
				'Stream stopped. No Wikimedia connection is open while paused.',
			updated_at: Date.now(),
			changes: [],
			stats: {
				total: 0,
				humans: 0,
				bots: 0,
				edits: 0,
				new_pages: 0,
				log_events: 0,
				net_bytes: 0,
			},
		};
	}
</script>

<svelte:head>
	<title>Live Wikimedia edits · SvelteKit query.live</title>
	<meta
		name="description"
		content="A SvelteKit query.live demo streaming Wikimedia recent changes in real time."
	/>
</svelte:head>

<main>
	<section class="hero" aria-labelledby="page-title">
		<div class="eyebrow">
			<span class:online={running && feed?.connected}></span>
			{#if !running}
				Stopped
			{:else if feed?.connected}
				Live connection
			{:else}
				Reconnecting
			{/if}
		</div>

		<div class="hero-grid">
			<div>
				<p class="kicker">SvelteKit remote functions</p>
				<h1 id="page-title">
					Wikipedia is editing itself right now.
				</h1>
				<p class="lede">
					This page uses <code>query.live</code> to turn Wikimedia EventStreams
					into a server-powered async generator. The UI updates as new edits
					arrive.
				</p>
			</div>

			<div class="connection-card">
				<p>{snapshot.status} · {pace}</p>
				<strong>{integer.format(snapshot.stats.total)}</strong>
				<span>changes seen in this session</span>

				<div class="controls" aria-label="Stream controls">
					<button
						type="button"
						onclick={() => (running = true)}
						disabled={running}
					>
						Start
					</button>
					<button
						type="button"
						onclick={() => (running = false)}
						disabled={!running}
					>
						Stop
					</button>
					<button
						type="button"
						class:active={pace === 'slow'}
						onclick={() => (pace = pace === 'slow' ? 'live' : 'slow')}
					>
						Slow-mo
					</button>
				</div>

				<button
					type="button"
					onclick={() => feed?.reconnect()}
					disabled={!feed}
				>
					Reconnect stream
				</button>
			</div>
		</div>
	</section>

	<section class="metrics" aria-label="Stream metrics">
		<div>
			<span>{integer.format(snapshot.stats.humans)}</span>
			<p>human edits</p>
		</div>
		<div>
			<span>{integer.format(snapshot.stats.bots)}</span>
			<p>bot edits</p>
		</div>
		<div>
			<span>{integer.format(snapshot.stats.new_pages)}</span>
			<p>new pages</p>
		</div>
		<div>
			<span>{signed.format(snapshot.stats.net_bytes)}</span>
			<p>net bytes</p>
		</div>
	</section>

	{#if snapshot.message}
		<p class="notice">{snapshot.message}</p>
	{/if}

	<section class="stream" aria-label="Recent Wikimedia changes">
		<div class="stream-header">
			<h2>Recent changes</h2>
			<p>
				Last updated {new Date(
					snapshot.updated_at,
				).toLocaleTimeString()}
			</p>
		</div>

		<div class="changes">
			{#each snapshot.changes as change (change.id)}
				<a
					class="change"
					href={change.url}
					target="_blank"
					rel="external noreferrer noopener"
				>
					<div class="change-main">
						<div class="change-title-row">
							<span class="badge">{label(change.type)}</span>
							{#if change.minor}<span class="minor">minor</span>{/if}
							{#if change.bot}<span class="bot">bot</span>{/if}
						</div>
						<h3>{change.title}</h3>
						<p>{change.comment}</p>
					</div>

					<div class="change-meta">
						<strong>{signed.format(change.byte_delta)}</strong>
						<span>{change.user}</span>
						<small
							>{change.domain} · {relative_time(
								change.timestamp,
							)}</small
						>
					</div>
				</a>
			{:else}
				<div class="empty">
					<div class="pulse"></div>
					<p>Waiting for the first Wikimedia event...</p>
				</div>
			{/each}
		</div>
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background:
			radial-gradient(
				circle at top left,
				oklch(0.92 0.08 88),
				transparent 34rem
			),
			linear-gradient(
				135deg,
				oklch(0.98 0.018 83),
				oklch(0.91 0.035 62)
			);
		color: oklch(0.2 0.025 55);
		font-family:
			ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif;
	}

	main {
		width: min(1180px, calc(100% - 32px));
		margin: 0 auto;
		padding: clamp(28px, 6vw, 72px) 0;
	}

	.hero {
		border-bottom: 1px solid
			color-mix(in oklch, currentColor 16%, transparent);
		padding-bottom: clamp(28px, 5vw, 56px);
	}

	.eyebrow,
	.kicker,
	.connection-card span,
	.metrics p,
	.stream-header p,
	.change-meta,
	.badge,
	.minor,
	.bot {
		font-family:
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		border: 1px solid
			color-mix(in oklch, currentColor 18%, transparent);
		border-radius: 999px;
		background: color-mix(in oklch, white 54%, transparent);
		padding: 0.42rem 0.72rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.eyebrow span {
		width: 0.65rem;
		height: 0.65rem;
		border-radius: 999px;
		background: oklch(0.68 0.19 35);
	}

	.eyebrow span.online {
		background: oklch(0.68 0.16 145);
		box-shadow: 0 0 0 6px
			color-mix(in oklch, oklch(0.68 0.16 145) 18%, transparent);
	}

	.hero-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
		gap: clamp(28px, 6vw, 80px);
		align-items: end;
		margin-top: 32px;
	}

	.kicker {
		margin: 0 0 12px;
		color: oklch(0.48 0.12 42);
		font-size: 0.82rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	h1 {
		max-width: 780px;
		margin: 0;
		font-size: clamp(3.2rem, 10vw, 8.8rem);
		font-weight: 760;
		letter-spacing: -0.075em;
		line-height: 0.84;
	}

	.lede {
		max-width: 660px;
		margin: 28px 0 0;
		color: oklch(0.34 0.035 55);
		font-size: clamp(1.08rem, 2vw, 1.34rem);
		line-height: 1.55;
	}

	code {
		border-radius: 0.35rem;
		background: color-mix(
			in oklch,
			oklch(0.77 0.11 72) 22%,
			transparent
		);
		padding: 0.05rem 0.35rem;
		font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
		font-size: 0.9em;
	}

	.connection-card {
		border: 1px solid oklch(0.35 0.045 55);
		border-radius: 2px;
		background: oklch(0.22 0.025 55);
		box-shadow: 12px 12px 0 oklch(0.66 0.14 62);
		color: oklch(0.96 0.018 85);
		padding: 24px;
	}

	.connection-card p {
		margin: 0 0 12px;
		font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.connection-card strong {
		display: block;
		font-size: clamp(3rem, 8vw, 5.2rem);
		line-height: 0.9;
	}

	.connection-card span {
		display: block;
		margin-top: 8px;
		color: oklch(0.84 0.03 82);
	}

	button {
		width: 100%;
		margin-top: 24px;
		border: 0;
		border-radius: 999px;
		background: oklch(0.78 0.14 78);
		color: oklch(0.18 0.028 55);
		cursor: pointer;
		font: inherit;
		font-family: ui-sans-serif, system-ui, sans-serif;
		font-weight: 800;
		padding: 0.9rem 1rem;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.controls {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-top: 20px;
	}

	.controls button {
		margin-top: 0;
		background: color-mix(
			in oklch,
			oklch(0.96 0.018 85) 12%,
			transparent
		);
		color: oklch(0.96 0.018 85);
		outline: 1px solid
			color-mix(in oklch, currentColor 22%, transparent);
		padding: 0.72rem 0.5rem;
	}

	.controls button.active {
		background: oklch(0.78 0.14 78);
		color: oklch(0.18 0.028 55);
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		margin: clamp(24px, 5vw, 48px) 0;
		background: color-mix(in oklch, currentColor 14%, transparent);
	}

	.metrics div {
		background: color-mix(
			in oklch,
			oklch(0.97 0.018 83) 86%,
			transparent
		);
		padding: clamp(18px, 3vw, 28px);
	}

	.metrics span {
		display: block;
		font-size: clamp(2rem, 4vw, 3.5rem);
		font-weight: 760;
		line-height: 1;
	}

	.metrics p,
	.stream-header p {
		margin: 0.45rem 0 0;
		color: oklch(0.42 0.035 55);
		font-size: 0.86rem;
		font-weight: 750;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.notice {
		border-left: 4px solid oklch(0.64 0.15 58);
		margin: 0 0 24px;
		background: color-mix(
			in oklch,
			oklch(0.8 0.12 74) 18%,
			transparent
		);
		padding: 1rem;
	}

	.stream-header {
		display: flex;
		justify-content: space-between;
		gap: 24px;
		align-items: end;
		margin-bottom: 16px;
	}

	h2 {
		margin: 0;
		font-size: clamp(1.7rem, 4vw, 3.2rem);
		letter-spacing: -0.045em;
	}

	.changes {
		display: grid;
		gap: 10px;
	}

	.change {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 190px;
		gap: 24px;
		border: 1px solid
			color-mix(in oklch, currentColor 12%, transparent);
		background: color-mix(in oklch, white 48%, transparent);
		color: inherit;
		padding: 18px;
		text-decoration: none;
		transition:
			transform 160ms ease,
			background 160ms ease;
	}

	.change:hover {
		background: color-mix(in oklch, white 68%, transparent);
		transform: translateX(6px);
	}

	.change-title-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.65rem;
	}

	.badge,
	.minor,
	.bot {
		border-radius: 999px;
		font-size: 0.68rem;
		font-weight: 850;
		letter-spacing: 0.08em;
		padding: 0.25rem 0.45rem;
		text-transform: uppercase;
	}

	.badge {
		background: oklch(0.84 0.12 78);
	}

	.minor,
	.bot {
		background: oklch(0.88 0.035 56);
		color: oklch(0.38 0.035 55);
	}

	h3 {
		margin: 0;
		font-size: clamp(1.1rem, 2vw, 1.45rem);
		letter-spacing: -0.025em;
	}

	.change-main p {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		margin: 0.55rem 0 0;
		color: oklch(0.38 0.035 55);
		line-height: 1.45;
	}

	.change-meta {
		display: grid;
		justify-items: end;
		align-content: center;
		gap: 0.25rem;
		text-align: right;
	}

	.change-meta strong {
		font-size: 1.5rem;
	}

	.change-meta span,
	.change-meta small {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.change-meta small {
		color: oklch(0.45 0.03 55);
	}

	.empty {
		display: grid;
		place-items: center;
		min-height: 260px;
		border: 1px dashed
			color-mix(in oklch, currentColor 24%, transparent);
		background: color-mix(in oklch, white 32%, transparent);
	}

	.pulse {
		width: 48px;
		height: 48px;
		border-radius: 999px;
		background: oklch(0.68 0.16 145);
		animation: pulse 1.2s infinite ease-out;
	}

	@keyframes pulse {
		to {
			opacity: 0;
			transform: scale(2.4);
		}
	}

	@media (max-width: 760px) {
		.hero-grid,
		.change {
			grid-template-columns: 1fr;
		}

		.metrics {
			grid-template-columns: repeat(2, 1fr);
		}

		.stream-header {
			align-items: start;
			flex-direction: column;
		}

		.change-meta {
			justify-items: start;
			text-align: left;
		}
	}
</style>
