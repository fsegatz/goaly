// src/ui/base-modal.js

import { BaseView } from './base-view.js';

/**
 * @module BaseModal
 * @description Base class for all modal components.
 * Extends components with common modal behavior.
 */

/**
 * Base class for modal components.
 * Extends BaseView with modal-specific functionality.
 */
export class BaseModal extends BaseView {
    constructor(app) {
        super(app);
    }
}
