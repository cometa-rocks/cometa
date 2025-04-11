import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Inject,
  HostListener,
} from '@angular/core';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { GraphService } from '@services/graph.service';
import { SafeStyle, DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { API_BASE, API_URL } from 'app/tokens';
import { Select, Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { BehaviorSubject, Observable } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import {
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  tap,
} from 'rxjs/operators';
import { KEY_CODES } from '@others/enums';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';
import { ScreenshotBgPipe } from '@pipes/screenshot-bg.pipe';
import { NumeralPipe } from '@pipes/numeral.pipe';
import { FirstLetterUppercasePipe } from '@pipes/first-letter-uppercase.pipe';
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { CometaDatePipe } from '@pipes/cometa-date.pipe';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { NgIf, NgClass, AsyncPipe, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { ChangeDetectorRef } from '@angular/core';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import {
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialog as MatDialog,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacyOptionModule } from '@angular/material/legacy-core';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
interface StepSummaryResponse {
  summary: {
    total_execution_time: number;
    average_execution_time: number;
    min_execution_time: number;
    max_execution_time: number;
    median_execution_time: number;
    total_tests: number;
    failed_tests: number;
  };
  graphs: Array<{
    name: string;
    blob: string;
  }>;
  success: boolean;
  message?: string;
  filters: {
    group_by: string;
    start_datetime: string;
    end_datetime: string;
  };
}

@Component({
  selector: 'graph-view',
  templateUrl: './graph-view.component.html',
  styleUrls: ['./graph-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    NgClass,
    MatLegacyProgressSpinnerModule,
    AmParsePipe,
    AmDateFormatPipe,
    SecondsToHumanReadablePipe,
    FirstLetterUppercasePipe,
    NumeralPipe,
    ScreenshotBgPipe,
    AsyncPipe,
    CometaDatePipe,
    FormsModule,
    MatLegacySelectModule,
    MatLegacyFormFieldModule,
    MatLegacyInputModule,
    MatLegacyDialogModule,
    MatLegacyOptionModule,
    MatIconModule,
    MatLegacyTooltipModule,
    MatLegacyButtonModule,
    MatExpansionModule,
    MatCheckboxModule
  ],
  providers: [
    GraphService
  ]
})
export class GraphViewComponent implements OnInit {
  ready = new BehaviorSubject<boolean>(false);
  featureResultId: number;
  stepResultId: number;
  groupBy: string = 'Day';
  isLoaded: boolean = false;

  constructor(
    private _acRouted: ActivatedRoute,
    private _router: Router,
    private _api: GraphService,
    private _dialog: MatDialog,
    private _sanitizer: DomSanitizer,
    private _store: Store,
    private snack: MatSnackBar,
    private cdr: ChangeDetectorRef,  // Add ChangeDetectorRef
    @Inject(API_BASE) private api_base: string,
    @Inject(API_URL) private api_url: string
  ) { }

  featureCreationDate: string = '';
  startDateTime: string = '';
  endDateTime: string = '';

  filters = {
    start_datetime: "",
    end_datetime: "",
    group_by: ""
  }

  summary!: {};
  graphs!: any;
  removeOutliers: boolean = false;
  getGraphAndSummary() {
    this.isLoaded = false;
    let filter_data = {
      start_datetime: this.startDateTime,
      end_datetime: this.endDateTime,
      group_by: this.groupBy,
      remove_outliers: this.removeOutliers
    }
    // Call the API with updated filters
    this._api.getStepSummaryGraph(this.stepResultId, filter_data).subscribe((response: StepSummaryResponse) => {
      // console.log('Full Response:', JSON.stringify(response, null, 2));
      
      if (response.success != true) {
        let error_message = response.message ? response.message : "Error while fetching the graph data, please contact administrator";
        this.snack.open(error_message, 'Close', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      }
      console.log('response', response);

      this.summary = response.summary;
      this.graphs = response.graphs;
      this.filters = response.filters;
      this.isLoaded = true;
      
      this.cdr.detectChanges();
    },
      (error) => {
        console.error("Failed to load the data", error);
        this.snack.open('Could not load the step report graphs', 'OK');
      });
  }

  validateDates(): boolean {
    if (!this.startDateTime || !this.endDateTime) {
      return true; // Allow empty dates
    }

    const startDate = new Date(this.startDateTime);
    const endDate = new Date(this.endDateTime);

    if (startDate > endDate) {
      this.snack.open('Start date cannot be greater than end date', 'Close', {
        duration: 4000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom'
      });
      return false;
    }
    return true;
  }

  onFilter() {
    localStorage.setItem('co_startDateTime', this.startDateTime);
    localStorage.setItem('co_endDateTime', this.endDateTime);

    if (!this.validateDates()) {
      return;
    }
    
    this.getGraphAndSummary();
  }

  ngOnInit() {
    //create localstorage variable, will save the startdate and edndate, if not exist, will save the current date
    const exists_start = localStorage.getItem('co_startDateTime');
    if (!exists_start) {
      localStorage.setItem('co_startDateTime', '');
    }
    const exists_end = localStorage.getItem('co_endDateTime');
    if (!exists_end) {
      localStorage.setItem('co_endDateTime', '');
    }
    // Get Feature Result info
    this._acRouted.paramMap
      .pipe(
        map(params => {
          this.featureResultId = +params.get('feature_result_id');
          // Fetch feature creation date
          fetch(this.api_url + '/features/' + params.get('feature') + '/')
            .then(response => response.json())
            .then(data => {
              this.featureCreationDate = data.results[0].created_on;
              this.featureCreationDate = this.featureCreationDate.split('.')[0].slice(0, -3);
          
              // Only decide default or stored *after* featureCreationDate is ready
              const savedStart = localStorage.getItem('co_startDateTime');
              const savedEnd = localStorage.getItem('co_endDateTime');
          
              this.startDateTime = savedStart && savedStart !== '' ? savedStart : this.featureCreationDate;
              this.endDateTime = savedEnd && savedEnd !== '' ? savedEnd : new Date().toISOString().slice(0, 16);
          
              // Optional: store defaults in localStorage
              if (!savedStart || savedStart === '') {
                localStorage.setItem('co_startDateTime', this.startDateTime);
              }
              if (!savedEnd || savedEnd === '') {
                localStorage.setItem('co_endDateTime', this.endDateTime);
              }
          
              this.onFilter();
            });
          return this.featureResultId;
        })
      )
      .subscribe();
      

    // Get Step Result info
    this._acRouted.paramMap
      .pipe(
        map(params => {
          this.stepResultId = +params.get('step_result_id');
          return this.stepResultId;
        })
      )
      .subscribe();
      
  };

  getImageSource(blob: string): SafeUrl {
    return this._sanitizer.bypassSecurityTrustUrl(blob);
  }

  private formatDateTime(dateTimeStr: string): string {
    if (!dateTimeStr) return '';
    // Ensure the datetime string is in the correct format for datetime-local input
    return dateTimeStr.replace(' ', 'T');
  }

  formatTime(ms: number): string {
    if (!ms) return '0 ms';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMs = Math.floor(ms % 1000);
    
    if (seconds < 1) {
      return `${ms}ms`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s ${remainingMs}ms`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s ${remainingMs}ms`;
    } else {
      return `${seconds}s ${remainingMs}ms`;
    }
  }

  getFailurePercentage(): number {
    if (!this.summary || !this.summary['total_tests'] || this.summary['total_tests'] === 0) {
      return 0;
    }
    const failedTests = this.summary['failed_tests'] || 0;
    return Math.round((failedTests / this.summary['total_tests']) * 100);
  }

}

