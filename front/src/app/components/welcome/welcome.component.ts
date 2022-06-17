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

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Select } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { SharedActionsService } from '@services/shared-actions.service';
import { TourService } from '@services/tour.service';
import { Tour, TourExtended, Tours } from '@services/tours';
import { UserState } from '@store/user.state';
import { map, Observable } from 'rxjs';

@Component({
  selector: 'cometa-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WelcomeComponent{
  constructor(
    private _tours: Tours,
    public _sharedActions: SharedActionsService,
    private _tourService: TourService
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
}
