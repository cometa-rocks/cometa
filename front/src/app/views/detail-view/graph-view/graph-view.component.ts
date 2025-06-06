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
import { API_BASE } from 'app/tokens';
import { Store } from '@ngxs/store';
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
    MatExpansionModule
  ],
  providers: [
    GraphService
  ]
})
export class GraphViewComponent implements OnInit {
  ready = new BehaviorSubject<boolean>(false);
  featureResultId: number;
  stepResultId: number;
  groupBy: string = '';
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
    @Inject(API_BASE) private api_base: string
  ) { }

  startDateTime: string = '';
  endDateTime: string = '';

  filters = {
    start_datetime: "",
    end_datetime: "",
    group_by: "Month"
  }

  summary!: {};
  graphs!: any;

  getGraphAndSummary() {
    this.isLoaded = false;
    let filter_data = {
      start_datetime: this.startDateTime,
      end_datetime: this.endDateTime,
      group_by: this.groupBy
    }

    // Call the API with updated filters
    this._api.getStepSummaryGraph(this.stepResultId, filter_data).subscribe((response: any) => {
      if (!response || response.success !== true) {
        let error_message = response?.message || "Error while fetching the graph data, please contact administrator";
        this.snack.open(error_message, 'Close', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
        this.isLoaded = true;
        this.cdr.detectChanges();
        return;
      }

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
    if (!this.validateDates()) {
      return;
    }
    this.getGraphAndSummary();
  }

  ngOnInit() {
    // Get Feature Result info
    this._acRouted.paramMap
      .pipe(
        map(params => {
          this.featureResultId = +params.get('feature_result_id');
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

    this.getGraphAndSummary();
  };

  getImageSource(blob: string): SafeUrl {
    return this._sanitizer.bypassSecurityTrustUrl(blob);
  }

  private formatDateTime(dateTimeStr: string): string {
    if (!dateTimeStr) return '';
    // Ensure the datetime string is in the correct format for datetime-local input
    return dateTimeStr.replace(' ', 'T');
  }

}

