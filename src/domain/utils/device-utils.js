// src/domain/utils/device-utils.js

import { MOBILE_BREAKPOINT_PX } from './constants.js';

// Viewport breakpoints
const TABLET_BREAKPOINT_PX = 1024;

/**
 * Check if the current device is a mobile device
 * Uses both viewport width and user agent detection
 * @returns {boolean} - True if the device is mobile
 */
export function isMobileDevice() {
    const isMobileWidth = window.innerWidth <= MOBILE_BREAKPOINT_PX;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isMobileWidth || isMobileUA;
}

/**
 * Check if the current device is a tablet device
 * @returns {boolean} - True if the device is a tablet
 */
export function isTabletDevice() {
    const width = window.innerWidth;
    const isTabletWidth = width > MOBILE_BREAKPOINT_PX && width <= TABLET_BREAKPOINT_PX;
    const isTabletUA = /iPad|Android/i.test(navigator.userAgent) && !/Mobile/i.test(navigator.userAgent);
    return isTabletWidth || isTabletUA;
}

/**
 * Get the current viewport breakpoint category
 * @returns {string} - 'mobile', 'tablet', or 'desktop'
 */
export function getViewportBreakpoint() {
    const width = window.innerWidth;
    if (width <= MOBILE_BREAKPOINT_PX) {
        return 'mobile';
    }
    if (width <= TABLET_BREAKPOINT_PX) {
        return 'tablet';
    }
    return 'desktop';
}

