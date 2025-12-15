// src/domain/utils/device-utils.js

import { MOBILE_BREAKPOINT_PX } from './constants.js';

/**
 * Check if the current device is a mobile device
 * Uses both viewport width and user agent detection
 * Note: iPad is excluded from mobile detection to allow isTabletDevice to handle it
 * @returns {boolean} - True if the device is mobile
 */
export function isMobileDevice() {
    const isMobileWidth = window.innerWidth <= MOBILE_BREAKPOINT_PX;
    const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isMobileWidth || isMobileUA;
}

