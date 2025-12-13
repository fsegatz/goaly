// src/domain/constants.js

// Timer intervals
export const REVIEW_REFRESH_INTERVAL_MS = 60000; // 1 minute
export const GOAL_SAVE_INTERVAL_MS = 60000; // 1 minute
export const GOOGLE_DRIVE_SYNC_DEBOUNCE_MS = 5000; // 5 seconds

// Developer mode
export const DEVELOPER_MODE_PRESS_DURATION_MS = 5000; // 5 seconds
export const DEVELOPER_MODE_VISUAL_FEEDBACK_MS = 200; // 200ms

// LocalStorage keys
export const STORAGE_KEY_GOALS = 'goaly_goals';
export const STORAGE_KEY_SETTINGS = 'goaly_settings';
export const STORAGE_KEY_GDRIVE_TOKEN = 'goaly_gdrive_token';
export const STORAGE_KEY_GDRIVE_FILE_ID = 'goaly_gdrive_file_id';
export const STORAGE_KEY_GDRIVE_FOLDER_ID = 'goaly_gdrive_folder_id';

// UI constants
export const MOBILE_BREAKPOINT_PX = 900;
export const MAX_RATING_VALUE = 5;
export const DEADLINE_BONUS_DAYS = 30;
export const URGENT_DEADLINE_DAYS = 7;

