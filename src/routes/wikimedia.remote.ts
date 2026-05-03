import { query } from '$app/server';

const event_stream =
	'https://stream.wikimedia.org/v2/stream/recentchange';
const stream_user_agent =
	'sveltekit-query-live/1.0 (https://github.com/spences10/sveltekit-query-live)';
const max_changes = 24;
const pace_interval_ms = {
	live: 350,
	slow: 1800,
} as const;

type raw_recent_change = {
	id?: number | string;
	type?: string;
	title?: string;
	comment?: string;
	timestamp?: number;
	user?: string;
	bot?: boolean;
	minor?: boolean;
	server_url?: string;
	wiki?: string;
	meta?: {
		domain?: string;
		uri?: string;
	};
	length?: {
		old?: number;
		new?: number;
	};
};

export type stream_pace = keyof typeof pace_interval_ms;

export type wiki_stream_options = {
	pace?: stream_pace;
};

export type wiki_change = {
	id: string;
	type: string;
	title: string;
	comment: string;
	user: string;
	wiki: string;
	domain: string;
	url: string;
	timestamp: number;
	bot: boolean;
	minor: boolean;
	byte_delta: number;
};

export type wiki_snapshot = {
	status: 'connecting' | 'live' | 'ended' | 'error';
	message: string;
	updated_at: number;
	changes: wiki_change[];
	stats: {
		total: number;
		humans: number;
		bots: number;
		edits: number;
		new_pages: number;
		log_events: number;
		net_bytes: number;
	};
};

export const stream_recent_changes = query.live(
	'unchecked',
	async function* (options: wiki_stream_options = {}) {
		const { pace, min_yield_interval } = normalize_options(options);
		const changes: wiki_change[] = [];
		const stats = {
			total: 0,
			humans: 0,
			bots: 0,
			edits: 0,
			new_pages: 0,
			log_events: 0,
			net_bytes: 0,
		};

		const snapshot = (
			status: wiki_snapshot['status'],
			message = '',
		): wiki_snapshot => ({
			status,
			message,
			updated_at: Date.now(),
			changes: [...changes],
			stats: { ...stats },
		});

		yield snapshot(
			'connecting',
			pace === 'slow'
				? 'Opening Wikimedia EventStreams in slow-mo...'
				: 'Opening Wikimedia EventStreams...',
		);

		let reader: ReadableStreamDefaultReader<string> | undefined;
		const controller = new AbortController();

		try {
			const response = await fetch(event_stream, {
				headers: {
					accept: 'text/event-stream',
					'api-user-agent': stream_user_agent,
					'user-agent': stream_user_agent,
				},
				signal: controller.signal,
			});

			if (!response.ok || !response.body) {
				yield snapshot(
					'error',
					`Wikimedia returned ${response.status}`,
				);
				return;
			}

			reader = response.body
				.pipeThrough(new TextDecoderStream())
				.getReader();
			let buffer = '';
			let last_yield = 0;

			while (true) {
				const { value, done } = await reader.read();
				if (done) break;

				buffer += value;
				const events = buffer.split(/\r?\n\r?\n/);
				buffer = events.pop() ?? '';

				for (const event of events) {
					const change = parse_event(event);
					if (!change) continue;

					stats.total += 1;
					stats.net_bytes += change.byte_delta;
					if (change.bot) stats.bots += 1;
					else stats.humans += 1;
					if (change.type === 'edit') stats.edits += 1;
					else if (change.type === 'new') stats.new_pages += 1;
					else if (change.type === 'log') stats.log_events += 1;

					changes.unshift(change);
					changes.splice(max_changes);

					const now = Date.now();
					if (now - last_yield > min_yield_interval) {
						last_yield = now;
						yield snapshot('live');
					}
				}
			}

			yield snapshot('ended', 'The Wikimedia stream ended.');
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError')
				return;
			yield snapshot(
				'error',
				error instanceof Error ? error.message : 'Stream failed',
			);
		} finally {
			controller.abort();
			await reader?.cancel().catch(() => undefined);
		}
	},
);

function normalize_options(options: wiki_stream_options) {
	const pace = options.pace === 'slow' ? 'slow' : 'live';
	return { pace, min_yield_interval: pace_interval_ms[pace] };
}

function parse_event(event: string): wiki_change | null {
	const data = event
		.split(/\r?\n/)
		.filter((line) => line.startsWith('data:'))
		.map((line) => line.slice(line.startsWith('data: ') ? 6 : 5))
		.join('\n');

	if (!data) return null;

	try {
		return to_change(JSON.parse(data) as raw_recent_change);
	} catch {
		return null;
	}
}

function to_change(raw: raw_recent_change): wiki_change {
	const title = raw.title ?? 'Untitled page';
	const domain = raw.meta?.domain ?? raw.wiki ?? 'wikipedia.org';
	const server_url = raw.server_url ?? `https://${domain}`;
	const timestamp =
		(raw.timestamp ?? Math.floor(Date.now() / 1000)) * 1000;
	const old_length = raw.length?.old ?? 0;
	const new_length = raw.length?.new ?? old_length;
	const wiki = raw.wiki ?? domain.replaceAll('.', '-');

	return {
		id: `${wiki}-${raw.id ?? raw.meta?.uri ?? title}-${timestamp}`,
		type: raw.type ?? 'change',
		title,
		comment: raw.comment ?? 'No edit summary provided',
		user: raw.user ?? 'anonymous',
		wiki,
		domain,
		url:
			raw.meta?.uri ??
			`${server_url}/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`,
		timestamp,
		bot: raw.bot ?? false,
		minor: raw.minor ?? false,
		byte_delta: new_length - old_length,
	};
}
