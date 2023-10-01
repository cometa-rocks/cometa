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

import { Component, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { Select } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { JoyrideService } from '@plugins/ngx-joyride/services/joyride.service';
import { SharedActionsService } from '@services/shared-actions.service';
import { TourService } from '@services/tour.service';
import { Tour, TourExtended, Tours } from '@services/tours';
import { UserState } from '@store/user.state';
import { map, Observable } from 'rxjs';
import { LetDirective } from '../../directives/ng-let.directive';
import { NgIf, AsyncPipe } from '@angular/common';

@Component({
    selector: 'cometa-welcome',
    templateUrl: './welcome.component.html',
    styleUrls: ['./welcome.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [NgIf, LetDirective, AsyncPipe]
})
export class WelcomeComponent{
  constructor(
    private _tours: Tours,
    public _sharedActions: SharedActionsService,
    private _tourService: TourService,
    private _joyRide: JoyrideService
  ) {
    // Get the tours data from the current user
    this.tours$ = this.settings$.pipe(
      map(settings => {
        return Object.entries(this._tours)
              // Remove injected services
              .filter(entry => !entry[0].startsWith('_'))
              // Map to value
              .map(entry => entry[1])
              // Add custom properties
              .map((tour: Tour) => {
                let completed
                try {
                  completed = settings.tours_completed[tour.id] >= tour.version
                } catch (err) {
                  completed = false
                }
                return {
                    ...tour,
                    completed: completed
                }
              })
      })
    )
  }

  // Gets the name of the current user
  @Select(UserState.GetUserName) userName$: Observable<ReturnType<typeof UserState.GetUserName>>;
  // Gets the user settings
  @Select(UserState.RetrieveSettings) settings$: Observable<UserInfo['settings']>;
  // Checks if the user has already visited the welcome page
  @Select(CustomSelectors.GetConfigProperty('co_first_time_cometa')) showWelcome$: Observable<boolean>;

  // Tours object
  tours$: Observable<TourExtended[]>

  /**
   * Comences the feature creation tour
   * @author dph000
   * @date 21/10/29
   * @lastModification 21/10/29
   */
  startTour(tour: Tour) {
    this._tourService.startTourById(tour.id, true)
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
