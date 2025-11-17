// tests/mocks/dom.js

const { JSDOM } = require('jsdom');

/**
 * Creates a basic JSDOM instance with minimal HTML
 */
function createBasicDOM() {
    return new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
}

/**
 * Creates a JSDOM instance with full UI elements for testing UI controllers
 */
function createFullDOM() {
    return new JSDOM(`<!DOCTYPE html><html><body>
        <div id="goalsList"></div>
        <div id="all-goalsView" class="view">
            <div class="all-goals-controls">
                <label for="allGoalsStatusFilter">
                    <span>Status</span>
                    <select id="allGoalsStatusFilter">
                        <option value="all">All statuses</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="completed">Completed</option>
                        <option value="abandoned">Abandoned</option>
                    </select>
                </label>
                <label for="allGoalsPriorityFilter">
                    <span>Minimum priority</span>
                    <input type="number" id="allGoalsPriorityFilter" value="0" />
                </label>
                <label for="allGoalsSort">
                    <span>Sorting</span>
                    <select id="allGoalsSort">
                        <option value="priority-desc">Priority (high → low)</option>
                        <option value="priority-asc">Priority (low → high)</option>
                        <option value="updated-desc">Last update (new → old)</option>
                        <option value="updated-asc">Last update (old → new)</option>
                    </select>
                </label>
            </div>
            <div class="table-wrapper desktop-only">
                <table id="allGoalsTable">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Motivation</th>
                            <th>Urgency</th>
                            <th>Deadline</th>
                            <th>Last updated</th>
                        </tr>
                    </thead>
                    <tbody id="allGoalsTableBody"></tbody>
                </table>
                <div id="allGoalsEmptyState" hidden>No goals match the current filters.</div>
            </div>
            <div id="allGoalsMobileContainer" class="mobile-goals-container mobile-only"></div>
        </div>
        <button id="addGoalBtn"></button>
        <button id="addGoalBtnDesktop"></button>
        <form id="goalForm"></form>
        <button id="cancelBtn"></button>
        <button id="deleteBtn"></button>
        <div id="goalModal" class="modal">
            <span class="close">&times;</span>
            <h2 id="modalTitle"></h2>
            <input type="hidden" id="goalId" />
            <input type="text" id="goalTitle" />
            <textarea id="goalDescription"></textarea>
            <input type="number" id="goalMotivation" />
            <input type="number" id="goalUrgency" />
            <input type="date" id="goalDeadline" />
            <div id="goalHistorySection" class="goal-history" hidden>
                <h3>History</h3>
                <div id="goalHistoryList" class="goal-history-list"></div>
            </div>
        </div>
        <div id="migrationPromptModal" class="modal">
            <div class="modal-content migration-modal">
                <span id="migrationPromptClose" class="close">&times;</span>
                <h2 id="migrationPromptTitle"></h2>
                <p id="migrationPromptMessage"></p>
                <div class="modal-actions">
                    <button id="migrationReviewBtn"></button>
                    <button id="migrationPromptCancelBtn"></button>
                </div>
            </div>
        </div>
        <div id="migrationDiffModal" class="modal">
            <div class="modal-content migration-diff-modal">
                <span id="migrationDiffClose" class="close">&times;</span>
                <h2 id="migrationDiffTitle"></h2>
                <p id="migrationDiffSubtitle"></p>
                <div class="migration-diff-columns">
                    <div class="diff-column">
                        <h3 id="migrationDiffOldLabel"></h3>
                        <div id="migrationDiffOld" class="diff-view"></div>
                    </div>
                    <div class="diff-column">
                        <h3 id="migrationDiffNewLabel"></h3>
                        <div id="migrationDiffNew" class="diff-view"></div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button id="migrationApplyBtn"></button>
                    <button id="migrationCancelBtn"></button>
                </div>
            </div>
        </div>
        <div id="completionModal" class="modal">
            <div class="modal-content completion-modal">
                <span id="completionCloseBtn" class="close">&times;</span>
                <h2>Complete goal</h2>
                <p>Did you achieve your goal?</p>
                <div class="completion-actions">
                    <button id="completionSuccessBtn" class="btn btn-primary">Goal completed</button>
                    <button id="completionFailureBtn" class="btn btn-danger">Not completed</button>
                    <button id="completionCancelBtn" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        </div>
        <button id="exportBtn"></button>
        <button id="importBtn"></button>
        <input type="file" id="importFile" />
        <button id="saveSettingsBtn"></button>
        <input type="number" id="maxActiveGoals" value="3" />
        <input type="text" id="reviewIntervals" value="30, 14, 7" />
        <select id="languageSelect"></select>
        <div id="checkInsPanel">
            <div id="checkInsFeedback" hidden></div>
            <div id="checkInsList"></div>
            <div id="checkInsEmptyState" hidden></div>
        </div>
        <nav class="desktop-menu">
            <button class="menu-btn active" data-view="dashboard"></button>
            <button class="menu-btn" data-view="all-goals"></button>
        </nav>
        <header>
            <button id="mobileMenuToggle" aria-expanded="false"></button>
            <div id="mobileMenuDropdown" aria-hidden="true">
                <button class="mobile-menu-btn active" data-view="dashboard"></button>
                <button class="mobile-menu-btn" data-view="all-goals"></button>
            </div>
        </header>
        <div id="dashboardView" class="view active"></div>
        <div id="checkInView" class="view"></div>
        <div id="settingsView" class="view"></div>
    </body></html>`, { url: 'http://localhost' });
}

/**
 * Sets up global DOM environment from a JSDOM instance
 */
function setupGlobalDOM(dom) {
    const document = dom.window.document;
    const window = dom.window;

    global.document = document;
    global.window = window;
    global.navigator = window.navigator || { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

    // Ensure navigator is available on window
    if (!window.navigator) {
        window.navigator = global.navigator;
    }

    return { document, window };
}

/**
 * Cleans up global DOM environment
 */
function cleanupGlobalDOM(dom) {
    if (dom) {
        dom.window.close();
    }
    delete global.document;
    delete global.window;
    delete global.navigator;
}

module.exports = {
    createBasicDOM,
    createFullDOM,
    setupGlobalDOM,
    cleanupGlobalDOM
};

