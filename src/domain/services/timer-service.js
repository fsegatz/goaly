// src/domain/timer-service.js

import { REVIEW_REFRESH_INTERVAL_MS } from '../utils/constants.js';

/**
 * Manages application timers (review refresh, etc.)
 */
class TimerService {
    constructor(app) {
        this.app = app;
        this.reviewTimer = null;
    }

    /**
     * Start the review refresh timer
     */
    startReviewTimer() {
        if (this.reviewTimer) {
            clearInterval(this.reviewTimer);
            this.reviewTimer = null;
        }

        this.app.refreshReviews();
        this.reviewTimer = setInterval(() => {
            this.app.refreshReviews();
        }, REVIEW_REFRESH_INTERVAL_MS);
        
        // Use unref() to prevent timer from keeping Node.js process alive (for testing)
        if (typeof this.reviewTimer.unref === 'function') {
            this.reviewTimer.unref();
        }
    }
    
    /**
     * Stop the review refresh timer
     */
    stopReviewTimer() {
        if (this.reviewTimer) {
            clearInterval(this.reviewTimer);
            this.reviewTimer = null;
        }
    }
}

export default TimerService;

