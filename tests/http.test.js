const http = require('http');
const { parseCookies, readBody, sendResponse } = require('../src/server/utils/http');

describe('HTTP Utils', () => {
    describe('parseCookies', () => {
        test('should parse cookie string', () => {
            const req = { headers: { cookie: 'foo=bar; baz=qux' } };
            const cookies = parseCookies(req);
            expect(cookies).toEqual({ foo: 'bar', baz: 'qux' });
        });

        test('should handle empty cookies', () => {
            const req = { headers: {} };
            const cookies = parseCookies(req);
            expect(cookies).toEqual({});
        });
    });

    describe('readBody', () => {
        // Mocking http incoming message is tedious, but we can mock an EventEmitter-like object
        // Or just use real server for robust testing, but unit test is preferred for utils.
        const { EventEmitter } = require('events');

        test('should parse JSON body', async () => {
            const req = new EventEmitter();
            const promise = readBody(req);

            req.emit('data', Buffer.from(JSON.stringify({ hello: 'world' })));
            req.emit('end');

            const body = await promise;
            expect(body).toEqual({ hello: 'world' });
        });

        test('should handle empty body', async () => {
            const req = new EventEmitter();
            const promise = readBody(req);
            req.emit('end');
            const body = await promise;
            expect(body).toEqual({});
        });

        test('should reject on invalid JSON', async () => {
            const req = new EventEmitter();
            const promise = readBody(req);
            req.emit('data', Buffer.from('{ invalid json '));
            req.emit('end');
            await expect(promise).rejects.toThrow();
        });
    });

    // sendResponse interacts with response object, easy to mock
    describe('sendResponse', () => {
        test('should write status, headers and body', () => {
            const res = {
                writeHead: jest.fn(),
                end: jest.fn()
            };
            const data = { success: true };

            sendResponse(res, 200, data, { 'X-Custom': 'Header' });

            expect(res.writeHead).toHaveBeenCalledWith(200, {
                'Content-Type': 'application/json',
                'X-Custom': 'Header'
            });
            expect(res.end).toHaveBeenCalledWith(JSON.stringify(data));
        });
    });
});
