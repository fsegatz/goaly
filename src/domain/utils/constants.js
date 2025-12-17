// src/domain/constants.js

/**
 * @module Constants
 * @description Application-wide constants for timers, storage keys, and UI configuration.
 */

/**
 * Timer intervals
 * @constant {number} REVIEW_REFRESH_INTERVAL_MS - Interval for refreshing review status (1 minute)
 */
export const REVIEW_REFRESH_INTERVAL_MS = 60000;

/** @constant {number} GOAL_SAVE_INTERVAL_MS - Interval for auto-saving goals (1 minute) */
export const GOAL_SAVE_INTERVAL_MS = 60000;

/** @constant {number} GOOGLE_DRIVE_SYNC_DEBOUNCE_MS - Debounce time for Google Drive sync (5 seconds) */
export const GOOGLE_DRIVE_SYNC_DEBOUNCE_MS = 5000;

/**
 * Developer mode constants
 * @constant {number} DEVELOPER_MODE_PRESS_DURATION_MS - Long press duration to activate developer mode
 */
export const DEVELOPER_MODE_PRESS_DURATION_MS = 5000;

/** @constant {number} DEVELOPER_MODE_VISUAL_FEEDBACK_MS - Visual feedback animation duration */
export const DEVELOPER_MODE_VISUAL_FEEDBACK_MS = 200;

/**
 * LocalStorage keys
 * @constant {string} STORAGE_KEY_GOALS - Key for storing goals data
 */
export const STORAGE_KEY_GOALS = 'goaly_goals';

/** @constant {string} STORAGE_KEY_SETTINGS - Key for storing user settings */
export const STORAGE_KEY_SETTINGS = 'goaly_settings';

/** @constant {string} STORAGE_KEY_GDRIVE_TOKEN - Key for storing Google Drive OAuth token */
export const STORAGE_KEY_GDRIVE_TOKEN = 'goaly_gdrive_token';

/** @constant {string} STORAGE_KEY_GDRIVE_FILE_ID - Key for storing Google Drive file ID */
export const STORAGE_KEY_GDRIVE_FILE_ID = 'goaly_gdrive_file_id';

/** @constant {string} STORAGE_KEY_GDRIVE_FOLDER_ID - Key for storing Google Drive folder ID */
export const STORAGE_KEY_GDRIVE_FOLDER_ID = 'goaly_gdrive_folder_id';

/**
 * UI constants
 * @constant {number} MOBILE_BREAKPOINT_PX - Viewport width breakpoint for mobile layout
 */
export const MOBILE_BREAKPOINT_PX = 900;

/** @constant {number} MAX_RATING_VALUE - Maximum value for goal ratings */
export const MAX_RATING_VALUE = 5;

/** @constant {number} DEADLINE_BONUS_DAYS - Days before deadline to start adding priority bonus */
export const DEADLINE_BONUS_DAYS = 30;

/** @constant {number} URGENT_DEADLINE_DAYS - Days threshold for marking deadline as urgent */
export const URGENT_DEADLINE_DAYS = 7;
