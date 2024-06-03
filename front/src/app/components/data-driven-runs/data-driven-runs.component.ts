import { HttpClient } from '@angular/common/http';
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { Router } from '@angular/router';
import { DataDrivenExecution } from '@dialogs/data-driven-execution/data-driven-execution.component';
import { DataDrivenTestStop } from '@dialogs/data-driven-execution/data-driven-stop/data-driven-stop.component';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { ApiService } from '@services/api.service';
import { SharedActionsService } from '@services/shared-actions.service';
import { InterceptorParams } from 'ngx-network-error';
import { PixelDifferencePipe } from '@pipes/pixel-difference.pipe';
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { NgIf } from '@angular/common';
import { LetDirective } from '../../directives/ng-let.directive';
import { ElementRef, HostListener } from '@angular/core';
import { KEY_CODES } from '@others/enums';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';


@Component({
  selector: 'cometa-data-driven-runs',
  templateUrl: './data-driven-runs.component.html',
  styleUrls: ['./data-driven-runs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MtxGridModule,
    LetDirective,
    NgIf,
    StopPropagationDirective,
    MatLegacyMenuModule,
    MatDividerModule,
    MatLegacyButtonModule,
    AmParsePipe,
    AmDateFormatPipe,
    SecondsToHumanReadablePipe,
    PixelDifferencePipe,
    MatTooltipModule,
    TranslateModule,
  ],
})
export class DataDrivenRunsComponent implements OnInit {
  
  constructor(
    public _sharedActions: SharedActionsService,
    private cdRef: ChangeDetectorRef,
    private _router: Router,
    private _http: HttpClient,
    public _dialog: MatDialog,
    private _api: ApiService,
    private buttonDataDrivenTest: ElementRef
  ) {}

  columns: MtxGridColumn[] = [
    { header: 'Status', field: 'status', sortable: true },
    { header: 'File Name', field: 'file.name', sortable: true, class: 'name' },
    {
      header: 'Execution Date',
      field: 'date_time',
      sortable: true,
      width: '190px',
      sortProp: { start: 'desc', id: 'date_time' },
    },
    { header: 'Total', field: 'total', sortable: true },
    { header: 'OK', field: 'ok', sortable: true },
    { header: 'NOK', field: 'fails', sortable: true },
    { header: 'Skipped', field: 'skipped' },
    { header: 'Duration', field: 'execution_time', sortable: true },
    { header: 'Pixel Diff', field: 'pixel_diff', sortable: true },
    {
      header: 'Options',
      field: 'options',
      // pinned: 'right',
      right: '0px',
      type: 'button',
      width: '130px',
      buttons: [
        {
          type: 'icon',
          text: 'Stop',
          icon: 'stop',
          tooltip: 'Stop Execution',
          color: 'warn',
          click: (result: DataDrivenRun) => {
            this.stop_data_driven(result, this);
            console.log(result.running);
          },
          iif: (result: DataDrivenRun) => result.running,
        },
        {
          type: 'icon',
          text: 'delete',
          icon: 'delete',
          tooltip: 'Delete result',
          color: 'warn',
          click: (result: DataDrivenRun) => {
            this._api.deleteDataDrivenTest(result.run_id).subscribe({
              next: _ => {
                // maybe we should just delete from the array and that is it?
                // this.getResults();

                this.results = this.results.filter(
                  run => run.run_id != result.run_id
                );
              },
            });
          },
        },
      ],
    },
  ];

  results = [];
  total = 0;
  isLoading = true;
  showPagination = true;
  latestFeatureResultId: number = 0;

  query = {
    page: 0,
    size: 10,
  };

  get params() {
    const p = { ...this.query };
    p.page += 1;
    return p;
  }

  openContent(run: DataDrivenRun) {
    this._router.navigate(['data-driven', run.run_id]);
  }

  getResults() {
    this.isLoading = true;
    this._http
      .get(`/backend/api/data_driven/`, {
        params: {
          ...this.params,
        },
      })
      .subscribe({
        next: (res: any) => {
          this.results = res.results;
          this.total = res.count;
          this.showPagination = this.total > 0 ? true : false;
        },
        error: err => {
          console.error(err);
        },
        complete: () => {
          this.isLoading = false;
          this.cdRef.detectChanges();
        },
      });
  }

  openNewDataDrivenRun() {
    this._dialog.open(DataDrivenExecution, {
      disableClose: true,
      autoFocus: false,
      panelClass: 'edit-feature-panel',
      data: {},
    });
  }

  updateData(e: PageEvent) {
    this.query.page = e.pageIndex;
    this.query.size = e.pageSize;
    this.getResults();

    // create a localstorage session
    localStorage.setItem('co_results_page_size', e.pageSize.toString());
  }

  ngOnInit(): void {
    this.query.size =
      parseInt(localStorage.getItem('co_results_page_size')) || 10;
    this.getResults();
  }

  // Stop data driven test
  stop_data_driven(result, parent) {
    let run_id = result.run_id;
    this._http.post<any>(`/backend/stop_data_driven/${run_id}/`, {}).subscribe({
      next(res: any) {
        if (res.success) {
          result.running = false;
          parent._dialog.open(DataDrivenTestStop, {
            minWidth: '500px',
            panelClass: 'edit-feature-panel',
            data: {
              run_id: res.run_id,
              test_count: res.tasks,
            },
          });
        }
      },
      error(err) {
        if (err.status >= 400 && err.status < 500) {
          const error = JSON.parse(err.error);
          parent._snackBar.open(
            `Error: ${error.error}. Please try again.`,
            'OK',
            {
              duration: 30000,
            }
          );
        }
      },
    });
  }

  // Shortcut (T, S) Data Driven Test button
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {

    const columnsShow = document.querySelector(".mtx-grid-column-menu-body");

    const overviewDiv = document.querySelector(".mat-mdc-dialog-surface");

    switch (event.keyCode) {
      case KEY_CODES.T:
        // Observe if the class of div its available
        if (overviewDiv == null) {
          if(columnsShow != null){
            this.buttonDataDrivenTest.nativeElement.querySelector('.mat-mdc-button-touch-target').click();
          }
          this.buttonDataDrivenTest.nativeElement.querySelector('.mdc-button__label').click();
        }
        break;
      case KEY_CODES.S:
        if(overviewDiv == null) {
          this.buttonDataDrivenTest.nativeElement.querySelector('.mat-mdc-button-touch-target').click();
        }
        break;
    }
  }

  // Check if mouse is over the button (shortcuts view)
  isHovered = false;

  onMouseOver() {
    this.isHovered = true;
  }

  onMouseOut() {
    this.isHovered = false;
  }

}
