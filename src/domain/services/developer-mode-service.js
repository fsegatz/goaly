// src/domain/developer-mode-service.js

class DeveloperModeService {
    isEnabled = false;


    enable() {
        this.isEnabled = true;
    }

    disable() {
        this.isEnabled = false;
    }

    toggle() {
        if (this.isEnabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.isEnabled;
    }

    isDeveloperMode() {
        return this.isEnabled;
    }
}

export default DeveloperModeService;

