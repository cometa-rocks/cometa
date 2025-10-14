import { animate, style, transition, trigger } from '@angular/animations';
import {
  AsyncPipe,
  NgClass,
  NgIf,
  NgFor,
  NgStyle,
  TitleCasePipe,
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ElementRef,
  HostListener,
  ChangeDetectorRef
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { DomSanitizer } from '@angular/platform-browser';
import { ScreenshotComponent } from '@dialogs/screenshot/screenshot.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { ApiService } from '@services/api.service';
import { BrowserUseLogService, BrowserUseLogEntry } from '@services/browser-use-log.service';
import { LogService } from '@services/log.service';
import { JsonViewerComponent } from 'app/views/json-view/json-view.component';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, take } from 'rxjs/operators';
import { LetDirective } from '../../../directives/ng-let.directive';
import { TruncateApiBodyPipe } from '@pipes/truncate-api-body.pipe';
import { DatePipe } from '@angular/common';

@UntilDestroy()
@Component({
  selector: 'cometa-live-step',
  templateUrl: './live-step.component.html',
  styleUrls: ['./live-step.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('detailAnimation', [
      transition(':enter', [
        style({ transform: 'translateY(100%)', height: 0, opacity: 0 }),
        animate(
          '250ms',
          style({ transform: 'translateY(0)', height: '20px', opacity: 1 })
        ),
      ]),
      transition(':leave', [
        style({ transform: 'translateY(0)', height: '20px', opacity: 1 }),
        animate(
          '250ms',
          style({ transform: 'translateY(100%)', height: 0, opacity: 0 })
        ),
      ]),
    ]),
  ],
  standalone: true,
  imports: [
    LetDirective,
    NgClass,
    MatLegacyTooltipModule,
    NgIf,
    NgFor,
    MatIconModule,
    NgStyle,
    AsyncPipe,
    TitleCasePipe,
    TruncateApiBodyPipe,
    DatePipe,
  ],
})
export class LiveStepComponent implements OnInit {
  status$ = new BehaviorSubject<string>('waiting');

  error$ = new BehaviorSubject<string>('');

  healingData$ = new BehaviorSubject<HealeniumData | undefined>(undefined);

  // AI Logs properties
  aiLogs$: Observable<BrowserUseLogEntry[]>;
  showAILogs = true;

  // Loop progress properties
  isLoopStep = false;
  isInsideLoop = false;
  currentLoopIteration = 1;
  totalLoopIterations = null;
  
  // Simple loop info for failed steps
  failedLoopInfo: {
    wasInLoop: boolean;
    totalIterations: number;
    failedIterations: number[]; // Array of all iterations that failed
  } | null = null;
  

  constructor(
    private _store: Store,
    private _dialog: MatDialog,
    private _sanitizer: DomSanitizer,
    private _api: ApiService,
    private _browserUseLogService: BrowserUseLogService,
    private _elementRef: ElementRef,
    private _cdr: ChangeDetectorRef,
    private log: LogService
  ) {}

  @Input() step: FeatureStep;
  @Input() index: number;
  @Input() feature_result_id: number;
  @Input() featureRunID: number;
  @Input() browser: BrowserstackBrowser;
  @Input() mobiles: any;
  @Input() feature_id: number;
  @Input() steps$: Observable<FeatureStep[]>;

  @Output() updateMobiles: EventEmitter<any> = new EventEmitter<any>();

  details$: Observable<LiveStepSubDetail>;

  // Method to receive loop information from parent component
  updateLoopInfo(isInLoop: boolean, currentIteration: number, totalIterations: number | null) {
    this.isInsideLoop = isInLoop;
    this.currentLoopIteration = currentIteration;
    this.totalLoopIterations = totalIterations;
    
    // Initialize failure tracking as soon as we enter the loop so we can
    // accumulate every failed iteration instead of only the last one.
    if (isInLoop && totalIterations && !this.failedLoopInfo) {
      this.failedLoopInfo = {
        wasInLoop: true,
        totalIterations: totalIterations,
        failedIterations: [] // Will be populated as iterations fail
      };
      this.log.msg('4', `Step ${this.index} - created failedLoopInfo`, 'live-step', this.failedLoopInfo);
    }
    
    this._cdr.markForCheck();
  }

  // Method to process final loop information when test completes
  processFinalLoopInfo() {
    // Just trigger change detection to show the captured iteration info
    if (this.status$.getValue() === 'failed' && this.failedLoopInfo) {
      this.log.msg('4', `FINAL: Step ${this.index} showing captured failures`, 'live-step', this.failedLoopInfo.failedIterations);
      this._cdr.markForCheck();
    }
  }

  // Format failed iterations for display (concise and smart)
  getFailedIterationsText(): string {
    this.log.msg('4', `getFailedIterationsText called for step ${this.index}`, 'live-step', {
      failedLoopInfo: this.failedLoopInfo,
      hasFailedIterations: this.failedLoopInfo?.failedIterations?.length
    });
    
    if (!this.failedLoopInfo || !this.failedLoopInfo.failedIterations.length) {
      this.log.msg('4', `No failed iterations for step ${this.index}`, 'live-step');
      return '';
    }
    
    const iterations = this.failedLoopInfo.failedIterations;
    const total = this.failedLoopInfo.totalIterations;
    
    let result = '';
    if (iterations.length === 1) {
      result = `Failed in Loop ${iterations[0]} of ${total}`;
    } else if (iterations.length <= 5) {
      // Show individual iterations: "Failed in Loops 76, 150, 300 of 1000"
      result = `Failed in Loops ${iterations.join(', ')} of ${total}`;
    } else {
      // For many failures, show range: "Failed in Loops 76-300 (15 failures) of 1000"
      const first = iterations[0];
      const last = iterations[iterations.length - 1];
      result = `Failed in Loops ${first}-${last} (${iterations.length} failures) of ${total}`;
    }
    
    this.log.msg('4', `Generated feedback text for step ${this.index}: ${result}`, 'live-step');
    return result;
  }
  
  screenshots;
  vulnerable_headers_count;
  rest_api: number;

  ngOnInit() {
    // Initialize AI logs observable for this step
    this.aiLogs$ = this._browserUseLogService.getLogsForStep(
      this.feature_result_id,
      this.index
    );

    // Check if this is a loop step
    this.isLoopStep = this.step?.step_content?.includes('Loop') && 
                     this.step?.step_content?.includes('times starting at') && 
                     this.step?.step_content?.includes('and do');
    
    this.details$ = this._store.select(
      CustomSelectors.GetLastFeatureRunDetails(
        this.feature_id,
        this.featureRunID,
        this.browser,
        this.index
      )
    );

    this._store
      .select(
        CustomSelectors.GetLastFeatureRunSteps(
          this.feature_id,
          this.featureRunID,
          this.browser
        )
      )
      .pipe(
        untilDestroyed(this),
        tap((steps: StepStatus[]) => (this.resultSteps = steps))
      )
      .subscribe(steps => {
        if (steps && steps[this.index]) {
          if (steps[this.index].running) {
            this.status$.next('running');
          } else {
            const isFailed = !steps[this.index].info.success;
            const wasNotFailed = this.status$.getValue() !== 'failed';
            this.status$.next(isFailed ? 'failed' : 'success');
            
            // Capture the iteration when this specific step fails
            if (isFailed && this.isInsideLoop && this.totalLoopIterations && this.failedLoopInfo) {
              // Add to failed iterations if not already present
              if (!this.failedLoopInfo.failedIterations.includes(this.currentLoopIteration)) {
                this.failedLoopInfo.failedIterations.push(this.currentLoopIteration);
                this.failedLoopInfo.failedIterations.sort((a, b) => a - b);
                this.log.msg('2', `Step ${this.index} failed in iteration ${this.currentLoopIteration} - total failures:`, 'live-step', this.failedLoopInfo.failedIterations);
              }
            }
            
            this.rest_api = steps[this.index].info.rest_api;
            const mobiles_info = JSON.parse(JSON.stringify(steps[this.index].mobiles_info));
            this.updateMobiles.emit({
              feature_run_id:this.feature_result_id,
              mobiles_info: mobiles_info
            });
          }
          this.vulnerable_headers_count = steps[this.index].vulnerable_headers_count;
          this.screenshots = steps[this.index].screenshots;
          if (steps[this.index].error)
            this.error$.next(steps[this.index].error);
          // Update healing data
          if (steps[this.index].healing_data) {
            this.healingData$.next(steps[this.index].healing_data);
          } else if (steps[this.index].info && steps[this.index].info.healing_data) {
            // Check if healing data is nested in info
            this.healingData$.next(steps[this.index].info.healing_data);
          }
          
          // Check if we're inside a loop by looking at previous steps
          this.checkIfInsideLoop(steps);
        } else {
          this.status$.next('waiting');
        }
      });
  }


  resultSteps: StepStatus[] = [];

  getScreenshot = (type: string) => {
    if (this.screenshots && this.screenshots[type]) {
      return this._sanitizer.bypassSecurityTrustStyle(
        `url(/v2/screenshots/${this.screenshots[type]})`
      );
    }
    return '';
  };

  openScreenshot(type: string) {
    this._dialog.open(ScreenshotComponent, {
      data: this.screenshots[type],
      panelClass: 'screenshot-panel',
    });
  }

  openRequest() {
    if (this.rest_api) {
      this._api.getRestAPI(this.rest_api).subscribe(result => {
        this._dialog.open(JsonViewerComponent, {
          data: result,
          width: '100vw',
          maxHeight: '90vh',
          maxWidth: '85vw',
          panelClass: 'rest-api-panel',
        });
      });
    }
  }
  
  getHealingTooltip(healingData: HealeniumData): string {
    return `Self-healed element (${Math.round(healingData.score * 100)}%)
Original: By.${healingData.original_selector.type}(${healingData.original_selector.value})
Healed: By.${healingData.healed_selector.type}(${healingData.healed_selector.value})
Method: Score-based Tree Comparison
Time: +${healingData.healing_duration_ms}ms`;
  }

  // Check if this step is an AI Agent action
  isAIAgentStep(): boolean {
    return this.step?.step_content?.includes('Execute AI agent action') || false;
  }

  // Toggle AI logs visibility
  toggleAILogs(): void {
    this.showAILogs = !this.showAILogs;
  }

  // Format browser-use log messages with bold key patterns
  formatBrowserUseLog(message: string): any {
    // Only format browser-use specific patterns
    const patterns = [
      'Next goal:',
      'Eval:',
      'Verdict:',
      'Task:',
      'Final Result:',
      // Action patterns
      /\[ACTION \d+\/\d+\]/g,
      // Specific action names
      'click_element_by_index:',
      'input_text:',
      'go_to_url:',
      'wait:',
      'done:',
      'scroll:',
      'extract_text:',
      // Action parameters
      'index:',
      'text:',
      'url:',
      'seconds:',
      'new_tab:',
      'clear_existing:',
      'while_holding_ctrl:',
      'success:',
      'files_to_display:'
    ];

    // First escape any HTML to prevent injection
    let formattedMessage = message.replace(/&/g, '&amp;')
                                  .replace(/</g, '&lt;')
                                  .replace(/>/g, '&gt;');

    // Now apply bold formatting
    patterns.forEach(pattern => {
      if (pattern instanceof RegExp) {
        formattedMessage = formattedMessage.replace(pattern, '<b>$&</b>');
      } else {
        // Escape special regex characters in the pattern
        const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        formattedMessage = formattedMessage.replace(new RegExp(escapedPattern, 'g'), `<b>${pattern}</b>`);
      }
    });

    return this._sanitizer.sanitize(1, formattedMessage); // 1 is SecurityContext.HTML
  }

  // Simplified loop detection - just check if this is a loop step
  private checkIfInsideLoop(steps: StepStatus[]): void {
    // Simple check: if this step contains "Loop" in its content, it's a loop step
    this.isLoopStep = this.step?.step_content?.includes('Loop') || false;
  }
  
  // Removed obsolete iteration calculation functions - now handled by parent component
}
