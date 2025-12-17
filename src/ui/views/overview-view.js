// src/ui/views/overview-view.js

import { BaseView } from '../base-view.js';
import { getElement } from '../utils/dom-utils.js';

/**
 * Overview view for displaying goal analytics and statistics.
 */
export class OverviewView extends BaseView {
    constructor(app) {
        super(app);
        this.currentPeriod = 'month';
    }

    /**
     * Render the overview view with charts and statistics.
     */
    render() {
        const container = getElement('overviewContainer');
        const analyticsService = this.app.analyticsService;

        if (!analyticsService) {
            container.innerHTML = `<p class="overview-error">${this.translate('overview.empty')}</p>`;
            return;
        }

        const goals = this.app.goalService.goals;

        if (goals.length === 0) {
            container.innerHTML = `
                <div class="overview-empty-state">
                    <p>${this.translate('overview.empty')}</p>
                </div>
            `;
            return;
        }

        const summaryStats = analyticsService.getSummaryStats(this.currentPeriod);
        const statusDistribution = analyticsService.getStatusDistribution();
        const goalsByPeriod = analyticsService.getGoalsByPeriod(this.currentPeriod);

        container.innerHTML = `
            <div class="overview-header">
                <div class="period-selector">
                    <button class="period-btn ${this.currentPeriod === 'week' ? 'active' : ''}" data-period="week">
                        ${this.translate('overview.periodSelector.week')}
                    </button>
                    <button class="period-btn ${this.currentPeriod === 'month' ? 'active' : ''}" data-period="month">
                        ${this.translate('overview.periodSelector.month')}
                    </button>
                    <button class="period-btn ${this.currentPeriod === 'year' ? 'active' : ''}" data-period="year">
                        ${this.translate('overview.periodSelector.year')}
                    </button>
                </div>
            </div>
            
            <div class="overview-stats">
                ${this.renderStatCards(summaryStats)}
            </div>
            
            <div class="overview-charts">
                <div class="chart-section">
                    <h3>${this.translate('overview.charts.goalsOverTime')}</h3>
                    ${this.renderBarChart(goalsByPeriod, analyticsService)}
                </div>
                <div class="chart-section">
                    <h3>${this.translate('overview.charts.statusDistribution')}</h3>
                    ${this.renderPieChart(statusDistribution)}
                </div>
            </div>
        `;

        this.setupEventListeners(container);
    }

    /**
     * Render summary statistic cards.
     */
    renderStatCards(stats) {
        const periodLabel = this.translate(`overview.periodSelector.${stats.period}`).toLowerCase();

        return `
            <div class="stat-card">
                <div class="stat-value">${stats.totalGoals}</div>
                <div class="stat-label">${this.translate('overview.stats.totalGoals')}</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.completed}</div>
                <div class="stat-label">${this.translate('overview.stats.completedGoals')}</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.completionRate}%</div>
                <div class="stat-label">${this.translate('overview.stats.completionRate')}</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.avgPerPeriod}</div>
                <div class="stat-label">${this.translate('overview.stats.avgPerPeriod', { period: periodLabel })}</div>
            </div>
        `;
    }

    /**
     * Render SVG bar chart for goals over time.
     */
    renderBarChart(goalsByPeriod, analyticsService) {
        const periods = Object.keys(goalsByPeriod);
        if (periods.length === 0) {
            return '<p class="chart-empty">No data available</p>';
        }

        // Limit to last 12 periods for readability
        const displayPeriods = periods.slice(-12);
        const chartWidth = 100;
        const chartHeight = 60;
        const barWidth = Math.min(8, (chartWidth - 10) / displayPeriods.length);
        const gap = 2;

        // Find max value for scaling
        let maxValue = 0;
        displayPeriods.forEach(key => {
            const data = goalsByPeriod[key];
            maxValue = Math.max(maxValue, data.created.length, data.completed.length);
        });
        maxValue = maxValue || 1;

        const bars = displayPeriods.map((key, index) => {
            const data = goalsByPeriod[key];
            const createdHeight = (data.created.length / maxValue) * (chartHeight - 15);
            const completedHeight = (data.completed.length / maxValue) * (chartHeight - 15);
            const x = 5 + index * (barWidth * 2 + gap);
            const label = this.formatPeriodLabel(key, this.currentPeriod);

            return `
                <g class="bar-group">
                    <rect class="bar bar-created" x="${x}" y="${chartHeight - 10 - createdHeight}" 
                          width="${barWidth}" height="${createdHeight}" rx="1">
                        <title>${this.translate('overview.charts.created')}: ${data.created.length}</title>
                    </rect>
                    <rect class="bar bar-completed" x="${x + barWidth}" y="${chartHeight - 10 - completedHeight}" 
                          width="${barWidth}" height="${completedHeight}" rx="1">
                        <title>${this.translate('overview.charts.completed')}: ${data.completed.length}</title>
                    </rect>
                    <text class="bar-label" x="${x + barWidth}" y="${chartHeight - 2}" text-anchor="middle">${label}</text>
                </g>
            `;
        }).join('');

        const viewBoxWidth = 5 + displayPeriods.length * (barWidth * 2 + gap) + 5;

        return `
            <div class="bar-chart-container">
                <svg class="bar-chart" viewBox="0 0 ${viewBoxWidth} ${chartHeight}" preserveAspectRatio="xMidYMid meet">
                    ${bars}
                </svg>
                <div class="chart-legend">
                    <span class="legend-item"><span class="legend-color created"></span>${this.translate('overview.charts.created')}</span>
                    <span class="legend-item"><span class="legend-color completed"></span>${this.translate('overview.charts.completed')}</span>
                </div>
            </div>
        `;
    }

    /**
     * Render CSS pie chart for status distribution.
     */
    renderPieChart(distribution) {
        const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
        if (total === 0) {
            return '<p class="chart-empty">No data available</p>';
        }

        const colors = {
            active: '#667eea',
            inactive: '#ffa500',
            paused: '#9e9e9e',
            completed: '#4caf50',
            notCompleted: '#e74c3c'
        };

        const statusLabels = {
            active: this.translate('status.active'),
            inactive: this.translate('status.inactive'),
            paused: this.translate('status.paused'),
            completed: this.translate('status.completed'),
            notCompleted: this.translate('status.notCompleted')
        };

        // Build conic gradient
        let gradientParts = [];
        let currentAngle = 0;

        Object.entries(distribution).forEach(([status, count]) => {
            if (count > 0) {
                const percentage = (count / total) * 100;
                const nextAngle = currentAngle + percentage;
                gradientParts.push(`${colors[status]} ${currentAngle}% ${nextAngle}%`);
                currentAngle = nextAngle;
            }
        });

        const gradient = gradientParts.length > 0
            ? `conic-gradient(${gradientParts.join(', ')})`
            : '#e0e0e0';

        const legendItems = Object.entries(distribution)
            .filter(([_, count]) => count > 0)
            .map(([status, count]) => `
                <div class="pie-legend-item">
                    <span class="pie-legend-color" style="background: ${colors[status]}"></span>
                    <span class="pie-legend-label">${statusLabels[status]}</span>
                    <span class="pie-legend-value">${count} (${Math.round((count / total) * 100)}%)</span>
                </div>
            `).join('');

        return `
            <div class="pie-chart-container">
                <div class="pie-chart" style="background: ${gradient}"></div>
                <div class="pie-legend">
                    ${legendItems}
                </div>
            </div>
        `;
    }

    /**
     * Set up event listeners for the view.
     */
    setupEventListeners(container) {
        const periodButtons = container.querySelectorAll('.period-btn');
        periodButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentPeriod = e.target.dataset.period;
                this.render();
            });
        });
    }

    /**
     * Format a period key for display.
     * @param {string} key - Period key
     * @param {string} period - 'week', 'month', or 'year'
     * @returns {string} Formatted period label
     */
    formatPeriodLabel(key, period) {
        switch (period) {
            case 'week': {
                const parts = key.split('-W');
                return `W${parts[1]}`;
            }
            case 'month': {
                const [year, month] = key.split('-').map(Number);
                const date = new Date(year, month - 1, 1);
                // Use language service if available for localization
                const locale = this.app?.languageService?.currentLanguage || 'en-US';
                return date.toLocaleDateString(locale, { month: 'short' });
            }
            case 'year': {
                return key;
            }
            default:
                return key;
        }
    }
}

export default OverviewView;
