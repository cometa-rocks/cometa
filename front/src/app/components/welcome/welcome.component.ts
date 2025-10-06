/**
 * welcome.component.ts
 *
 * Contains the code to control the welcome page which is displayed whenever the user has not created any testcase in cometa
 *
 * @date 21/10/29
 *
 * @lastModification 21/10/29
 *
 * @author: dph000
 */

import {
  Component,
  ChangeDetectionStrategy,
  HostListener
} from '@angular/core';
import { Select } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { JoyrideService } from '@plugins/ngx-joyride/services/joyride.service';
import { SharedActionsService } from '@services/shared-actions.service';
import { TourService } from '@services/tour.service';
import { Tour, TourExtended, Tours } from '@services/tours';
import { UserState } from '@store/user.state';
import { map, Observable } from 'rxjs';
import { LetDirective } from '../../directives/ng-let.directive';
import { NgIf, AsyncPipe, DatePipe } from '@angular/common';
import { WhatsNewService } from '@services/whats-new.service';
import { CommonModule } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule } from '@ngx-translate/core';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { ConfigState } from '@store/config.state';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'cometa-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgIf, LetDirective, AsyncPipe, CommonModule, MatDialogModule, DatePipe, TranslateModule, MatChipsModule],
})
export class WelcomeComponent {
  constructor(
    private _tours: Tours,
    public _sharedActions: SharedActionsService,
    private _tourService: TourService,
    private _joyRide: JoyrideService,
    private whatsNewService: WhatsNewService
  ) {
    // Get the tours data from the current user
    this.tours$ = this.settings$.pipe(
      map(settings => {
        return (
          Object.entries(this._tours)
            // Remove injected services
            .filter(entry => !entry[0].startsWith('_'))
            // Map to value
            .map(entry => entry[1])
            // Add custom properties
            .map((tour: Tour) => {
              let completed;
              try {
                completed = settings.tours_completed[tour.id] >= tour.version;
              } catch (err) {
                completed = false;
              }
              return {
                ...tour,
                completed: completed,
              };
            })
        );
      })
    );
  }

  /** Get formatted date from last changelog item, can be null */
  @ViewSelectSnapshot(ConfigState.getLastChangelogDate) date: string | null;

  changes: LogChange[] = [];
  features: LogChange[] = [];
  bugfixes: LogChange[] = [];
  /** Full changelog from config */
  @ViewSelectSnapshot((state: any) => state.config.changelog) changelog: any[];
  /** Versions to render (grouped) */
  versionsToShow: any[] = [];

  /** Filter chips */
  readonly filterTypes = [
    { key: 'feature', labelKey: 'whats_new.new_features' },
    { key: 'improved', labelKey: 'whats_new.improved' },
    { key: 'bugfix', labelKey: 'whats_new.bugfixes' },
    { key: 'security', labelKey: 'whats_new.security' },
    { key: 'breaking', labelKey: 'whats_new.breaking_changes' },
  ] as const;

  private readonly defaultTypes: string[] = [
    'feature',
    'improved',
    'bugfix',
    'security',
    'breaking',
  ];
  selectedTypes = new Set<string>(this.defaultTypes);

  ngOnInit(){
    // Show entire changelog grouped by version
    this.versionsToShow = Array.isArray(this.changelog) ? this.changelog : [];
  }

  isEnabled(type: string): boolean {
    return this.selectedTypes.has(type);
  }

  onSelectionChange(type: string, selected: boolean) {
    if (selected) this.selectedTypes.add(type);
    else this.selectedTypes.delete(type);
  }

  get filteredVersions(): any[] {
    const enabled = this.selectedTypes;
    return (this.versionsToShow || []).filter(v => {
      if (enabled.has('feature') && Array.isArray(v.features) && v.features.length > 0) return true;
      if (enabled.has('improved') && Array.isArray(v.improved) && v.improved.length > 0) return true;
      if (enabled.has('bugfix')) {
        const hasBugfixes = Array.isArray(v.bugfixes) && v.bugfixes.length > 0;
        const hasText = Array.isArray(v.text) && v.text.length > 0;
        if (hasBugfixes || hasText) return true;
      }
      if (enabled.has('security') && Array.isArray(v.security) && v.security.length > 0) return true;
      if (enabled.has('breaking') && Array.isArray(v.breaking) && v.breaking.length > 0) return true;
      return false;
    });
  }

  get noFiltersSelected(): boolean {
    return this.selectedTypes.size === 0;
  }

  // Gets the name of the current user
  @Select(UserState.GetUserName) userName$: Observable<
    ReturnType<typeof UserState.GetUserName>
  >;
  // Gets the user settings
  @Select(UserState.RetrieveSettings) settings$: Observable<
    UserInfo['settings']
  >;
  // Checks if the user has already visited the welcome page
  @Select(CustomSelectors.GetConfigProperty('co_first_time_cometa'))
  showWelcome$: Observable<boolean>;

  // Tours object
  tours$: Observable<TourExtended[]>;

  /**
   * Comences the feature creation tour
   * @author dph000
   * @date 21/10/29
   * @lastModification 21/10/29
   */
  startTour(tour: Tour) {
    this._tourService.startTourById(tour.id, true);
  }

  // Hotkey Escape ... closes tour if there is one in progress
  @HostListener('document:keydown.Escape', ['$event'])
  hotkey_escape(event: KeyboardEvent) {
    // close joyride tour if it currently in progress
    if (this._joyRide.isTourInProgress()) {
      // if current tour is feature creation and user clicks on esc key, feature will fire event and dialog will pop up informing user that there are unsaved changes in feature
      // to prevent this behaviour we stop immediate propagation
      event.stopImmediatePropagation();

      // close tour presentation
      this._joyRide.closeTour();
    }
  }
}
