// src/ui/views/help-view.js

/**
 * @module HelpView
 * @description View for displaying helper information, FAQs, and links to support.
 * Serves as a static information page with localization support.
 */

import { BaseView } from '../base-view.js';
import { getOptionalElement } from '../utils/dom-utils.js';

/**
 * Help page view controller.
 * @class
 * @extends BaseView
 */
export class HelpView extends BaseView {
    constructor(app) {
        super(app);
    }

    render() {
        // Help view is mostly static HTML, but we can ensure translations are applied
        const helpViewElement = getOptionalElement('helpView');
        if (helpViewElement) {
            this.languageService.applyTranslations(helpViewElement);
        }
    }

    setupEventListeners() {
        // No special event listeners needed for help view
        // The GitHub Issues link is handled via standard HTML anchor tag
    }
}

