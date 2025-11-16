// tests/sync-merge-service.test.js
const { mergePayloads } = require('../src/domain/sync-merge-service.js');
const { computeTwoWayMerge } = require('../src/domain/sync-merge-service.js');

describe('sync-merge-service', () => {
    const basePayload = {
        version: '1.0.0',
        exportDate: '2025-01-01T00:00:00.000Z',
        settings: { maxActiveGoals: 3, language: 'en', reviewIntervals: [7, 14, 30] },
        goals: [{
            id: 'g1',
            title: 'Base',
            description: '',
            motivation: 3,
            urgency: 2,
            status: 'active',
            createdAt: '2025-01-01T00:00:00.000Z',
            lastUpdated: '2025-01-01T01:00:00.000Z',
            history: [{ id: 'h1', event: 'CREATED', timestamp: '2025-01-01T00:00:00.000Z', changes: [] }]
        }]
    };

    test('picks other side when local equals base', () => {
        const local = { ...basePayload };
        const remote = {
            ...basePayload,
            exportDate: '2025-01-02T00:00:00.000Z',
            goals: [{
                ...basePayload.goals[0],
                title: 'Remote New',
                lastUpdated: '2025-01-01T02:00:00.000Z',
                history: [...basePayload.goals[0].history, { id: 'h2', event: 'UPDATED', timestamp: '2025-01-01T02:00:00.000Z', changes: [] }]
            }]
        };

        const merged = mergePayloads({ base: basePayload, local, remote });
        expect(merged.goals.find(g => g.id === 'g1').title).toBe('Remote New');
        expect(merged.goals.find(g => g.id === 'g1').history.length).toBe(2);
    });

    test('latest edit wins when both diverged from base', () => {
        const local = {
            ...basePayload,
            exportDate: '2025-01-02T00:00:00.000Z',
            goals: [{
                ...basePayload.goals[0],
                title: 'Local New',
                lastUpdated: '2025-01-01T03:00:00.000Z'
            }]
        };
        const remote = {
            ...basePayload,
            exportDate: '2025-01-02T00:00:00.000Z',
            goals: [{
                ...basePayload.goals[0],
                title: 'Remote Older',
                lastUpdated: '2025-01-01T02:30:00.000Z'
            }]
        };

        const merged = mergePayloads({ base: basePayload, local, remote });
        expect(merged.goals.find(g => g.id === 'g1').title).toBe('Local New');
    });

    test('keeps goals present on only one side', () => {
        const local = {
            ...basePayload,
            goals: [ ...basePayload.goals, { id: 'g2', title: 'Only Local', lastUpdated: '2025-01-01T02:00:00.000Z' } ]
        };
        const remote = { ...basePayload }; // no g2

        const merged = mergePayloads({ base: basePayload, local, remote });
        expect(merged.goals.some(g => g.id === 'g2')).toBe(true);
    });

    test('settings chosen from newer exportDate', () => {
        const local = { ...basePayload, exportDate: '2025-01-02T00:00:00.000Z', settings: { language: 'en' } };
        const remote = { ...basePayload, exportDate: '2025-01-03T00:00:00.000Z', settings: { language: 'sv' } };
        const merged = mergePayloads({ base: basePayload, local, remote });
        expect(merged.settings.language).toBe('sv');
    });

    test('tie-breaker by createdAt when lastUpdated equal', () => {
        const local = {
            ...basePayload,
            goals: [{
                ...basePayload.goals[0],
                title: 'Local Same Updated',
                lastUpdated: '2025-01-01T02:00:00.000Z',
                createdAt: '2025-01-01T03:00:00.000Z'
            }]
        };
        const remote = {
            ...basePayload,
            goals: [{
                ...basePayload.goals[0],
                title: 'Remote Same Updated',
                lastUpdated: '2025-01-01T02:00:00.000Z',
                createdAt: '2025-01-01T01:00:00.000Z'
            }]
        };
        const merged = mergePayloads({ base: basePayload, local, remote });
        expect(merged.goals.find(g => g.id === 'g1').title).toBe('Local Same Updated');
    });

    test('merges histories with de-duplication and ordering', () => {
        const local = {
            ...basePayload,
            goals: [{
                ...basePayload.goals[0],
                history: [
                    { id: 'h1', event: 'CREATED', timestamp: '2025-01-01T00:00:00.000Z', changes: [] },
                    { id: 'h2', event: 'UPDATED', timestamp: '2025-01-01T02:00:00.000Z', changes: [] }
                ]
            }]
        };
        const remote = {
            ...basePayload,
            goals: [{
                ...basePayload.goals[0],
                history: [
                    { id: 'h2', event: 'UPDATED', timestamp: '2025-01-01T02:00:00.000Z', changes: [] },
                    { id: 'h3', event: 'UPDATED', timestamp: '2025-01-01T03:00:00.000Z', changes: [] }
                ]
            }]
        };
        const merged = mergePayloads({ base: basePayload, local, remote });
        const hist = merged.goals.find(g => g.id === 'g1').history;
        expect(hist.map(h => h.id)).toEqual(['h1', 'h2', 'h3']);
    });

    test('settings fall back to local when local exportDate newer', () => {
        const local = { ...basePayload, exportDate: '2025-01-05T00:00:00.000Z', settings: { language: 'de' } };
        const remote = { ...basePayload, exportDate: '2025-01-03T00:00:00.000Z', settings: { language: 'sv' } };
        const merged = mergePayloads({ base: basePayload, local, remote });
        expect(merged.settings.language).toBe('de');
    });

    test('two-way merge returns local when remote missing', () => {
        const local = {
            version: '1.0.0',
            exportDate: '2025-01-01T00:00:00.000Z',
            settings: { language: 'en' },
            goals: [{ id: 'x', title: 'Only Local', lastUpdated: '2025-01-01T00:00:00.000Z' }]
        };
        const merged = computeTwoWayMerge(local, null);
        expect(merged.goals.some(g => g.id === 'x')).toBe(true);
    });

    test('merge handles missing exportDate gracefully when choosing settings', () => {
        const local = { ...basePayload, exportDate: undefined, settings: { language: 'en' } };
        const remote = { ...basePayload, exportDate: undefined, settings: { language: 'sv' } };
        const merged = mergePayloads({ base: null, local, remote });
        // When equal/undefined, implementation prefers local branch
        expect(['en','sv']).toContain(merged.settings.language);
    });

    test('merging with no goals on either side yields empty goals', () => {
        const local = { version: '1.0.0', exportDate: '2025-01-01T00:00:00.000Z', settings: {}, goals: [] };
        const remote = { version: '1.0.0', exportDate: '2025-01-01T00:00:00.000Z', settings: {}, goals: [] };
        const merged = mergePayloads({ base: null, local, remote });
        expect(Array.isArray(merged.goals)).toBe(true);
        expect(merged.goals.length).toBe(0);
    });

    test('when remote equals base, prefer local', () => {
        const base = {
            version: '1.0.0',
            exportDate: '2025-01-01T00:00:00.000Z',
            settings: {},
            goals: [{ id: 'g', title: 'Base', lastUpdated: '2025-01-01T00:00:00.000Z' }]
        };
        const remote = JSON.parse(JSON.stringify(base));
        const local = {
            ...base,
            goals: [{ id: 'g', title: 'Local Change', lastUpdated: '2025-01-02T00:00:00.000Z' }]
        };
        const merged = mergePayloads({ base, local, remote });
        expect(merged.goals.find(g => g.id === 'g').title).toBe('Local Change');
    });

    test('history is capped to last 100 entries and ordered by timestamp', () => {
        const many = [];
        for (let i = 0; i < 120; i += 1) {
            // strictly increasing timestamps per minute
            const hour = Math.floor(i / 60);
            const minute = i % 60;
            many.push({ id: `h${i}`, event: 'UPDATED', timestamp: `2025-01-01T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00.000Z`, changes: [] });
        }
        const base = {
            version: '1.0.0',
            exportDate: '2025-01-01T00:00:00.000Z',
            settings: {},
            goals: [{ id: 'g', title: 'Base', lastUpdated: '2025-01-01T00:00:00.000Z', history: many.slice(0, 60) }]
        };
        const local = {
            ...base,
            goals: [{ id: 'g', title: 'Local', lastUpdated: '2025-01-01T01:00:00.000Z', history: many.slice(60) }]
        };
        const remote = { ...base };
        const merged = mergePayloads({ base, local, remote });
        const hist = merged.goals.find(g => g.id === 'g').history;
        expect(hist.length).toBe(100);
        // Ensure the last entry has the highest index timestamp present
        expect(hist[hist.length - 1].id).toBe('h119');
    });

    test('ignores history entries without id and keeps valid ones', () => {
        const base = {
            version: '1.0.0',
            exportDate: '2025-01-01T00:00:00.000Z',
            settings: {},
            goals: [{ id: 'g', title: 'Base', lastUpdated: '2025-01-01T00:00:00.000Z', history: [{ id: 'ok', timestamp: '2025-01-01T00:00:00.000Z' }, { timestamp: '2025-01-01T00:01:00.000Z' }] }]
        };
        const local = { ...base };
        const remote = { ...base };
        const merged = mergePayloads({ base, local, remote });
        const hist = merged.goals.find(g => g.id === 'g').history;
        expect(hist.map(h => h.id)).toEqual(['ok']);
    });

    test('settings selection tolerates invalid date strings', () => {
        const local = { ...basePayload, exportDate: 'not-a-date', settings: { language: 'en' } };
        const remote = { ...basePayload, exportDate: '2025-01-10T00:00:00.000Z', settings: { language: 'de' } };
        const merged = mergePayloads({ base: null, local, remote });
        expect(merged.settings.language).toBe('de');
    });
});


