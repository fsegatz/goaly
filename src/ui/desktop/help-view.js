// src/ui/desktop/help-view.js

import { BaseUIController } from './base-ui-controller.js';

export class HelpView extends BaseUIController {
    constructor(app) {
        super(app);
    }

    render() {
        // Help view is mostly static HTML, but we can ensure translations are applied
        this.languageService.applyTranslations(document);
    }

    setupEventListeners() {
        // No special event listeners needed for help view
        // The GitHub Issues link is handled via standard HTML anchor tag
    }
}

