import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	stream_recent_changes,
	type wiki_snapshot,
} from './wikimedia.remote';

vi.mock('$app/server', () => ({
	query: {
		live: (_schema: unknown, generator: object) =>
			Object.assign(generator, { __: { type: 'query_live' } }),
	},
}));

afterEach(() => vi.restoreAllMocks());

async function collect(events: object[], count: number) {
	let now = 0;
	vi.spyOn(Date, 'now').mockImplementation(() => (now += 500));
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue(
			new Response(
				new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								events
									.map(
										(event) => `data: ${JSON.stringify(event)}\n\n`,
									)
									.join(''),
							),
						);
					},
				}),
			),
		),
	);
	const stream = (
		stream_recent_changes as unknown as () => AsyncGenerator<wiki_snapshot>
	)();
	try {
		await stream.next(); // connecting
		await stream.next(); // live, before any events
		let snapshot: wiki_snapshot | undefined;
		for (let i = 0; i < count; i++)
			snapshot = (await stream.next()).value;
		return snapshot!;
	} finally {
		await stream.return(undefined);
		vi.unstubAllGlobals();
	}
}

const change = {
	wiki: 'eswiki',
	type: 'log',
	title: 'Fernanda Tavares',
	timestamp: 1794684380,
	meta: { uri: 'https://es.wikipedia.org/wiki/Fernanda_Tavares' },
	length: { old: 10, new: 15 },
};

describe('recent change stream identity', () => {
	it('preserves distinct events on the same page in the same second and ignores replay', async () => {
		const first = {
			...change,
			meta: { ...change.meta, id: 'first' },
		};
		const second = {
			...change,
			meta: { ...change.meta, id: 'second' },
		};
		const third = {
			...change,
			meta: { ...change.meta, id: 'third' },
		};
		const snapshot = await collect([first, second, first, third], 3);
		expect(snapshot.changes.map(({ id }) => id)).toEqual([
			'event-third',
			'event-second',
			'event-first',
		]);
		expect(snapshot.stats.total).toBe(3);
		expect(snapshot.stats.net_bytes).toBe(15);
	});

	it('preserves repeated occurrences when no event identity is supplied', async () => {
		const snapshot = await collect([change, change], 2);
		expect(snapshot.changes).toHaveLength(2);
		expect(new Set(snapshot.changes.map(({ id }) => id)).size).toBe(
			2,
		);
		expect(snapshot.stats.total).toBe(2);
	});

	it('scopes fallback recentchange IDs by wiki and ignores their replay', async () => {
		const first = { ...change, id: 42 };
		const second = { ...first, wiki: 'enwiki' };
		const third = { ...change, id: 43 };
		const snapshot = await collect([first, second, first, third], 3);
		expect(snapshot.changes.map(({ id }) => id)).toEqual([
			'change-eswiki-43',
			'change-enwiki-42',
			'change-eswiki-42',
		]);
		expect(snapshot.stats.total).toBe(3);
	});
});
