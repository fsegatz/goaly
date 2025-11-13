const { computeLineDiff } = require('../src/domain/diff-utils');

describe('computeLineDiff', () => {
    it('detects added and removed lines', () => {
        const before = '{\n  "name": "alpha"\n}\n';
        const after = '{\n  "name": "beta",\n  "active": true\n}\n';

        const diff = computeLineDiff(before, after);

        const types = diff.map(entry => entry.type);
        expect(types).toContain('removed');
        expect(types.filter(type => type === 'added').length).toBeGreaterThan(0);
        expect(types.filter(type => type === 'unchanged').length).toBeGreaterThan(0);
    });

    it('handles empty inputs gracefully', () => {
        const diff = computeLineDiff('', '');
        expect(diff).toEqual([]);
    });
});

