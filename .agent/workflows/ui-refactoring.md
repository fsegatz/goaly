---
description: how to refactor UI components to reduce code duplication
---

# UI Component Refactoring Workflow

## 1. Identify Duplication

1. Compare similar component files (e.g., desktop vs mobile views)
2. Look for:
   - Repeated state management logic
   - Duplicated filter/sort implementations
   - Similar event handlers
   - Shared utility methods

```bash
# Use grep to find similar patterns
npx grep -r "statusFilter" src/ui/
```

## 2. Plan the Refactoring

1. Create an implementation plan with:
   - List of duplicated methods/logic
   - Proposed base class structure
   - Files to modify
   - Verification approach

2. Identify which logic is truly shared vs platform-specific:
   - **Shared**: State, filtering, sorting, data processing
   - **Platform-specific**: DOM structure, rendering, layout

## 3. Create Base Class

1. Create new file in `src/ui/shared/` (e.g., `base-component-view.js`)
2. Extract shared logic:
   - State object initialization
   - Filter/sort methods
   - Event handler logic
   - Helper methods

3. Define abstract methods for platform-specific rendering:
   - `getContainerElement()`
   - `renderItem()`
   - `showEmptyState()`

## 4. Refactor Child Classes

1. Extend the base class instead of duplicating
2. Remove duplicated methods
3. Keep only platform-specific code:
   - DOM element creation
   - Platform-specific styling
   - Touch/mouse event differences

// turbo
4. Run tests to verify no regressions:
```bash
npm test -- <component-name> --silent
```

## 5. Refactor Tests

1. Create shared test utilities in `tests/shared/`
2. Extract common:
   - Mock factories (`createMockGoalService`, `createMockApp`)
   - Test HTML structures
   - Reusable test suites

3. Use parameterized test runner pattern:
```javascript
function runSharedTests({ createView, getRenderedItems }) {
    // Shared test cases here
}
```

// turbo
4. Run full test suite:
```bash
npm test -- --silent
```

## 6. Verify Coverage

// turbo
1. Check coverage meets threshold:
```bash
npm test -- --silent
```

2. If coverage dropped, add tests for:
   - Uncovered branches (check Jest output)
   - Edge cases in new base class
   - Platform-specific rendering paths

## 7. Finalize

1. Update walkthrough document with:
   - Files changed
   - Line count reductions
   - Test results

2. Commit changes:
```bash
git add .
git commit -m "refactor: extract shared UI logic into base class"
```

## Key Patterns

### Base Class Structure
```javascript
export class BaseComponentView extends BaseUIController {
    constructor(app) {
        super(app);
        this.state = { /* shared state */ };
    }
    
    // Shared logic
    getFilteredData() { /* ... */ }
    
    // Abstract - implement in subclasses
    getContainerElement() { throw new Error('Not implemented'); }
}
```

### Shared Test Utilities
```javascript
// tests/shared/component-test-utils.js
function createMockService() { /* ... */ }
function runSharedTests(config) { /* ... */ }
module.exports = { createMockService, runSharedTests };
```
