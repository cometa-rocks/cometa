import { Injectable } from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { WhatsNewDialog } from '@dialogs/whats-new/whats-new.component';
import { SelectSnapshot } from '@ngxs-labs/select-snapshot';
import { CustomSelectors } from '@others/custom-selectors';

/**
 * This service is used to manage the What's New dialog
 */
@Injectable()
export class WhatsNewService {
    
    /** Holds the current app version */
    @SelectSnapshot(CustomSelectors.GetConfigProperty('version')) version: Config['version'];

    /** Holds the changelog array from Config */
    @SelectSnapshot(CustomSelectors.GetConfigProperty('changelog')) changelog: Config['changelog'];

    constructor(
        private _dialog: MatDialog
    ) { }

    /** localStorage key to save the previous version */
    storageKey = 'lastChangelogVersion';

    /** Minimum changes count for the What's New to be shown */
    minimumChanges = 5;

    /**
     * Collects changes and opens the What's New Dialog if changes array length exceeds minimumChanges
     */
    collectAndOpen() {
        const changes = this.collectChanges();
        if (changes.length > this.minimumChanges) {
            this.openChangelog(changes);
        }
    }

    /**
     * This function collects all changes between the last saved version in localStorage
     * and the current version in config.json
     */
    collectChanges(): LogChange[] {
        const currentVersion = this.version;
        const previousVersion = localStorage.getItem(this.storageKey);
        const changelog = this.changelog;
        // Fail safe check value
        // Check if previous exists in changelog
        const exists = !!previousVersion && changelog.some(item => item.version === previousVersion);
        if (exists) {
            // Get indexes of current version and previous
            const currentVersionIndex = changelog.findIndex(item => item.version === currentVersion);
            const previousVersionIndex = changelog.findIndex(item => item.version === previousVersion);
            // Collect changes between versions
            const changelogChanges = changelog.slice(currentVersionIndex, previousVersionIndex);
            let changeCollection: LogChange[] = [];
            for (let i = 0; i < changelogChanges.length; i++) {
                // Add text changes
                if (Array.isArray(changelogChanges[i].text)) {
                    const items: LogChange[] = changelogChanges[i].text.map(item => ({
                        type: 'bugfix',
                        text: item
                    }));
                    changeCollection = changeCollection.concat(items);
                }
                // Add bugfix changes
                if (Array.isArray(changelogChanges[i].bugfixes)) {
                    const items: LogChange[] = changelogChanges[i].bugfixes.map(item => ({
                        type: 'bugfix',
                        text: item
                    }));
                    changeCollection = changeCollection.concat(items);
                }
                // Add new features changes
                if (Array.isArray(changelogChanges[i].features)) {
                    const items: LogChange[] = changelogChanges[i].features.map(item => ({
                        type: 'feature',
                        title: item.title,
                        text: item.description
                    }));
                    changeCollection = changeCollection.concat(items);
                }
            }
            return changeCollection;
        } else {
            // If previousVersion is invalid or null, set current version on localStorage
            localStorage.setItem(this.storageKey, this.version);
            return [];
        }
    }

    /**
     * Opens the What's New dialog
     * @param {LogChange[]} changes Array of changes, if not provided will be collected automatically
     */
    openChangelog(changes?: LogChange[]) {
        if (!changes) {
            // Collect changes if not provided
            changes = this.collectChanges();
        }
        // Open What's New Dialog
        this._dialog.open(WhatsNewDialog, {
            data: changes,
            disableClose: true,
            autoFocus: false,
            closeOnNavigation: false,
            panelClass: 'whats-new-panel'
        })
        .afterClosed()
        .subscribe(_ => {
            // When the user has closed the What's New dialog, save current version in localStorage
            localStorage.setItem(this.storageKey, this.version);
        })
    }

}