// src/domain/check-in-service.js

class CheckInService {
    constructor(goals, settings) {
        this.goals = goals;
        this.settings = settings;
    }

    shouldCheckIn(goal) {
        if (goal.status !== 'active') return false;

        const now = new Date();
        const created = new Date(goal.createdAt);
        
        const intervals = [3, 7, 14, 30];
        const lastCheckIn = goal.checkInDates && goal.checkInDates.length > 0
            ? new Date(Math.max(...goal.checkInDates.map(d => new Date(d))))
            : created;

        const checkInMinutes = this.settings.checkInInterval;
        const minutesSinceLastCheckIn = Math.ceil((now - lastCheckIn) / (1000 * 60));

        for (const interval of intervals) {
            const intervalMinutes = interval * checkInMinutes;
            if (minutesSinceLastCheckIn >= intervalMinutes && 
                !goal.checkInDates.some(d => {
                    const checkInDate = new Date(d);
                    const minutesSinceCheckIn = Math.ceil((now - checkInDate) / (1000 * 60));
                    return minutesSinceCheckIn < intervalMinutes && minutesSinceCheckIn >= intervalMinutes - checkInMinutes;
                })) {
                return true;
            }
        }

        return false;
    }

    getCheckIns() {
        return this.goals
            .filter(g => this.shouldCheckIn(g))
            .map(goal => ({
                goal,
                message: `Zeit für ein Check-in: "${goal.title}". Bitte überprüfe Motivation und Dringlichkeit.`
            }));
    }

    performCheckIn(goalId) {
        const goal = this.goals.find(g => g.id === goalId);
        if (goal) {
            if (!goal.checkInDates) goal.checkInDates = [];
            goal.checkInDates.push(new Date().toISOString());
            goal.lastUpdated = new Date();
            return goal;
        }
        return null;
    }
}

module.exports = CheckInService;
