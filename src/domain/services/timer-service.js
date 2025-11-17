// src/domain/timer-service.js

import { CHECK_IN_REFRESH_INTERVAL_MS } from '../utils/constants.js';

/**
 * Manages application timers (check-in refresh, etc.)
 */
class TimerService {
    constructor(app) {
        this.app = app;
        this.checkInTimer = null;
    }

    /**
     * Start the check-in refresh timer
     */
    startCheckInTimer() {
        if (this.checkInTimer) {
            clearInterval(this.checkInTimer);
            this.checkInTimer = null;
        }

        this.app.refreshCheckIns();
        this.checkInTimer = setInterval(() => {
            this.app.refreshCheckIns();
        }, CHECK_IN_REFRESH_INTERVAL_MS);
        
        // Use unref() to prevent timer from keeping Node.js process alive (for testing)
        if (typeof this.checkInTimer.unref === 'function') {
            this.checkInTimer.unref();
        }
    }
    
    /**
     * Stop the check-in refresh timer
     */
    stopCheckInTimer() {
        if (this.checkInTimer) {
            clearInterval(this.checkInTimer);
            this.checkInTimer = null;
        }
    }
}

export default TimerService;

