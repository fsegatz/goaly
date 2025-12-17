// src/server/utils/http.js

/**
 * @module HttpUtils
 * @description Utility functions for handling HTTP requests and responses.
 * Includes cookie parsing, body reading, and response formatting.
 */

const http = require('node:http');

/**
 * Parse cookies from request headers
 * @param {http.IncomingMessage} request 
 * @returns {Object} Key-value map of cookies
 */
function parseCookies(request) {
    const list = {};
    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
        cookieHeader.split(';').forEach(function (cookie) {
            const parts = cookie.split('=');
            list[parts.shift().trim()] = decodeURI(parts.join('='));
        });
    }
    return list;
}

/**
 * Read JSON body from request
 * @param {http.IncomingMessage} request 
 * @returns {Promise<Object>} key-value map of body
 */
function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = [];
        request.on('error', (err) => {
            console.error(err);
            reject(err);
        }).on('data', (chunk) => {
            body.push(chunk);
        }).on('end', () => {
            try {
                const str = Buffer.concat(body).toString();
                if (str) {
                    resolve(JSON.parse(str));
                } else {
                    resolve({});
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}

/**
 * Send JSON response
 * @param {http.ServerResponse} res 
 * @param {number} status 
 * @param {Object} data 
 * @param {Object} headers 
 */
function sendResponse(res, status, data, headers = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(JSON.stringify(data));
}

module.exports = {
    parseCookies,
    readBody,
    sendResponse
};
