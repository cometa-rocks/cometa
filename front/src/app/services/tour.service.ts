import { Inject, Injectable } from '@angular/core';
import { JoyrideService } from '@plugins/ngx-joyride/services/joyride.service';
import { Tour, TourDefinition, Tours } from '@services/tours';
import { DOCUMENT } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { SelectSnapshot } from '@ngxs-labs/select-snapshot';
import { UserState } from '@store/user.state';
import { MatDialog } from '@angular/material/dialog';
import { OfferTourComponent } from '@dialogs/offer-tour/offer-tour.component';
import { filter, tap } from 'rxjs/operators';
import { Configuration } from '@store/actions/config.actions';
import { Store } from '@ngxs/store';
import { User } from '@store/actions/user.actions';
import { format, parse, isValid, isSameDay } from 'date-fns';

@Injectable()
export class TourService {

  constructor(
    private readonly _joyrideService: JoyrideService,
    private _dialog: MatDialog,
    private _tours: Tours,
    private _store: Store,
    @Inject(DOCUMENT) private readonly document: Document
  ) { }

  @SelectSnapshot(UserState) user: UserInfo;

  private sidebarOpen(open: boolean) {
    return this._store.dispatch(new Configuration.SetProperty('openedMenu', open));
  }

  private setTourMode(tourMode: boolean) {
    this.tourMode$.next(tourMode);
  }

  /** This variable is used to determine if step definitions should be shown or not, saves performance */
  tourMode$ = new BehaviorSubject<boolean>(false);

  /** This variable is used publicly */
  runningTour$ = new BehaviorSubject<TourDefinition[]>([]);

  startTourById(id: string, force: boolean = false) {
    const tourName = Object.entries(this._tours).find(entry => entry[1].id === id)[0];
    this.startTour(tourName, force);
  }

  /**
   * Initializes the guided tour to show the user how co.meta works
   */
  startTour(tourName: string, force: boolean = false) {
    // Get tour from name
    const tour: Tour = this._tours[tourName];
    if (force) {
      this.initializeTour(tour);
      return;
    }
    // Check if it's already completed
    if (this.user.settings.tours_completed && this.user.settings.tours_completed[tour.id] && tour.version <= this.user.settings.tours_completed[tour.id]) {
      return;
    }
    // Check if tour is delayed
    const storageKey = `tourDelay_${tour.id}`;
    const storageFormat = 'yyyy-MM-dd';
    const tourStorage = localStorage.getItem(storageKey);
    if (tourStorage) {
      const parsed = parse(tourStorage, storageFormat, new Date());
      // Check date is in the past, date can't be in the future
      if (isValid(parsed) && isSameDay(parsed, new Date())) {
        return;
      }
    }
    // Offer tour to user
    this._dialog.open(OfferTourComponent, { data: tour }).afterClosed().pipe(
      tap(offer => {
        if (offer === 'later') {
          // See later tour
          localStorage.setItem(storageKey, format(new Date(), storageFormat));
          return;
        }
        // Mark as completed in backend if user skipped the tour
        if (!offer) this.completeTour(tour);
      }),
      filter(offer => offer === true)
    ).subscribe(_ => this.initializeTour(tour))
  }

  initializeTour(tour: Tour) {
    this.runningTour$.next(tour.steps);
    // Turn on tourMode
    // This creates the steps array in the DOM for Joyride
    this.setTourMode(true);
    // Hide sidebar
    this.sidebarOpen(false);
    // Initialize guided tour
    this._joyrideService.startTour({
      steps: tour.steps.map(x => x.name),
      themeColor: '#1565C0',
      waitingTime: 300
    }).subscribe(
      // Emitted every time a step is changed or first seen
      step => {

      },
      // Emitted when there's an error
      error => {
        this.setTourMode(false);
      },
      // Emitted when tour is completed
      () => {
        this.completeTour(tour);
        this.setTourMode(false);
      }
    )
  }

  /**
   * Deals with saving the completed status of a tour in the backend
   * @param tour Tour
   * @returns void
   */
  completeTour(tour: Tour) {
    // Get settings from user
    let settings = this.user.settings;
    // Add tour id and version to settings
    settings = settings || {};
    settings.tours_completed = settings.tours_completed || {};
    settings.tours_completed[tour.id] = tour.version;
    // Make request to backend
    this._store.dispatch( new User.SetSetting({ tours_completed: settings.tours_completed }) );
  }


  /**
   * Created to handle the click on Next button in every tour step
   * @param step TourDefinition
   * @returns void
   */
  handleNext(step: TourDefinition) {
    const runningTour = this.runningTour$.getValue();
    // Automatically scroll to attached element of next step if present
    const attachTo = runningTour[runningTour.findIndex(s => s.name === step.name) + 1].attachTo;
    // Check if is defined
    if (attachTo) {
      // Scroll to element
      this.document.querySelector(attachTo).scrollIntoView({
        behavior: 'auto',
        block: 'center'
      })
    }
    // Execute current step nextFn
    step.nextFn();
  }

  /**
   * Created to handle the click on Previous button in every tour step
   * @param step TourDefinition
   * @returns void
   */
  handlePrevious(step: TourDefinition) {
    const runningTour = this.runningTour$.getValue();
    // Automatically scroll to attached element of previous step if present
    const attachTo = runningTour[runningTour.findIndex(s => s.name === step.name) - 1].attachTo;
    // Check if is defined
    if (attachTo) {
      // Scroll to element
      this.document.querySelector(attachTo).scrollIntoView({
        behavior: 'auto',
        block: 'center'
      })
    }
    // Execute current step previousFn
    step.previousFn();
  }

}
