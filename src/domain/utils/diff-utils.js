// src/domain/utils/diff-utils.js

/**
 * @module DiffUtils
 * @description Utilities for computing line-by-line differences between text content.
 * Used for migration diffs and version comparisons.
 */

/**
 * Split a string into an array of lines, handling normalization.
 * @param {string} value - The input text
 * @returns {string[]} Array of lines
 */
export function splitLines(value) {
    if (typeof value !== 'string') {
        return [];
    }
    const normalized = value.replaceAll('\r\n', '\n');
    if (normalized === '') {
        return [];
    }
    return normalized.split('\n');
}

/**
 * Compute the line-by-line difference between two strings.
 * Uses a dynamic programming approach to find the Longest Common Subsequence (LCS).
 * @param {string} oldContent - Original text
 * @param {string} newContent - New text
 * @returns {Array<Object>} List of diff segments { type, oldLine, newLine }
 */
export function computeLineDiff(oldContent, newContent) {
    const oldLines = splitLines(oldContent);
    const newLines = splitLines(newContent);
    const rows = oldLines.length;
    const cols = newLines.length;

    const dp = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));

    for (let row = rows - 1; row >= 0; row -= 1) {
        for (let col = cols - 1; col >= 0; col -= 1) {
            if (oldLines[row] === newLines[col]) {
                dp[row][col] = dp[row + 1][col + 1] + 1;
            } else {
                dp[row][col] = Math.max(dp[row + 1][col], dp[row][col + 1]);
            }
        }
    }

    const result = [];
    let rowIndex = 0;
    let colIndex = 0;

    while (rowIndex < rows && colIndex < cols) {
        const oldLine = oldLines[rowIndex];
        const newLine = newLines[colIndex];

        if (oldLine === newLine) {
            result.push({
                type: 'unchanged',
                oldLine,
                newLine
            });
            rowIndex += 1;
            colIndex += 1;
        } else if (dp[rowIndex + 1][colIndex] >= dp[rowIndex][colIndex + 1]) {
            result.push({
                type: 'removed',
                oldLine,
                newLine: null
            });
            rowIndex += 1;
        } else {
            result.push({
                type: 'added',
                oldLine: null,
                newLine
            });
            colIndex += 1;
        }
    }

    while (rowIndex < rows) {
        result.push({
            type: 'removed',
            oldLine: oldLines[rowIndex],
            newLine: null
        });
        rowIndex += 1;
    }

    while (colIndex < cols) {
        result.push({
            type: 'added',
            oldLine: null,
            newLine: newLines[colIndex]
        });
        colIndex += 1;
    }

    return result;
}

