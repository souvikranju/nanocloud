// updateChecker.js
// Frontend update checker for NanoCloud
// Handles checking for updates and triggering the update process

/**
 * Update checker module
 */
export class UpdateChecker {
    constructor() {
        this.currentVersion = null;
        this.latestVersion = null;
        this.updateAvailable = false;
        this.checking = false;
        this.updating = false;
        this.updateInfo = null;
    }

    /**
     * Initialize update checker
     */
    async init() {
        try {
            // Load current version
            const response = await fetch('nanocloud_update_api.php?action=get_version');
            const data = await response.json();
            
            if (data.success) {
                this.currentVersion = data.version.version;
            }
        } catch (error) {
            console.error('Failed to load version:', error);
        }
    }

    /**
     * Check for updates from GitHub
     */
    async checkForUpdates() {
        if (this.checking) {
            return { success: false, message: 'Already checking for updates' };
        }

        this.checking = true;

        try {
            const response = await fetch('nanocloud_update_api.php?action=check_version');
            const data = await response.json();

            this.checking = false;

            if (data.success) {
                this.currentVersion = data.current_version;
                this.latestVersion = data.latest_version;
                this.updateAvailable = data.update_available;
                this.updateInfo = data;
                return data;
            } else {
                return {
                    success: false,
                    message: data.message || 'Failed to check for updates'
                };
            }
        } catch (error) {
            this.checking = false;
            return {
                success: false,
                message: 'Network error: ' + error.message
            };
        }
    }

    /**
     * Start the update process
     */
    async startUpdate() {
        if (this.updating) {
            return { success: false, message: 'Update already in progress' };
        }

        this.updating = true;

        try {
            const response = await fetch('nanocloud_update_api.php?action=start_update', {
                method: 'POST'
            });

            const data = await response.json();
            this.updating = false;

            return data;
        } catch (error) {
            this.updating = false;
            return {
                success: false,
                message: 'Update failed: ' + error.message
            };
        }
    }

    /**
     * Rollback to previous version
     */
    async rollback() {
        try {
            const response = await fetch('nanocloud_update_api.php?action=rollback', {
                method: 'POST'
            });

            const data = await response.json();
            return data;
        } catch (error) {
            return {
                success: false,
                message: 'Rollback failed: ' + error.message
            };
        }
    }

    /**
     * Render update UI in the info modal
     */
    renderUpdateUI(container) {
        // Create update section HTML
        const updateSection = document.createElement('div');
        updateSection.innerHTML = `
            <h3 class="info-section-title">🔄 Updates</h3>
            <div class="update-info">
                <div class="update-version">
                    <span class="update-label">Current Version:</span>
                    <span class="update-value" id="currentVersion">${this.currentVersion || 'Loading...'}</span>
                </div>
                <div class="update-status" id="updateStatus">
                    <div class="update-checking">
                        <div class="loading-spinner"></div>
                        <span>Checking for updates...</span>
                    </div>
                </div>
                <div class="update-actions" id="updateActions"></div>
            </div>
        `;

        container.appendChild(updateSection);

        // Automatically check for updates
        this.handleCheckUpdate();
    }

    /**
     * Attach event listeners to update UI elements
     */
    attachEventListeners() {
        const checkBtn = document.getElementById('checkUpdateBtn');
        if (checkBtn) {
            checkBtn.addEventListener('click', () => this.handleCheckUpdate());
        }
    }

    /**
     * Handle check for updates button click
     */
    async handleCheckUpdate() {
        const statusEl = document.getElementById('updateStatus');
        const actionsEl = document.getElementById('updateActions');

        // Show checking state
        statusEl.innerHTML = `
            <div class="update-checking">
                <div class="loading-spinner"></div>
                <span>Checking for updates...</span>
            </div>
        `;

        const result = await this.checkForUpdates();

        if (!result.success) {
            // Show error
            statusEl.innerHTML = `
                <div class="update-error">
                    <span class="error-icon">✗</span>
                    <span class="error-text">${result.message}</span>
                </div>
            `;
            actionsEl.innerHTML = `
                <button class="btn btn-primary" id="checkUpdateBtn">Retry</button>
            `;
            this.attachEventListeners();
            return;
        }

        if (result.update_available) {
            // Show update available
            statusEl.innerHTML = `
                <div class="update-available">
                    <span class="update-icon">🎉</span>
                    <div class="update-details">
                        <div class="update-version-info">
                            <strong>Update Available!</strong>
                            <div class="version-comparison">
                                ${result.current_version} → ${result.latest_version}
                            </div>
                        </div>
                        ${result.release_notes ? `
                            <div class="release-notes">
                                <details>
                                    <summary>Release Notes</summary>
                                    <div class="release-notes-content">${this.formatReleaseNotes(result.release_notes)}</div>
                                </details>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            actionsEl.innerHTML = `
                <button class="btn btn-primary" id="startUpdateBtn">Update to ${result.latest_version}</button>
                <button class="btn btn-secondary" id="checkUpdateBtn">Check Again</button>
            `;

            // Attach new event listeners
            const updateBtn = document.getElementById('startUpdateBtn');
            if (updateBtn) {
                updateBtn.addEventListener('click', () => this.handleStartUpdate());
            }
            this.attachEventListeners();
        } else {
            // Show up to date
            statusEl.innerHTML = `
                <div class="update-current">
                    <span class="success-icon">✓</span>
                    <span class="success-text">You are using the latest version (${result.current_version})</span>
                </div>
            `;
            actionsEl.innerHTML = `
                <button class="btn btn-secondary" id="checkUpdateBtn">Check Again</button>
            `;
            this.attachEventListeners();
        }
    }

    /**
     * Handle start update button click
     */
    async handleStartUpdate() {
        const statusEl = document.getElementById('updateStatus');
        const actionsEl = document.getElementById('updateActions');

        // Confirm with user
        if (!confirm(`Update NanoCloud from ${this.currentVersion} to ${this.latestVersion}?\n\nThe application will be briefly unavailable during the update.`)) {
            return;
        }

        // Show updating state
        statusEl.innerHTML = `
            <div class="update-progress">
                <div class="loading-spinner"></div>
                <div class="progress-text">
                    <strong>Updating to ${this.latestVersion}...</strong>
                    <p>Please do not close this window or refresh the page.</p>
                    <p>This may take a few moments.</p>
                </div>
            </div>
        `;
        actionsEl.innerHTML = '';

        const result = await this.startUpdate();

        if (result.success) {
            // Show success
            statusEl.innerHTML = `
                <div class="update-success">
                    <span class="success-icon">✓</span>
                    <div class="success-details">
                        <strong>Update Successful!</strong>
                        <p>NanoCloud has been updated to ${result.new_version}</p>
                        <p>The page will reload in 3 seconds...</p>
                    </div>
                </div>
            `;
            actionsEl.innerHTML = `
                <button class="btn btn-primary" id="reloadBtn">Reload Now</button>
            `;

            // Auto-reload after 3 seconds
            setTimeout(() => {
                window.location.reload();
            }, 3000);

            // Manual reload button
            const reloadBtn = document.getElementById('reloadBtn');
            if (reloadBtn) {
                reloadBtn.addEventListener('click', () => window.location.reload());
            }
        } else {
            // Show error
            statusEl.innerHTML = `
                <div class="update-error">
                    <span class="error-icon">✗</span>
                    <div class="error-details">
                        <strong>Update Failed</strong>
                        <p>${result.message}</p>
                        <p>Your installation has been preserved. You can try updating again or contact support.</p>
                    </div>
                </div>
            `;
            actionsEl.innerHTML = `
                <button class="btn btn-primary" id="checkUpdateBtn">Try Again</button>
                <button class="btn btn-danger" id="rollbackBtn">Rollback</button>
            `;

            // Attach event listeners
            this.attachEventListeners();
            const rollbackBtn = document.getElementById('rollbackBtn');
            if (rollbackBtn) {
                rollbackBtn.addEventListener('click', () => this.handleRollback());
            }
        }
    }

    /**
     * Handle rollback button click
     */
    async handleRollback() {
        if (!confirm('Rollback to the previous version?\n\nThis will restore your installation from the backup.')) {
            return;
        }

        const statusEl = document.getElementById('updateStatus');
        const actionsEl = document.getElementById('updateActions');

        statusEl.innerHTML = `
            <div class="update-progress">
                <div class="loading-spinner"></div>
                <span>Rolling back...</span>
            </div>
        `;
        actionsEl.innerHTML = '';

        const result = await this.rollback();

        if (result.success) {
            statusEl.innerHTML = `
                <div class="update-success">
                    <span class="success-icon">✓</span>
                    <div class="success-details">
                        <strong>Rollback Successful</strong>
                        <p>${result.message}</p>
                        <p>The page will reload in 3 seconds...</p>
                    </div>
                </div>
            `;

            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } else {
            statusEl.innerHTML = `
                <div class="update-error">
                    <span class="error-icon">✗</span>
                    <span class="error-text">${result.message}</span>
                </div>
            `;
            actionsEl.innerHTML = `
                <button class="btn btn-primary" id="checkUpdateBtn">Back</button>
            `;
            this.attachEventListeners();
        }
    }

    /**
     * Format release notes for display
     */
    formatReleaseNotes(notes) {
        // Simple markdown-like formatting
        return notes
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }
}

// Export singleton instance
export const updateChecker = new UpdateChecker();
