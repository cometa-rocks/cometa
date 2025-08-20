import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  ChangeDetectorRef,
  Host,
  ElementRef,
  NgZone,
  ViewChild,
  ViewChildren,
  QueryList,
  Renderer2,
  Output,
  EventEmitter,
  HostListener,
  ViewContainerRef,
  ComponentFactoryResolver,
  AfterViewChecked
} from '@angular/core';
import {
  CdkDragDrop,
  CdkDropList,
  CdkDrag,
  CdkDragHandle,
} from '@angular/cdk/drag-drop';
import { AddStepComponent } from '@dialogs/add-step/add-step.component';
import { InputFocusService } from '../../services/inputFocus.service';
import {
  MatLegacyDialog as MatDialog,
  MatLegacyDialogRef as MatDialogRef,
} from '@angular/material/legacy-dialog';
import { ApiService } from '@services/api.service';
import { Select, Store } from '@ngxs/store';
import { ActionsState } from '@store/actions.state';
import { ClipboardService } from 'ngx-clipboard';
import { ImportJSONComponent } from '@dialogs/import-json/import-json.component';
import {
  BehaviorSubject,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  Observable,
  of,
  take,
  fromEvent
} from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import {
  UntypedFormArray,
  UntypedFormBuilder,
  Validators,
  ReactiveFormsModule,
  FormGroup,
  FormControl,
} from '@angular/forms';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { UserState } from '@store/user.state';
import { CustomValidators } from '@others/custom-validators';
import { exportToJSONFile, SubSinkAdapter } from 'ngx-amvara-toolbox';
import { EditFeature } from '@dialogs/edit-feature/edit-feature.component';
import {
  MatLegacyAutocompleteSelectedEvent as MatAutocompleteSelectedEvent,
  MatLegacyAutocompleteModule,
} from '@angular/material/legacy-autocomplete';
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';
import {
  MatLegacyCheckboxChange as MatCheckboxChange,
  MatLegacyCheckboxModule,
} from '@angular/material/legacy-checkbox';
import {
  MatLegacyList as MatList,
  MatLegacyListItem as MatListItem,
  MatLegacyListModule,
} from '@angular/material/legacy-list';
import { TranslateModule } from '@ngx-translate/core';
import { CheckDuplicatePipe } from '../../pipes/check-duplicate.pipe';
import { FilterStepPipe } from '@pipes/filter-step.pipe';
import { LetDirective } from '../../directives/ng-let.directive';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatLegacyOptionModule } from '@angular/material/legacy-core';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { NgFor, NgClass, NgIf, NgStyle, AsyncPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ContextMenuModule } from '@perfectmemory/ngx-contextmenu';
import { KEY_CODES } from '@others/enums';
import { LogService } from '@services/log.service';
import { MatAutocompleteActivatedEvent } from '@angular/material/autocomplete';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DepartmentsState } from '@store/departments.state';
import { FeaturesState } from '@store/features.state';
import { SharedActionsService } from '@services/shared-actions.service';
import { MatTooltip } from '@angular/material/tooltip';
import { ApiTestingComponent } from '@components/api-testing/api-testing.component';
import { TruncateApiBodyPipe } from '../../pipes/truncate-api-body.pipe';
import { MatBadgeModule } from '@angular/material/badge';

// Remove any local interface definitions - use global ones from interfaces.d.ts
// The interfaces Department and UploadedFile are already defined globally

interface StepState {
  showLinkIcon: boolean;
  featureId: number | null;
}

@Component({
  selector: 'cometa-step-editor',
  templateUrl: './step-editor.component.html',
  styleUrls: ['./step-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ContextMenuModule,
    MatIconModule,
    CdkDropList,
    NgFor,
    ReactiveFormsModule,
    CdkDrag,
    NgClass,
    CdkDragHandle,
    MatLegacyCheckboxModule,
    MatLegacySelectModule,
    MatLegacyOptionModule,
    TextFieldModule,
    MatLegacyAutocompleteModule,
    NgIf,
    MatLegacyListModule,
    NgStyle,
    MatLegacyTooltipModule,
    MatLegacyButtonModule,
    MatLegacyMenuModule,
    StopPropagationDirective,
    LetDirective,
    AsyncPipe,
    FilterStepPipe,
    CheckDuplicatePipe,
    TranslateModule,
    TruncateApiBodyPipe,
    MatBadgeModule,
  ],
})
export class StepEditorComponentextends SubSinkAdapter implements OnInit, AfterViewChecked {
  stepsForm: UntypedFormArray;

  @ViewSelectSnapshot(ActionsState) actions: Action[];
  @ViewSelectSnapshot(UserState) user!: UserInfo;
  @Output() textareaFocusToParent = new EventEmitter<{isFocused: boolean, event: any}>();

  @Input() feature: Feature;
  @Input() name: string;
  @Input() mode: 'new' | 'edit' | 'clone';
  @Input() variables: VariablePair[];
  @Input() department: Department;
  
  // Track which step is currently focused for the shared autocomplete
  currentFocusedStepIndex: number | null = null;
  
  // Track filtered actions for each step independently
  stepFilteredActions: { [key: number]: Observable<{ name: string; actions: Action[] }[]> } = {};
  
  // Throttle Ctrl+Arrow operations to prevent erratic behavior
  private lastInsertTime: number = 0;
  private readonly INSERT_THROTTLE_MS = 200; // 0.5 seconds

  // Mobile-specific properties
  isMobileDevice: boolean = false;
  isLandscape: boolean = false;
  touchStartY: number = 0;
  touchStartX: number = 0;
  isDragging: boolean = false;

  @ViewChildren(MatListItem, { read: ElementRef })
  varlistItems: QueryList<ElementRef>;
  @ViewChild(MatList, { read: ElementRef }) varlist: ElementRef;
  @ViewChild('variable_name', { read: ElementRef, static: false })
  varname: ElementRef;

  displayedVariables: (VariablePair | string)[] = [];
  stepVariableData = <VariableInsertionData>{};
  snack: any;

  private editingApiCallIndex: number | null = null;

  filteredGroupedActions$ = new BehaviorSubject<{ name: string; actions: Action[] }[]>([]);

  /**
   * Clipboard for storing copied steps.
   */
  clipboardSteps: any[] = [];
  // Track last checked index for multi-selection
  private lastEnableCheckedIndex: number | null = null;
  private lastScreenshotCheckedIndex: number | null = null;
  private lastCompareCheckedIndex: number | null = null;
  private lastSelectCheckedIndex: number | null = null;

  runningMobiles: any[] = []; // Should be Container[], but using any to avoid import issues
  showMobileDropdown: boolean = false;
  mobileDropdownPosition: { top: number; left: number } = { top: 0, left: 0 };
  mobileDropdownStepIndex: number | null = null;
  mobileDropdownReplaceIndex: number | null = null;



  // Holds the pixel width of the quoted content for the mobile dropdown
  mobileDropdownWidth: number = 180;

  // Tracks whether the dropdown is for mobile_name or mobile_code
  mobileDropdownType: 'name' | 'code' | 'package' = 'name';

  // Removed static appActivities list – activities dropdown no longer used

  @ViewChild('dropdownRef') dropdownRef!: ElementRef<HTMLDivElement>;
  @ViewChildren('dropdownOptionRef') dropdownOptionRefs!: QueryList<ElementRef<HTMLLIElement>>;
  dropdownActiveIndex: number = 0;

  constructor(
    private _dialog: MatDialog,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private _store: Store,
    private _clipboard: ClipboardService,
    private _fb: UntypedFormBuilder,
    private _cdr: ChangeDetectorRef,
    private _elementRef: ElementRef<HTMLElement>,
    private _ngZone: NgZone,
    public dialogRef: MatDialogRef<EditFeature>,
    @Host() public readonly _editFeature: EditFeature,
    private renderer: Renderer2,
    private inputFocusService: InputFocusService,
    private loggger: LogService,
    private _sharedActions: SharedActionsService
  ) {
    super();
    this.stepsForm = this._fb.array([]);
  }

  @ViewSelectSnapshot(UserState.RetrieveUserDepartments) 

  // departments$ = this._store.select(UserState.RetrieveUserDepartments);
  departments$!: Department[];
  @Select(DepartmentsState) allDepartments$: Observable<Department[]>;
  @Select(FeaturesState.GetFeaturesAsArray) allFeatures$: Observable<Feature[]>;

  // Add helper to extract description and examples from raw action description or comments
  private parseStepDocumentation(rawDescription: string): { description: string; examples: string } {
    // Handle cases where the description starts with "Exemple:" (misspelled)
    if (rawDescription.toLowerCase().startsWith('exemple:')) {
      const parts = rawDescription.split('\n');
      const firstLine = parts[0];
      const rest = parts.slice(1).join('\n');
      
      // Extract the example from the first line (remove "Exemple: ")
      const example = firstLine.replace(/^exemple:\s*/i, '').trim();
      
      return {
        description: 'Mobile automation step for connecting to a mobile device or emulator.',
        examples: example + (rest ? '\n' + rest : '')
      };
    }
    
    // Handle cases where the description starts with "Example:" (correct spelling)
    if (rawDescription.toLowerCase().startsWith('example:')) {
      const parts = rawDescription.split('\n');
      const firstLine = parts[0];
      const rest = parts.slice(1).join('\n');
      
      // Extract the example from the first line (remove "Example: ")
      const example = firstLine.replace(/^example:\s*/i, '').trim();
      
      return {
        description: 'Mobile automation step for connecting to a mobile device or emulator.',
        examples: example + (rest ? '\n' + rest : '')
      };
    }
    
    // Original logic for standard format
    const descRegex = /#?\s*Description:\s*(.*?)(?:\n|$)/;
    const exampleRegex = /#?\s*Example:\s*([\s\S]*)/;
    const descMatch = rawDescription.match(descRegex);
    const exampleMatch = rawDescription.match(exampleRegex);
    let descriptionText: string;
    if (descMatch) {
      descriptionText = descMatch[1].trim();
    } else if (exampleMatch && typeof exampleMatch.index === 'number') {
      descriptionText = rawDescription.substring(0, exampleMatch.index).trim();
    } else {
      descriptionText = rawDescription.trim();
    }
    let examplesText = '';
    if (exampleMatch) {
      examplesText = exampleMatch[1]
        .split('\n')
        .map(line => line.replace(/^#?\s*/, ''))
        .join('\n')
        .trim();
    }
    return { description: descriptionText, examples: examplesText };
  }

  // ... existing code ...
  sendTextareaFocusToParent(isFocused: boolean, index?: number, showDocumentation: boolean = false): void {
    this.textareaFocusToParent.emit({isFocused, event});



    if (index === undefined) {
      return;
    }

    // Toggle AI guidance overlay visibility only when explicitly requested
    if (isFocused && showDocumentation) {
      // Make the step visible in the UI
      this.stepVisible[index] = true;

      const stepFormGroup = this.stepsForm.at(index) as FormGroup;
      const stepType = stepFormGroup.get('step_type')?.value;
      const stepAction = stepFormGroup.get('step_action')?.value;
      const stepContent = stepFormGroup.get('step_content')?.value;

      if (stepContent === undefined) {
        // Clear description and examples if content is empty
        this.stepsDocumentation[index] = { description: '', examples: '' };
        this._cdr.detectChanges();
        return;
      }

      // Handle mobile step documentation via new endpoint
      if (stepType === 'MOBILE') {
        this._api.getMobileStepDoc(stepAction).subscribe(doc => {
          this.stepsDocumentation[index] = {
            description: doc.description,
            examples: doc.example || ''
          };
          this._cdr.detectChanges();
        });
      } else {
        // Find the corresponding action
        const activatedAction = this.actions.find(action =>
          action.action_name === stepAction
        );
        if (activatedAction) {
          // Clean HTML breaks
          const rawDesc = activatedAction.description.replace(/<br\s*\/?>/gi, '');
          // Parse description and examples
          const { description: descriptionText, examples: examplesText } = this.parseStepDocumentation(rawDesc);
          this.stepsDocumentation[index] = {
            description: descriptionText,
            examples: examplesText
          };
          this._cdr.detectChanges();
        }
      }
    } else if (!isFocused) {
      if (index !== undefined) {
        this.stepVisible[index] = false;
      }
    }
  }
  // ... existing code ...

  setSteps(steps: FeatureStep[], clear: boolean = true) {
    if (clear) this.stepsForm.clear();
    steps.forEach((step, index) => {
      const formGroup = this._fb.group({
        enabled: step.enabled,
        screenshot: step.screenshot,
        step_keyword: step.step_keyword,
        compare: step.screenshot ? step.compare : false,
        step_content: [
          step.step_content,
          CustomValidators.StepAction.bind(this),
        ],
        step_action: step.step_action || '',
        step_type: step.step_type,
        continue_on_failure: step.continue_on_failure,
        timeout: step.timeout || this.department?.settings?.step_timeout || 60,
        selected: false
      });

      this.stepsForm.push(formGroup);

      // Load documentation for the step
      if (step.step_action) {
        const activatedAction = this.actions.find(action =>
          action.action_name === step.step_action
        );

        if (activatedAction) {
          // Clean <br> tags from description
          const cleanDescription = activatedAction.description.replace(/<br\s*\/?>/gi, '');

          // Separate description and examples
          let descriptionText = '';
          let examplesText = '';
          if (cleanDescription.includes("Example")) {
            const parts = cleanDescription.split("Example:");
            descriptionText = parts[0].trim();
            examplesText = parts[1]?.trim() || '';
          } else {
            descriptionText = cleanDescription;
            examplesText = '';
          }

          // Store documentation for this step
          this.stepsDocumentation[index] = {
            description: descriptionText,
            examples: examplesText
          };
        }
      }

      // Process feature links when loading steps
      if (step.step_content?.startsWith('Run feature with id') || step.step_content?.startsWith('Run feature with name')) {
        const match = step.step_content.match(/"([^"]*)"/);
        if (match) {
          const searchValue = match[1];
          if (step.step_content.startsWith('Run feature with id')) {
            const featureId = parseInt(searchValue, 10);
            if (!isNaN(featureId)) {
              this.allFeatures$.pipe(take(1)).subscribe(features => {
                const userDepartments = this.user.departments.map(dept => dept.department_id);
                const feature = features.find(f => 
                  f.feature_id === featureId && 
                  userDepartments.includes(f.department_id)
                );
                if (feature) {
                  this.stepStates[index] = {
                    featureId: featureId,
                    showLinkIcon: true
                  };
                  this._cdr.detectChanges();
                }
              });
            }
          } else {
            this.allFeatures$.pipe(take(1)).subscribe(features => {
              const userDepartments = this.user.departments.map(dept => dept.department_id);
              const matchingFeature = features.find(f => 
                f.feature_name === searchValue && 
                userDepartments.includes(f.department_id)
              );
              if (matchingFeature) {
                this.stepStates[index] = {
                  featureId: matchingFeature.feature_id,
                  showLinkIcon: true
                };
                this._cdr.detectChanges();
              }
            });
          }
        }
      }
    });
    this._cdr.detectChanges();

  }

  getSteps(): FeatureStep[] {
    return this.stepsForm.controls.map(control => control.getRawValue());
  }

  ngOnInit() {
    // @ts-ignore
    if (!this.feature) this.feature = { feature_id: 0 };
    const featureId = this.mode === 'clone' ? 0 : this.feature.feature_id;
    
    // Initialize filteredGroupedActions$ with the grouped actions
    this.filteredGroupedActions$.next(this.getGroupedActions(this.actions));
    
    // Detect Safari and add class to body
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      document.body.classList.add('safari-only');
    }
    
    // Subscribe to steps changes
    this.subs.sink = this._store
      .select(CustomSelectors.GetFeatureSteps(featureId))
      .subscribe(steps => {
        if (steps) {
          // Ensure compare is disabled initially
          const stepsWithCompareDisabled = steps.map(step => ({
            ...step,
            compare: step.screenshot ? step.compare : false // Only allow compare if there is screenshot
          }));
          
          // Set the steps
          this.setSteps(stepsWithCompareDisabled);

          // After setting steps, load documentation for each step
          stepsWithCompareDisabled.forEach((step, index) => {
            if (step.step_action) {
              const activatedAction = this.actions.find(action =>
                action.action_name === step.step_action
              );

              if (activatedAction) {
                // Clean <br> tags from description
                const cleanDescription = activatedAction.description.replace(/<br\s*\/?>/gi, '');

                // Separate description and examples
                let descriptionText = '';
                let examplesText = '';
                if (cleanDescription.includes("Example")) {
                  const parts = cleanDescription.split("Example:");
                  descriptionText = parts[0].trim();
                  examplesText = parts[1]?.trim() || '';
                } else {
                  descriptionText = cleanDescription;
                  examplesText = '';
                }

                // Store documentation for this step
                this.stepsDocumentation[index] = {
                  description: descriptionText,
                  examples: examplesText
                };
              }
            }
          });

          this._cdr.detectChanges();
        }
      });

    // When steps$ is changed do the rollup of duplicated steps
    this.subs.sink = this.stepsForm.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(stepsArray => this.rollupDuplicateSteps(stepsArray));

    // insert default step if currently viewed feature, is new and still not created
    if (this.feature.feature_id === 0) {
      this.insertDefaultStep();
    }

    // Update the disabled state of continue_on_failure checkbox based on department and user settings
    this.updateContinueOnFailureState();
    this.fetchRunningMobiles();
  }

  /**
   * Fetch the list of running mobile containers and store them in runningMobiles.
   * Debug log added to show the result.
   */
  fetchRunningMobiles() {
    this._api.getContainersList().subscribe((containers: any[]) => { // Changed type to any[] to avoid import issues
      this.runningMobiles = containers.filter(c => c.service_status === 'Running');
      // Debug: Log the runningMobiles array

      this._cdr.detectChanges();
    });
  }

  /**
   * Show the mobile dropdown ONLY if the cursor is inside quotes and the quoted text is a valid placeholder.
   * This ensures the dropdown is not shown unless the user clicks exactly inside the quotes.
   * Placeholders allowed: {mobile_name}, {mobile_code}, {app_package}, {app_activity}, or any running mobile image_name.
   */
  onStepTextareaClick(event: MouseEvent, index: number) {
    const textarea = event.target as HTMLTextAreaElement;
    const value = textarea.value;
    // Auto-detect action based on content before the first quote (case-insensitive)
    const prefix = value.split('"')[0].trim().toLowerCase();
    const activatedAction = this.actions.find(action => {
      const actionPrefix = action.action_name.split('"')[0].trim().toLowerCase();
      return actionPrefix === prefix;
    });
    if (activatedAction) {
      const stepFormGroup = this.stepsForm.at(index) as FormGroup;
      stepFormGroup.patchValue({ step_action: activatedAction.action_name });
    }
    let cursorPos = textarea.selectionStart;

    // Reset dropdown state – will reopen only if a valid placeholder is found
    this.showMobileDropdown = false;
    this.mobileDropdownStepIndex = null;
    this.mobileDropdownReplaceIndex = null;

    // Only show dropdown if clicking directly on a placeholder text
    this.checkAndShowMobileDropdown(textarea, index, cursorPos);
  }

  /**
   * Checks if the cursor is on a mobile placeholder and shows dropdown only if clicking on placeholder text
   */
  public checkAndShowMobileDropdown(textarea: HTMLTextAreaElement, index: number, cursorPos: number) {
    const value = textarea.value;
    const stepFormGroup = this.stepsForm.at(index) as FormGroup;
    const stepAction = stepFormGroup.get('step_action')?.value || '';

    // Regex to find all quoted substrings
    const regex = /"([^"]*)"/g;
    let match;
    let found = false;

    // Loop through all quoted substrings to find the one where the cursor is inside
    while ((match = regex.exec(value)) !== null) {
      const start = match.index + 1; // after first quote
      const end = start + match[1].length;
      
      if (cursorPos >= start && cursorPos <= end) {
        // Cursor is inside these quotes
        const insideText = match[1];
        
        // Find all quoted substrings to determine parameter position using exec loop
        const allMatches: Array<{index: number, text: string, start: number, end: number}> = [];
        const quoteRegex = /"([^"]*)"/g;
        let quoteMatch;
        while ((quoteMatch = quoteRegex.exec(value)) !== null) {
          allMatches.push({
            index: quoteMatch.index,
            text: quoteMatch[1],
            start: quoteMatch.index + 1,
            end: quoteMatch.index + 1 + quoteMatch[1].length
          });
        }
        
        let paramIndex = -1;
        for (let mi = 0; mi < allMatches.length; mi++) {
          const m = allMatches[mi];
          if (cursorPos >= m.start && cursorPos <= m.end) {
            paramIndex = mi;
            break;
          }
        }

        // Only show dropdown if the text is exactly a placeholder or if it's an empty quote in a mobile action
        let shouldShowDropdown = false;
        
        // Check if it's exactly a placeholder text
        if (insideText === '{mobile_name}' || insideText === '{mobile_code}' || insideText === '{app_package}') {
          shouldShowDropdown = true;
          // Determine dropdown type based on the placeholder
          if (insideText === '{mobile_code}') {
            this.mobileDropdownType = 'code';
          } else if (insideText === '{app_package}') {
            this.mobileDropdownType = 'package';
          } else if (insideText === '{mobile_name}') {
            this.mobileDropdownType = 'name';
          }
        }
        // Check if it's an existing mobile value (for editing)
        else if (this.runningMobiles.some(m => m.image_name === insideText) ||
                 this.runningMobiles.some(m => m.hostname === insideText) ||
                 this.appPackages.includes(insideText)) {
          shouldShowDropdown = true;
          // Determine dropdown type based on what matches
          const matchingMobile = this.runningMobiles.find(m => m.hostname === insideText);
          if (matchingMobile) {
            this.mobileDropdownType = 'code';
          } else if (this.appPackages.includes(insideText)) {
            this.mobileDropdownType = 'package';
          } else {
            this.mobileDropdownType = 'name';
          }
        }
        // Special case for "On mobile start app" action with empty first parameter
        else if (stepAction && /on mobile start app/i.test(stepAction) && paramIndex === 0 && insideText === '') {
          this.mobileDropdownType = 'package';
          shouldShowDropdown = true;
        }
        
        // Show dropdown if conditions are met
        if (shouldShowDropdown) {
          // Always refresh the list of running mobiles before showing the dropdown
          this.fetchRunningMobiles();

          this.showMobileDropdown = true;
          this.mobileDropdownStepIndex = index;
          this.mobileDropdownReplaceIndex = start - 1; // position of opening quote

          // Always recalculate the dropdown position and width every time it is shown
          setTimeout(() => {
            const coords = this.getCaretCoordinates(textarea, start);
            const dropdownEl = this.dropdownRef.nativeElement as HTMLElement;
            // Add offset: -120px to top, 18px to left for better dropdown positioning
            // This ensures the dropdown appears above and slightly to the right of the quote
            const left = textarea.offsetLeft + coords.left + 18;
            const top = textarea.offsetTop + coords.top + textarea.clientHeight - 120;
            const dropdownWidth = Math.max(this.measureTextWidth(insideText, textarea), 120);
            this.mobileDropdownWidth = dropdownWidth;
            this._cdr.detectChanges();
            dropdownEl.style.left = `${left}px`;
            dropdownEl.style.top = `${top}px`;
            dropdownEl.style.minWidth = `${dropdownWidth}px`;
          }, 0);


          this.dropdownActiveIndex = 0;
          found = true;
          break; // Stop after finding the correct match
        }
      }
    }
    
    // If not found, always hide the dropdown and reset related state
    if (!found) {
      this.showMobileDropdown = false;
      this.mobileDropdownStepIndex = null;
      this.mobileDropdownReplaceIndex = null;

      this._cdr.detectChanges();
    }
  }

  /**
   * Measures the pixel width of a text string using a hidden span with the same font as the textarea.
   */
  measureTextWidth(text: string, textarea: HTMLTextAreaElement): number {
    const span = document.createElement('span');
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre';
    span.style.font = getComputedStyle(textarea).font;
    span.textContent = text || ' '; // fallback to space if empty
    document.body.appendChild(span);
    const width = span.offsetWidth + 32; // add some padding for dropdown arrow
    document.body.removeChild(span);
    return width;
  }

  /**
   * Helper to get the pixel coordinates of a caret position in a textarea.
   * Uses a hidden div to mirror the textarea content and measure the caret.
   */
  getCaretCoordinates(textarea: HTMLTextAreaElement, position: number) {
    // Create a mirror div
    const div = document.createElement('div');
    const style = getComputedStyle(textarea);
    for (const prop of [
      'boxSizing', 'width', 'height', 'overflowX', 'overflowY', 'borderTopWidth',
      'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'paddingTop',
      'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant',
      'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust', 'lineHeight',
      'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'textDecoration',
      'letterSpacing', 'wordSpacing', 'tabSize', 'MozTabSize']) {
      // @ts-ignore
      div.style[prop] = style[prop];
    }
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.top = textarea.offsetTop + 'px';
    div.style.left = textarea.offsetLeft + 'px';
    div.style.zIndex = '10000';
    div.textContent = textarea.value.substring(0, position);
    // Create a span for the caret
    const span = document.createElement('span');
    span.textContent = textarea.value.substring(position) || '.';
    div.appendChild(span);
    document.body.appendChild(div);
    const top = span.offsetTop;
    const left = span.offsetLeft;
    document.body.removeChild(div);
    return { top, left };
  }

  /**
   * When a mobile is selected, replace the quoted string (including quotes) where the cursor was
   * with the new mobile name in quotes. If not found, fallback to replacing the first {mobile_name}.
   */
  selectMobileName(mobileName: string) {
    if (this.mobileDropdownStepIndex === null) return;
    const stepFormGroup = this.stepsForm.at(this.mobileDropdownStepIndex) as FormGroup;
    const contentControl = stepFormGroup.get('step_content');
    const value = contentControl?.value || '';

    // Regex to find the quoted string where the cursor was
    const regex = /"([^"]*)"/g;
    let match;
    let newValue = value;
    let replaced = false;
    // Find the quoted string that contains the cursor
    while ((match = regex.exec(value)) !== null) {
      const start = match.index;
      const end = regex.lastIndex;
      if (
        this.mobileDropdownReplaceIndex !== null &&
        this.mobileDropdownReplaceIndex >= start &&
        this.mobileDropdownReplaceIndex <= end
      ) {
        // Replace the quoted string (including quotes) with the new mobile name in quotes
        newValue = value.substring(0, start) + `"${mobileName}"` + value.substring(end);
        replaced = true;
        break;
      }
    }
    // Fallback: if not found, replace the appropriate placeholder based on dropdown type
    if (!replaced) {
      if (this.mobileDropdownType === 'code') {
        newValue = value.replace('{mobile_code}', mobileName);
      } else if (this.mobileDropdownType === 'package') {
        newValue = value.replace('{app_package}', mobileName);
      } else {
        newValue = value.replace('{mobile_name}', mobileName);
      }
    }
    contentControl?.setValue(newValue);
    this.showMobileDropdown = false;
    this.mobileDropdownStepIndex = null;
    this.mobileDropdownReplaceIndex = null;
    this._cdr.detectChanges();
  }

  /**
   * Handles selection from the <select> dropdown for mobile names.
   */
  onMobileDropdownSelect(mobileName: string) {
    if (mobileName) {
      this.selectMobileName(mobileName);
      // After selection, refocus the textarea and place the cursor inside the next placeholder if present
      setTimeout(() => {
        // Find the current textarea for the step
        const textareas = this._elementRef.nativeElement.querySelectorAll('textarea.code');
        if (this.mobileDropdownStepIndex !== null && textareas[this.mobileDropdownStepIndex]) {
          const textarea = textareas[this.mobileDropdownStepIndex] as HTMLTextAreaElement;
          textarea.focus();
          // Try to place the cursor inside the next quoted placeholder
          const value = textarea.value;
          const regex = /"([^"]*\{(mobile_name|mobile_code|app_package)\}[^"]*)"/g;
          let match;
          let found = false;
          while ((match = regex.exec(value)) !== null) {
            const start = match.index + 1;
            const end = start + match[1].length;
            // If the placeholder is still present, place the cursor inside it
            if (match[1].includes('{mobile_name}') || match[1].includes('{mobile_code}') || match[1].includes('{app_package}')) {
              textarea.setSelectionRange(start, end);
              found = true;
              break;
            }
          }
          // If not found, place the cursor at the end
          if (!found) {
            textarea.setSelectionRange(value.length, value.length);
          }
        }
      }, 0);
    }
  }

  /**
   * Custom function to fix or validate each step
   * every time the user loses focus for the given step
   * @param {FocusEvent} event Event of blur
   * @param {number} index Index of step
   */
  fixStep(event: any, index: number) {
    const actionsToValidate = ['StartBrowser and call URL', 'Goto URL'];
    // Get value from textarea input
    let stepValue: string = event.target.value;
    for (const action of actionsToValidate) {
      // Check if current step is of type URL typing
      if (stepValue.startsWith(action)) {
        // Get URL value
        let url = stepValue.match(/\"(.+)\"/);
        // Regex testing for valid URLs
        // from https://www.regextester.com/104035
        const urlRegex =
          /(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#()?&//=]*)/;
        // Check matching URL and is valid
        if (url && url[1] && urlRegex.test(url[1])) {
          // Add http://
          const urlWithProtocol = this.addhttp(url[1]);
          // Replace URL in step value
          stepValue = stepValue.replace(url[1], urlWithProtocol);
          // Update control value and view
          this.stepsForm.at(index).get('step_content').setValue(stepValue);
          this.stepsForm.updateValueAndValidity();
        }
      }
    }
  }

  // maintains focus on text area while firing events on arrow keys to select variables
  onTextareaArrowKey(event: Event, direction: string, step) {
    event.preventDefault();

    setTimeout(() => {
      const varlistItems = this.varlistItems.toArray();

      for (let i = 0; i < varlistItems.length; i++) {
        if (varlistItems[i].nativeElement.classList.contains('selected')) {
          this.renderer.removeClass(varlistItems[i].nativeElement, 'selected');
          direction === 'down'
            ? this.selectnext(varlistItems, i)
            : this.selectPrevious(varlistItems, i);
          return;
        }
      }
    }, 0);
  }

  // based on currently selected item in flyout, when arrowkey up is pressed, selects previous element if it exists
  // if previous element does not exists, in other words the currently selected item is the first one, then arrow key up will scroll down to last element and select it
  selectPrevious(varlistItems: ElementRef[], i: number) {
    if (varlistItems[i - 1]) {
      this.renderer.addClass(varlistItems[i - 1].nativeElement, 'selected');
      this.varlist.nativeElement.scrollTop = (i - 1) * 30;
    } else {
      this.renderer.addClass(
        varlistItems[varlistItems.length - 1].nativeElement,
        'selected'
      );
      this.varlist.nativeElement.scrollTop = (varlistItems.length - 1) * 30;
    }
  }

  // based on currently selected item in flyout, when arrowkey down is pressed, selects next element if it exists
  // if previous element does not exists, in other words the currently selected item is the last one, then arrow key down will scroll up to first element and select it
  selectnext(varlistItems: ElementRef[], i: number) {
    if (varlistItems[i + 1]) {
      this.renderer.addClass(varlistItems[i + 1].nativeElement, 'selected');
      this.varlist.nativeElement.scrollTop = (i + 1) * 30;
    } else {
      this.renderer.addClass(varlistItems[0].nativeElement, 'selected');
      this.varlist.nativeElement.scrollTop = 0;
    }
  }

  // when escape is clicked, prevent parent dialog from closing and removes variable flyout
  onStepEscape(event: Event) {
    // Autocomplete panels are handled by the global ESC listener, no need to close them here
  }

  onStepFocusOut(event: FocusEvent): void {
    // Use a timeout to allow the textarea's focus event to trigger first
    setTimeout(() => {
      const relatedTarget = event.relatedTarget as HTMLElement;
      const focusedInside = relatedTarget?.closest('.step_content');
      if (!focusedInside) {
        this.editingApiCallIndex = null;
        this._cdr.detectChanges();
      }
    }, 10); // Small enough delay to not be noticeable
  }
  

  onTextareaFocus(event: FocusEvent, index: number): void {
    // Validate index is within bounds
    if (index < 0 || index >= this.stepsForm.length) {
      return;
    }
    
    // Ignore focus events during autocomplete selection to prevent interference
    if (this.isAutocompleteSelectionInProgress) {
      return;
    }
    
    // Set the current focused step index for the shared autocomplete
    this.currentFocusedStepIndex = index;

    
    // Inform parent of focus (without showing documentation)
    this.sendTextareaFocusToParent(true, index, false);
    
    if (this.isApiCallStep(index)) {
      this.editingApiCallIndex = index;
      this._cdr.detectChanges();
    }
    
    // Get step content
    const stepContent = this.stepsForm.at(index)?.get('step_content')?.value || '';
    
    // Reset autocomplete filtering for empty steps to show all actions
    if (!stepContent.trim()) {
      this.filteredGroupedActions$.next(this.getGroupedActions(this.actions));
      return;
    }
    
    // Re-filter action suggestions based on this step's current content
    const contentControl = this.stepsForm.at(index).get('step_content');
    const text = contentControl?.value?.trim() || '';
    if (text) {
      const filtered = this.actions.filter(action =>
        action.action_name.toLowerCase().includes(text.toLowerCase())
      );
      this.filteredGroupedActions$.next(this.getGroupedActions(filtered));
    } else {
      this.filteredGroupedActions$.next(this.getGroupedActions(this.actions));
    }
    
    // Auto-detect action based on content before the first quote (case-insensitive)
    const prefix = text.split('"')[0].trim().toLowerCase();
    const activatedAction = this.actions.find(action => {
      const actionPrefix = action.action_name.split('"')[0].trim().toLowerCase();
      return actionPrefix === prefix;
    });
    if (activatedAction) {
      // Context: immediately after this.stepsForm.at(index).patchValue
      this.stepsForm.at(index).patchValue({
        step_action: activatedAction.action_name
      });
    }

    // Don't automatically show mobile dropdown on focus - only show when user clicks on placeholder text
    this.logger.msg('4', 'Executing _cdr.detectChanges()', 'step-editor');
    this._cdr.detectChanges();
  }

  // removes variable flyout on current step row, when keydown TAB event is fired
  onTextareaTab(event: KeyboardEvent, i: number) {
    if (this.stepVariableData.currentStepIndex === i) {
      this.stepVariableData.currentStepIndex = null;
    }
    
    // Get the current textarea and its content
    const textarea = event.target as HTMLTextAreaElement;
    if (!textarea) return;
    
    const value = textarea.value;
    const cursorPos = textarea.selectionStart;
    
    // Find all quoted substrings to determine if cursor is inside quotes
    const allMatches: Array<{index: number, text: string, start: number, end: number}> = [];
    const quoteRegex = /"([^"]*)"/g;
    let quoteMatch;
    while ((quoteMatch = quoteRegex.exec(value)) !== null) {
      allMatches.push({
        index: quoteMatch.index,
        text: quoteMatch[1],
        start: quoteMatch.index + 1,
        end: quoteMatch.index + 1 + quoteMatch[1].length
      });
    }
    
    // Check if cursor is inside any quoted substring
    let currentQuoteIndex = -1;
    for (let mi = 0; mi < allMatches.length; mi++) {
      const m = allMatches[mi];
      if (cursorPos >= m.start && cursorPos <= m.end) {
        currentQuoteIndex = mi;
        break;
      }
    }
    
    // If cursor is inside quotes, move to the next pair of quotes in a loop
    if (currentQuoteIndex >= 0) {
      let nextQuoteIndex: number;
      // If we're at the last quote, loop back to the first one
      if (currentQuoteIndex >= allMatches.length - 1) {
        nextQuoteIndex = 0;
      } else {
        nextQuoteIndex = currentQuoteIndex + 1;
      }
      
      const nextQuote = allMatches[nextQuoteIndex];
      // Position cursor at the beginning of the next quoted content and select all content inside
      textarea.setSelectionRange(nextQuote.start, nextQuote.end);
      
      // Check if the next quote contains a placeholder and open corresponding dropdown
      // Only show dropdown if the text is exactly a placeholder or if it's an existing mobile value
      if (nextQuote.text === '{mobile_name}' || nextQuote.text === '{mobile_code}' || 
          nextQuote.text === '{app_package}' ||
          this.runningMobiles.some(m => m.image_name === nextQuote.text) ||
          this.runningMobiles.some(m => m.hostname === nextQuote.text) ||
          this.appPackages.includes(nextQuote.text)) {
        
        // Set dropdown type based on placeholder or existing value
        if (nextQuote.text === '{mobile_code}' || this.runningMobiles.some(m => m.hostname === nextQuote.text)) {
          this.mobileDropdownType = 'code';
        } else if (nextQuote.text === '{app_package}' || this.appPackages.includes(nextQuote.text)) {
          this.mobileDropdownType = 'package';
        } else {
          this.mobileDropdownType = 'name';
        }
        
        // Always refresh the list of running mobiles before showing the dropdown
        this.fetchRunningMobiles();
        
        this.showMobileDropdown = true;
        this.mobileDropdownStepIndex = i;
        this.mobileDropdownReplaceIndex = nextQuote.start - 1;
        
        // Position the dropdown with mobile-friendly adjustments
        setTimeout(() => {
          const coords = this.getCaretCoordinates(textarea, nextQuote.start);
          const dropdownEl = this.dropdownRef.nativeElement as HTMLElement;
          const left = textarea.offsetLeft + coords.left + 18;
          const top = textarea.offsetTop + coords.top + textarea.clientHeight - 120;
          const dropdownWidth = Math.max(this.measureTextWidth(nextQuote.text, textarea), 120);
          this.mobileDropdownWidth = dropdownWidth;
          this._cdr.detectChanges();
          dropdownEl.style.left = `${left}px`;
          dropdownEl.style.top = `${top}px`;
          dropdownEl.style.minWidth = `${dropdownWidth}px`;
        }, 0);
        

        this.dropdownActiveIndex = 0;
      }
      
      event.preventDefault(); // Prevent default tab behavior
      return;
    }
    
    // If no more quotes or cursor is not in quotes, allow normal tab behavior
  }

  // inserts variable into step when clicked
  onClickVariable(variable_name: string, index: number) {
    if (!variable_name) return;

    let step = this.stepsForm.at(index).get('step_content');
    step.setValue(
      step.value.substr(0, this.stepVariableData.quoteIndexes.prev) +
        `$${variable_name}` +
        step.value.substr(this.stepVariableData.quoteIndexes.next - 1)
    );

    this.stepVariableData.currentStepIndex = null;
  }

  // defines logic to be executed when user presses enter key
  onTextareaEnter(event: any, index: number) {
    // if user is currently viewing variables in flyout, disable default behavior of textarea to expand height on enter
    if (this.displayedVariables.length > 0) {
      event.preventDefault();
    }
    // get currently displayed variable list
    const varlistItems = this.varlistItems.toArray();

    // gets the dom element of variable that currently contains class selected, and inserts its value into step
    for (let i = 0; i < varlistItems.length; i++) {
      if (varlistItems[i].nativeElement.classList.contains('selected')) {
        const var_name = varlistItems[i].nativeElement.querySelector(
          '.variable-wrapper .var_name'
        );

        if (var_name) {
          this.onClickVariable(var_name.innerText.replace('$', ''), index);
          this.displayedVariables = [];
        }
        return;
      }
    }

    this.displayedVariables = [];
  }


  onStepChange(event, index: number) {
    this.displayedVariables = [];
    this.stepVariableData = {};

    const textarea = event.target as HTMLTextAreaElement;
    this.updateTextareaResize(index); // Update resize state on input
    const textareaValue = textarea.value.trim();

    // Filter actions based on input
    if (textareaValue) {
      const filteredActions = this.actions.filter(action => 
        action.action_name.toLowerCase().includes(textareaValue.toLowerCase())
      );
      this.filteredGroupedActions$.next(this.getGroupedActions(filteredActions));
    } else {
      this.filteredGroupedActions$.next(this.getGroupedActions(this.actions));
    }

    // Extract action name from input and update step_action and documentation
    if (textareaValue) {
      const detectedAction = this.actions.find(a =>
        textareaValue.startsWith(a.action_name)
      );
      if (detectedAction) {
        // Update step_action form control
        this.stepsForm.at(index).get('step_action')?.setValue(detectedAction.action_name);
      } else {
        // Clear if no matching action
        this.stepsForm.at(index).get('step_action')?.setValue('');
      }
    }

    // Check if step starts with "Run feature with id" or "Run feature with name"
    if (textareaValue.startsWith('Run feature with id') || textareaValue.startsWith('Run feature with name')) {
      // Extract content between quotes
      const match = textareaValue.match(/"([^"]*)"/);
      if (match) {
        const searchValue = match[1];
        let featureId: number | null = null;

        if (textareaValue.startsWith('Run feature with id')) {
          // If it's an ID, parse it directly
          featureId = searchValue ? parseInt(searchValue, 10) : null;
        } else {
          // If it's a name, search for the feature by name
          this.allFeatures$.subscribe(features => {
            // Get user's departments
            const userDepartments = this.user.departments.map(dept => dept.department_id);
            // Filter features by name and user's departments
            const matchingFeature = features.find(f => 
              f.feature_name === searchValue && 
              userDepartments.includes(f.department_id)
            );
            
            if (matchingFeature) {
              featureId = matchingFeature.feature_id;
              this.processFeatureLink(textarea, featureId, index, matchingFeature?.feature_name);
            } else {
              this.removeLinkIcon(textarea, index);
            }
          });
        }

        if (featureId && !isNaN(featureId)) {
          // Verify that the feature belongs to one of user's departments
          this.allFeatures$.subscribe(features => {
            const userDepartments = this.user.departments.map(dept => dept.department_id);
            const feature = features.find(f => 
              f.feature_id === featureId && 
              userDepartments.includes(f.department_id)
            );
            if (feature) {
              this.processFeatureLink(textarea, featureId, index, feature?.feature_name);
            } else {
              this.removeLinkIcon(textarea, index);
            }
          });
        } else {
          this.removeLinkIcon(textarea, index);
        }
      } else {
        this.removeLinkIcon(textarea, index);
      }
    } else {
      this.removeLinkIcon(textarea, index);
    }

    // Only update documentation if it's currently visible and the step action has changed
    // This prevents clearing documentation when user modifies content between quotes
    const currentStepAction = this.stepsForm.at(index).get('step_action')?.value;
    const previousStepAction = this.stepsForm.at(index).get('step_action')?.value;
    
    // Only reload documentation if the step action has actually changed
    // or if documentation is visible but not yet loaded
    if (this.stepVisible[index] && (!this.stepsDocumentation[index] || 
        this.stepsDocumentation[index].description === 'No documentation found for this step')) {
      this.loadStepDocumentation(index);
    }
    




    this._cdr.detectChanges();

    // sets the index of currently being edited step row
    this.stepVariableData.currentStepIndex = index;

    // gets cursor position on text area
    this.stepVariableData.selectionIndex = event.target.selectionStart;

    // gets whole textarea value
    this.stepVariableData.stepValue = event.target.value as string;

    // gets the position of nearest left $ and right " chars, taking current cursor position as startpoint index
    this.stepVariableData.quoteIndexes = this.getIndexes(
      this.stepVariableData.stepValue,
      this.stepVariableData.selectionIndex
    );

    // return if left quote or right quote index is undefined
    if (
      !this.stepVariableData.quoteIndexes.next ||
      !this.stepVariableData.quoteIndexes.prev
    )
      return;

    // gets the string between quotes(including quotes)
    this.stepVariableData.strToReplace =
      this.stepVariableData.stepValue.substring(
        this.stepVariableData.quoteIndexes.prev,
        this.stepVariableData.quoteIndexes.next
      );

    // removes quotes
    this.stepVariableData.strWithoutQuotes = this.stepVariableData.strToReplace
      .replace(/"/g, '')
      .trim();

    // if the string without quotes contains dollar char, removes it and then the rest of the string is used to filter variables by name
    if (this.stepVariableData.strWithoutQuotes.includes('$')) {
      // Do not display variables or the dialog if the step is "Run Javascript function"
      if (this.stepVariableData.stepValue.startsWith('Run Javascript function')) {
        this.displayedVariables = [];
        this.stepVariableData.currentStepIndex = null;
        return;
      }

      const filteredVariables = this.variables.filter(item =>
        item.variable_name.includes(
          this.stepVariableData.strWithoutQuotes.replace('$', '')
        )
      );
      this.displayedVariables =
        filteredVariables.length > 0
          ? filteredVariables
          : ['No variable with this name'];

      // when flyout of variables opens up, by default the selected element will be the first one
      setTimeout(() => {
        const firstVariableRef = this.varlistItems.toArray()[0].nativeElement;
        this.renderer.addClass(firstVariableRef, 'selected');
      }, 0);
    }
  }

  private processFeatureLink(textarea: HTMLTextAreaElement, featureId: number, index: number, featureName?: string) {
    this.allFeatures$.subscribe(features => {
      const matchingFeature = features.find(f => f.feature_id === featureId);
      if (matchingFeature) {
        this.stepStates[index] = {
          featureId: featureId,
          showLinkIcon: true
        };
        this._cdr.detectChanges();
      } else {
        this.stepStates[index] = {
          showLinkIcon: false,
          featureId: null
        };
        this._cdr.detectChanges();
      }
    });
  }

  private removeLinkIcon(textarea: HTMLTextAreaElement, index: number) {
    this.stepStates[index] = {
      showLinkIcon: false,
      featureId: null
    };
    this._cdr.detectChanges();
  }

  // returns the index of nearest left $ and nearest right " char in string, taking received startIndex as startpoint reference
  getIndexes(str, startIndex): QuoteIndexes {
    let prevQuoteIndex = getPrev();
    let nextQuoteIndex = getNext();

    // returns the index of the nearest " that is positioned after received index
    function getNext(): number {
      for (let i = startIndex; i < str.length; i++) {
        if (str[i] === '"') return i + 1;
      }
    }

    // returns the index of the nearest $ that is positioned before received index
    function getPrev(): number {
      for (let i = startIndex - 1; i >= 0; i--) {
        if (str[i] === '$') return i;
      }
    }

    return { prev: prevQuoteIndex, next: nextQuoteIndex };
  }

  stepsDocumentation: { description: string, examples: string }[] = [];

  /**
   * Triggered when the user selects a step from the Autocomplete feature
   * @param event MatAutocompleteSelectedEvent
   * @param index Index of the current step
   */
  selectFirstVariable(event: MatAutocompleteSelectedEvent, index: number) {
    // Use the most reliable index - prioritize currentFocusedStepIndex but validate it
    let targetIndex = this.currentFocusedStepIndex ?? index;
    
    // Debug logging

    
    // Validate that the target index is within bounds
    if (targetIndex < 0 || targetIndex >= this.stepsForm.length) {
      targetIndex = index;
    }
    
    // Find the actually focused textarea and use its index
    const textareas = this.stepTextareas?.toArray();
    let actuallyFocusedIndex = -1;
    
    if (textareas) {
      for (let i = 0; i < textareas.length; i++) {
        if (document.activeElement === textareas[i].nativeElement) {
          actuallyFocusedIndex = i;
          break;
        }
      }
    }
    
    // If we found a focused textarea, use its index instead
    if (actuallyFocusedIndex !== -1) {
      
      targetIndex = actuallyFocusedIndex;
    }
    
    // Set a flag to prevent focus events from interfering during autocomplete selection
    this.isAutocompleteSelectionInProgress = true;
    
    // Get the selected value
    const step = event.option.value;
    
    // Update the form control immediately
    const stepFormGroup = this.stepsForm.at(targetIndex) as FormGroup;
    if (!stepFormGroup) {
      console.error('Step form group not found at index:', targetIndex);
      return;
    }
    
    // Set the step content
    stepFormGroup.patchValue({ 
      step_content: step
    });
    
    const matchResult = step.match(/^(.*?)\s*"(.*?)"/);
    if (matchResult) {
      const actionName = matchResult[1].trim();
      const activatedAction = this.actions.find(action =>
        action.action_name.split('"')[0].trim() === actionName
      );
      
      if (activatedAction) {
        stepFormGroup.patchValue({ 
          step_action: activatedAction.action_name
        });
        
        this.selectedActionTitle = activatedAction.action_name;
        this.selectedActionDescription = activatedAction.description.replace(/<br\s*\/?>/gi, '');

        if (this.selectedActionDescription.includes("Example")) {
          const parts = this.selectedActionDescription.split("Example:");
          this.descriptionText = parts[0].trim();
          this.examplesText = parts[1]?.trim() || '';
        } else {
          this.descriptionText = this.selectedActionDescription;
          this.examplesText = '';
        }

        this.stepsDocumentation[targetIndex] = {
          description: this.descriptionText,
          examples: this.examplesText
        };
      }
    }
    
    // Don't automatically show documentation when selecting from autocomplete
    // Documentation will only be shown when explicitly requested via the Actions button
    // this.stepVisible[targetIndex] = true;
    
    // Force change detection
    this._cdr.detectChanges();

    // Select first parameter if exists - do this after change detection
    requestAnimationFrame(() => {
      const parameterRegex = /\{[a-z\d\-_\s]+\}/i;
      const match = parameterRegex.exec(step);
      
      const textareas = this._elementRef.nativeElement.querySelectorAll('textarea.code');
      const targetTextarea = textareas[targetIndex] as HTMLTextAreaElement;
      
      if (targetTextarea && match) {
        targetTextarea.focus();
        targetTextarea.setSelectionRange(match.index, match.index + match[0].length);
      }
      
      // Reset the flag after autocomplete selection is complete
      setTimeout(() => {
        this.isAutocompleteSelectionInProgress = false;
    
      }, 100);
    });
  }


  selectedActionTitle: string = '';
  selectedActionDescription: string = '';
  descriptionText: string = '';
  examplesText: string = '';


  onOptionActivated(event: MatAutocompleteActivatedEvent, index): void {
    if (event && event.option) {
      const activatedActionName = event.option.value;

      const activatedAction = this.actions.find(action => action.action_name === activatedActionName);
      if (activatedAction) {
        // Assign values for the selected action
        this.selectedActionTitle = activatedAction.action_name;
        this.selectedActionDescription = activatedAction.description.replace(/<br\s*\/?>/gi, '');

        // Remove <br> tags from the description
        this.selectedActionDescription = this.selectedActionDescription.replace(/<br\s*\/?>/gi, '');

        // Separate description and examples if necessary
        if (this.selectedActionDescription.includes("Example")) {
          const parts = this.selectedActionDescription.split("Example:");

          // Guardar la descripción y ejemplos por separado
          this.descriptionText = parts[0].trim();
          this.examplesText = parts[1]?.trim() || '';

        } else {
          this.descriptionText = this.selectedActionDescription;
          this.examplesText = '';
        }

        // Here you can add documentation update for this step
        // If you have a `stepsDocumentation` array, you can store it here as well
        this.stepsDocumentation[index] = {
          description: this.descriptionText,
          examples: this.examplesText
        };

        this._cdr.detectChanges();
      }
    }
  }




  toggleStepDocumentation(index: number) {
    this.stepVisible[index] = !this.stepVisible[index];
    
    if (this.stepVisible[index]) {
      // Notify parent to show documentation
      this.sendTextareaFocusToParent(true, index, true);
      
      // Load documentation for this step
      this.loadStepDocumentation(index);
    } else {
      // If hiding documentation, notify parent
      this.sendTextareaFocusToParent(false, index);
    }
    
    this._cdr.detectChanges();
  }

  @ViewChildren(MatAutocompleteTrigger, { read: MatAutocompleteTrigger }) autocompleteTriggers: QueryList<MatAutocompleteTrigger>;

  @HostListener('document:keydown', ['$event'])
  handleGlobalKeyDown(event: KeyboardEvent): void {
    const isEscape = event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27;
    if (!isEscape) {
      return;
    }

    // Attempt to close autocomplete panels
    let panelClosed = false;
    this.autocompleteTriggers?.forEach(trigger => {
      if (trigger.panelOpen) {
        trigger.closePanel();
        panelClosed = true;
      }
    });

    // Close variable fly-out (step list) if it is open
    if (this.displayedVariables.length > 0) {
      this.displayedVariables = [];
      this.stepVariableData.currentStepIndex = null;
      panelClosed = true;
    }

    if (panelClosed) {
      event.stopImmediatePropagation();
      event.preventDefault();
      this.isAutocompleteOpened = false;
      this.displayedVariables = [];
      this.stepVariableData.currentStepIndex = null;
      this._cdr.detectChanges();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateAllTextareasResize();
  }

  iconPosition = { top: 0, left: 0 };

  focusedIndex: number | null = null;
  stepVisible: boolean[] = [];

  closeAutocomplete(index?: number) {
    const actualIndex = index ?? this.currentFocusedStepIndex;
    
    if (actualIndex !== null) {
      const stepFormGroup = this.stepsForm.at(actualIndex) as FormGroup;
      const stepContent = stepFormGroup?.get('step_content')?.value;
      
      if (stepContent == '') {
        this.stepsDocumentation[actualIndex] = {
          description: '',
          examples: ''
        };
      }
      
      this.stepVisible[actualIndex] = false;
    }
    
    this.isAutocompleteOpened = false;
    this._cdr.detectChanges();

  }

  isIconActive: { [key: string]: boolean } = {};

  importClipboardStepDoc(stepsDocumentationExample: string) {
    navigator.clipboard.writeText(stepsDocumentationExample).then(() => {
    this.isIconActive[stepsDocumentationExample] = true;
    this._cdr.detectChanges();
    setTimeout(() => {
      this.isIconActive[stepsDocumentationExample] = false;
      this._cdr.detectChanges();
    }, 400);
    this.snack.open('Text copied to clipboard', 'Close');
    }).catch(err => {
      // Silently handle the error without logging to console
      this.snack.open('Error copying text', 'Close');
    });
  }

  isAutocompleteOpened: boolean = false;
  isAutocompleteSelectionInProgress: boolean = false;

  onAutocompleteOpened(index?: number) {
    const actualIndex = index ?? this.currentFocusedStepIndex;
    if (actualIndex !== null) {
      // Don't automatically show documentation when autocomplete opens
      // Documentation will only be shown when explicitly requested via the Actions button
      // this.stepVisible[actualIndex] = true;
      
      // Reset autocomplete filtering to show all actions for empty steps
      const stepContent = this.stepsForm.at(actualIndex)?.get('step_content')?.value || '';
      if (!stepContent.trim()) {
        this.filteredGroupedActions$.next(this.getGroupedActions(this.actions));
      }
    }
    this.isAutocompleteOpened = true;

    setTimeout(() => {
      this.updateIconPosition();
    });
  }

  updateIconPosition() {
    const overlayElement = document.querySelector('.cdk-overlay-pane');
    if (overlayElement) {
      const rect = overlayElement.getBoundingClientRect();
      this.iconPosition = {
        top: rect.top,
        left: rect.left + rect.width,
      };
    }
  }


  isTransparent: boolean = false;

  toggleVisibility(): void {
    this.isTransparent = !this.isTransparent;
    if(this.isTransparent) {
      this.onAutocompleteOpened()
    }
  }

  // Automatically adds http:// if URL doesn't contain it
  addhttp(url: string) {
    if (!/^(?:f|ht)tps?\:\/\//.test(url)) {
      url = 'http://' + url;
    }
    return url;
  }

  trackStep = index => index;

  realizedRequests = [];
  async rollupDuplicateSteps(stepsArray: FeatureStep[]) {
    // #2430 - Marks steps as disabled if step is found inside an import
    // First get all import IDs
    const importIds: number[] = stepsArray.reduce((r, step) => {
      const matches = step.step_content.match(/Run feature with id "(\d+)"/);
      if (!!matches) r.push(+matches[1]);
      return r;
    }, []);
    if (importIds.length > 0) {
      // Check if we already have the imports info in our cache
      const needsRequest = importIds
        // #3526 ------------------------------------- start
        .map(id => {
          if (!this.realizedRequests.includes(id)) {
            this.realizedRequests.push(id);
            return this._api.getFeatureSteps(id);
          } else {
            return of([]);
          }
          // #3526 ------------------------------------- end
        });
      // Request those we don't have in our cache
      if (needsRequest.length > 0) {
        const featureSteps = await forkJoin([...needsRequest]).toPromise();
        const importsSteps = this.importsSteps$.getValue();
        // Assign results to local variables
        featureSteps.forEach(steps => {
          if (steps.length > 0) {
            steps.forEach(step => {
              if (!importsSteps.includes(step.step_content))
                importsSteps.push(step.step_content);
            });
          }
        });
        this.importsSteps$.next(importsSteps);
      }
    }
  }

  importsSteps$ = new BehaviorSubject<string[]>([]);

  removeAll() {
    this._dialog
      .open(AreYouSureDialog, {
        data: {
          title: 'translate:you_sure.remove_all_title',
          description: 'translate:you_sure.remove_all',
        } as AreYouSureData,
      })
      .afterClosed()
      .subscribe(exit => {
        // Close edit feature popup
        if (exit) {
          this.stepsForm.clear();
          this._cdr.detectChanges();
        }
      });
  }

  add() {
    const dialogRef = this._dialog.open(AddStepComponent, {
      panelClass: 'add-step-panel',
      autoFocus: true,
      disableClose: true,
      data: {
        templates: false,
      },
    });

    dialogRef.afterOpened().subscribe(() => {
      const addStepInstance = dialogRef.componentInstance;
      if (addStepInstance) {
        addStepInstance.textareaFocus.subscribe((isFocused: boolean) => {
          this.inputFocusService.setInputFocus(isFocused);
        });
      }
    });

    dialogRef.afterClosed().subscribe((res: Action) => {
      if (res) {
        this.stepsForm.push(
          this._fb.group({
            enabled: true,
            screenshot: res.screenshot,
            step_keyword: 'Given',
            compare: false,
            step_content: [
              res.interpreted,
              CustomValidators.StepAction.bind(this),
            ],
            step_action: res.action_name || '',
            continue_on_failure: false,
            timeout: this.department.settings?.step_timeout ||
              this._fb.control(
                60,
                Validators.compose([
                  Validators.min(1),
                  Validators.max(7205),
                  Validators.maxLength(4),
                ])
              ),
          })
        );
        this._cdr.detectChanges();
        this.focusStep(this.stepsForm.length - 1);
      }
    });
  }


  /**
   * Closes every assistive panel (autocomplete or variable fly-out) ensuring
   * that only one can be visible at any time – used before inserting / copying
   * steps to avoid multiple overlapping panels.
   */
  private closeAssistPanels(): void {
    // Close the shared autocomplete trigger if it exists
    const trigger = this.autocompleteTriggers?.first;
    if (trigger?.panelOpen) {
      trigger.closePanel();
    }

    // Reset variable fly-out state
    if (this.displayedVariables.length) {
      this.displayedVariables = [];
      this.stepVariableData.currentStepIndex = null;
    }

    // Close mobile dropdown if open
    if (this.showMobileDropdown) {
      this.showMobileDropdown = false;
      this.mobileDropdownStepIndex = null;
      this.mobileDropdownReplaceIndex = null;

    }

    // Reset focused step
    this.currentFocusedStepIndex = null;
    this.isAutocompleteOpened = false;
    this.isAutocompleteSelectionInProgress = false;
    
    // Force change detection
    this._cdr.detectChanges();
  }

  private openAutocompleteForTextarea(textarea: HTMLTextAreaElement, stepIndex: number): void {
    setTimeout(() => {
      // Double-check that the correct textarea is still focused
      const currentFocusedTextarea = document.activeElement as HTMLTextAreaElement;
      if (currentFocusedTextarea === textarea) {
    
        
        // Reset autocomplete filtering to show all actions for new steps
        const stepContent = this.stepsForm.at(stepIndex)?.get('step_content')?.value || '';
        if (!stepContent.trim()) {
          this.filteredGroupedActions$.next(this.getGroupedActions(this.actions));
        }
        
        const trigger = this.autocompleteTriggers?.first;
        if (trigger && !trigger.panelOpen) {
          trigger.openPanel();
        }
      }
    }, 150); // Increased delay to ensure focus is stable
  }

  addEmpty(index: number = -1, openAutocomplete: boolean = false) {

    // Store the original focused step index before inserting
    const originalFocusedIndex = this.currentFocusedStepIndex;
    
    const template = this._fb.group({
      enabled: [true],
      screenshot: [false],
      step_keyword: ['Given'],
      compare: [false],
      step_content: ['', [Validators.required]],
      step_action: [''],
      step_type: [''],
      continue_on_failure: [false],
      timeout: [this.department?.settings?.step_timeout || 60],
      selected: [false]
    });

    if (index >= 0) {
      this.stepsForm.insert(index, template);
    } else {
      this.stepsForm.push(template);
    }

    this._cdr.detectChanges();
    
    const stepIndex = index >= 0 ? index : this.stepsForm.length - 1;

    // Deselect the current step first (simulate manual deselection)
    if (originalFocusedIndex !== null) {
      this.currentFocusedStepIndex = null;
      this._cdr.detectChanges();
    }
    
    // Focus and open autocomplete with proper timing
    setTimeout(() => {
      // Use ViewChildren to get the correct textarea reference
      const textareas = this.stepTextareas?.toArray();
      if (textareas && textareas[stepIndex]) {
        const textarea = textareas[stepIndex].nativeElement as HTMLTextAreaElement;
        if (textarea) {
          // Simulate a click on the textarea to trigger the focus event properly
          // This will call onTextareaFocus which sets currentFocusedStepIndex
          textarea.click();
          
          // Also explicitly focus to ensure autocomplete opens
          textarea.focus();
          
          // Open autocomplete if requested
          if (openAutocomplete) {
            this.openAutocompleteForTextarea(textarea, stepIndex);
          }
        }
      } else {
        // Fallback to DOM query if ViewChildren is not available
        const textareas = this._elementRef.nativeElement.querySelectorAll('textarea.code');
        const textarea = textareas[stepIndex] as HTMLTextAreaElement;
        if (textarea) {
          // Simulate a click on the textarea to trigger the focus event properly
          textarea.click();
          
          // Also explicitly focus to ensure autocomplete opens
          textarea.focus();
          
          // Open autocomplete if requested
          if (openAutocomplete) {
            this.openAutocompleteForTextarea(textarea, stepIndex);
          }
        }
      }
      
      // Force change detection to ensure UI updates
      this._cdr.detectChanges();
    }, 100); // Increased delay to ensure DOM is fully updated
  }

  copyItem(index: number, position: string) {
    // Close assistive panels before duplicating
    this.closeAssistPanels();

    const stepToCopy =
      position === 'up'
        ? this.stepsForm.controls[index]
        : this.stepsForm.controls[index - 1];
    // Recreate step, if process is not done, copied steps would be synced by reference
    const newStepToCopy = this._fb.group({
      compare: stepToCopy.value.screenshot ? stepToCopy.value.compare : false,
      screenshot: stepToCopy.value.screenshot,
      step_keyword: stepToCopy.value.step_keyword,
      step_content: [
        stepToCopy.value.step_content,
        CustomValidators.StepAction.bind(this),
      ],
      step_action: stepToCopy.value.step_action,
      enabled: stepToCopy.value.enabled,
      continue_on_failure: stepToCopy.value.continue_on_failure,
      timeout: stepToCopy.value.timeout,
      selected: false  // Add the selected FormControl, always start as false for new copies
    });

    this.stepsForm.insert(index, newStepToCopy);

    const stepFormGroup = this.stepsForm.at(index) as FormGroup;

    const stepAction = stepFormGroup.get('step_action')?.value;
    const stepContent = stepFormGroup.get('step_content')?.value;

    const activatedAction = this.actions.find(action =>
      action.action_name === stepAction
    );

    if (activatedAction) {
      // Asignar título y descripción de la acción seleccionada
      this.selectedActionTitle = activatedAction.action_name;
      this.selectedActionDescription = activatedAction.description.replace(/<br\s*\/?>/gi, '');

      // Limpiar las etiquetas <br> de la descripción
      this.selectedActionDescription = this.selectedActionDescription.replace(/<br\s*\/?>/gi, '');

      // Separar la descripción y ejemplos si es necesario
      if (this.selectedActionDescription.includes("Example")) {
        const parts = this.selectedActionDescription.split("Example:");
        this.descriptionText = parts[0].trim();
        this.examplesText = parts[1]?.trim() || '';
      } else {
        this.descriptionText = this.selectedActionDescription;
        this.examplesText = '';
      }

      this.stepsDocumentation[index] = {
        description: this.descriptionText,
        examples: this.examplesText
      };
    }
    this._cdr.detectChanges();
    
    // Focus the new step
    this.focusStep(index);
  }

  drop(event: CdkDragDrop<string[]>) {
    const panel = document.querySelector('.stepContainer');
    if (panel) {
      this.renderer.removeChild(document.body, panel);
    }

    const control = this.stepsForm.controls[event.previousIndex];
    const value = control.getRawValue();
    const newFormGroup = this._fb.group({
      enabled: value.enabled,
      screenshot: value.screenshot,
      step_keyword: value.step_keyword,
      compare: value.screenshot ? value.compare : false,
      step_content: [value.step_content, CustomValidators.StepAction.bind(this)],
      step_action: value.step_action || '',
      step_type: value.step_type,
      continue_on_failure: value.continue_on_failure,
      timeout: value.timeout || this.department?.settings?.step_timeout || 60,
      selected: value.selected
    });
    this.stepsForm.removeAt(event.previousIndex);
    this.stepsForm.insert(event.currentIndex, newFormGroup);

    this._cdr.detectChanges();
  }


  deleteStep(i: number) {
    // Check if the step being deleted was selected
    const stepToDelete = this.stepsForm.at(i);
    const wasSelected = stepToDelete?.get('selected')?.value;
    
    // Remove the step
    this.stepsForm.removeAt(i);
    
    // If the deleted step was selected, clear the clipboard
    if (wasSelected) {
      this.clearClipboardIfNoSelectedSteps();
    }
    
    this._cdr.detectChanges();
  }

  /**
   * Clears the clipboard if there are no more selected steps.
   * This ensures the paste option is properly disabled when all selected steps are deleted.
   */
  private clearClipboardIfNoSelectedSteps(): void {
    const hasAnySelectedSteps = this.stepsForm.controls.some(control => 
      control.get('selected')?.value
    );
    
    if (!hasAnySelectedSteps) {
      this.clipboardSteps = [];
    }
  }

  focusStep(childIndex: number) {
    requestAnimationFrame(() => {
      try {
        const stepRow = document.querySelector(
          `.mat-dialog-content .step-row:nth-child(${childIndex + 1})`
        );
        
        if (stepRow) {
          stepRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
          
          const input = stepRow.querySelector('.code') as HTMLInputElement;
          if (input) {
            input.focus();
            // Simulate a click to trigger onStepTextareaClick logic (e.g., mobile dropdown position)
            input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          }
        }
      } catch (err) {
        // Silently handle any errors
      }
    });
  }

  scrollStepsToBottom(focusLastStep: boolean = false) {
    setTimeout(_ => {
      try {
        document
          .querySelector(`.mat-dialog-content .step-row:last-child`)
          .scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => {
          if (focusLastStep) {
            (
              document.querySelector(
                `.mat-dialog-content .step-row:last-child .code`
              ) as HTMLInputElement
            ).focus();
          }
        }, 500);
      } catch (err) {}
    }, 0);
  }

  exportClipboard() {
    if (this._clipboard.copyFromContent(JSON.stringify(this.getSteps()))) {
      this._snackBar.open('Steps copied to clipboard!', 'OK');
    } else {
      this._snackBar.open('Error copying to clipboard.', 'OK');
    }
  }

  export() {
    const steps = this.getSteps();
    if (steps.length > 0) {
      exportToJSONFile(
        this.feature.feature_name || this.name || 'Unnamed',
        this.getSteps()
      );
    } else {
      this._snackBar.open('There are no steps to export', 'OK');
    }
  }

  readJson(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (result: any) => {
      let stepsA: any[];
      try {
        stepsA = JSON.parse(result.target.result);
      } catch (err) {
        this._snackBar.open('Invalid JSON syntax', 'OK');
        return;
      }
      if (Array.isArray(stepsA)) {
        const length = stepsA.length;
        for (let i = 0; i < length; i++) {
          if (!stepsA[i].hasOwnProperty('step_content')) {
            this._snackBar.open('Invalid data properties', 'OK');
            return;
          }
        }
        this.setSteps(stepsA, false);
        (
          document.getElementsByClassName('upload_json')[0] as HTMLInputElement
        ).value = '';
        this._snackBar.open('Successfully imported steps!', 'OK');
      } else {
        this._snackBar.open('Invalid data', 'OK');
        return;
      }
    };
    reader.readAsText(file);
  }

  importClipboard() {
    this.sendTextareaFocusToParent(true);
    const ref = this._dialog.open(ImportJSONComponent);
    ref.afterClosed().subscribe(success => {
      this.sendTextareaFocusToParent(false);
      if (success) {
        let stepsA: any[];
        try {
          stepsA = JSON.parse(ref.componentInstance.json);
        } catch (err) {
          this._snackBar.open('Invalid JSON syntax', 'OK');
          return;
        }
        if (Array.isArray(stepsA)) {
          const length = stepsA.length;
          for (let i = 0; i < length; i++) {
            if (!stepsA[i].hasOwnProperty('step_content')) {
              this._snackBar.open('Invalid data properties', 'OK');
              return;
            }
          }
          this.setSteps(stepsA, false);
          (
            document.getElementsByClassName(
              'upload_json'
            )[0] as HTMLInputElement
          ).value = '';
          this._snackBar.open('Successfully imported steps!', 'OK');
          this.scrollStepsToBottom();
        } else {
          this._snackBar.open('Invalid data', 'OK');
          return;
        }
      }
    });
  }

  screenshotChange(event: MatCheckboxChange, i: number) {
    const stepFormGroup = this.stepsForm.at(i) as FormGroup;
    const compareControl = stepFormGroup.get('compare');
    
    if (!event.checked) {
      // If screenshot is unchecked, disable compare and set it to false
      compareControl?.setValue(false);

    } else {
      // If screenshot is checked, enable compare but keep its current value
      compareControl?.enable();
    }
    
    this._cdr.detectChanges();
  }

  insertDefaultStep() {
    const defaultStep = this._fb.group({
      enabled: [true],
      screenshot: [false],
      step_keyword: ['Given'],
      compare: [false],
      step_content: [
        'StartBrowser and call URL "{url}"',
        CustomValidators.StepAction.bind(this),
      ],
      step_action: [''],
      continue_on_failure: [false],
      timeout: [this.department?.settings?.step_timeout || 60],
      selected: [false]
    });


    this.stepsForm.push(defaultStep);
  }

  insertStep(event: KeyboardEvent, i: number){
    event.preventDefault();
    event.stopPropagation();
    
    // Throttle to prevent erratic behavior when holding keys
    const currentTime = Date.now();
    if (currentTime - this.lastInsertTime < this.INSERT_THROTTLE_MS) {
      return; // Ignore if called too quickly
    }
    this.lastInsertTime = currentTime;
    
    // Blur current textarea and close any open autocomplete panel before inserting
    const activeEl = document.activeElement as HTMLElement;
    if (activeEl && typeof activeEl.blur === 'function') {
      activeEl.blur();
    }
    this.autocompleteTriggers?.forEach(t => { if (t.panelOpen) t.closePanel(); });
    
    // Close any other assistive panels before inserting
    this.closeAssistPanels();
    
    // Store current step content to prevent modification
    const currentStepContent = this.stepsForm.at(i)?.get('step_content')?.value || '';
    
    if(event.key == 'ArrowDown'){
        this.addEmpty(i+1, true); 
        this.focusStep(i+1);
    }
    else if (event.key == 'ArrowUp'){
        this.addEmpty(i, true); 
        this.focusStep(i);
    }
    
    // If we inserted below (ArrowDown), the original content might be overridden; restore it.
    if (event.key === 'ArrowDown') {
      setTimeout(() => {
        if (this.stepsForm.at(i) && this.stepsForm.at(i).get('step_content')?.value !== currentStepContent) {
          this.stepsForm.at(i).get('step_content')?.setValue(currentStepContent);
        }
      }, 150);
    }
  }

  copyStep(event: KeyboardEvent, i: number){
    event.preventDefault();
    event.stopPropagation();
    
    // Throttle to prevent erratic behavior when holding keys
    const currentTime = Date.now();
    if (currentTime - this.lastInsertTime < this.INSERT_THROTTLE_MS) {
      return; // Ignore if called too quickly
    }
    this.lastInsertTime = currentTime;
    
    // Close any open autocomplete properly without removing from DOM
    this.closeAssistPanels();
    
    if(event.key == 'ArrowDown'){
        this.copyItem(i+1, 'down');
    }
    else if (event.key == 'ArrowUp'){
        this.copyItem(i, 'up');
    }
  }

  showLinkIcon: boolean = false;
  featureId: number | null = null;

  navigateToFeature(featureId: number) {
    if (featureId) {
      this._sharedActions.goToFeature(featureId, true);
    }
  }

  stepStates: { [key: number]: StepState } = {};
  isApiCallStep(index: number): boolean {
    const content = this.stepsForm.controls[index]?.get('step_content')?.value;
    return content?.includes('Make an API call');
  }

  isEditingApiCall(index: number): boolean {
    return this.editingApiCallIndex === index;
  }

  expandApiCall(index: number): void {
    this.editingApiCallIndex = index;
    this._cdr.detectChanges();
  }

  getCollapsedApiCall(index: number): string {
    const content = this.stepsForm.controls[index]?.get('step_content')?.value;
    if (!content) return '';
    return content;
  }

  editApiCall(item: any) {
    if (!this.isApiCallStep(item)) {
      return;
    }
    
    // Get step content
    const stepContent = this.stepsForm.controls[item].get('step_content').value;
    
    // Open dialog
    // const dialogRef = this._dialog.open(ApiTestingComponent, {
    //   data: { stepContent },
    //   width: '1400px',
    //   height: '850px',
    //   maxHeight: '90vh',
    //   panelClass: 'api-testing-dialog'
    // });
   const dialogRef = this._dialog.open(ApiTestingComponent, {
      data: { stepContent },
      panelClass: 'api-testing-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Update the step content with the new API call data
        this.stepsForm.controls[item].get('step_content').setValue(result);
        this._cdr.detectChanges();
      }
    });
  }

  // Select All methods
  selectAllEnable(event: MatCheckboxChange) {
    const checked = event.checked;
    this.stepsForm.controls.forEach(control => {
      control.get('enabled')?.setValue(checked);
    });
    this._cdr.detectChanges();
  }

  selectAllScreenshot(event: MatCheckboxChange) {
    const checked = event.checked;
    this.stepsForm.controls.forEach(control => {
      control.get('screenshot')?.setValue(checked);
      if (!checked) {
        // If screenshot is unchecked, disable compare and set it to false
        control.get('compare')?.setValue(false);
      }
    });
    this._cdr.detectChanges();
  }

  selectAllCompare(event: MatCheckboxChange) {
    const checked = event.checked;
    this.stepsForm.controls.forEach(control => {
      control.get('compare')?.setValue(checked);
      if (checked) {
        // If compare is checked, ensure screenshot is also checked
        control.get('screenshot')?.setValue(true);
      }
    });
    this._cdr.detectChanges();
  }

  // Check if all items are selected
  isAllEnabled(): boolean {
    return this.stepsForm.controls.every(control => control.get('enabled')?.value);
  }

  isAllScreenshot(): boolean {
    return this.stepsForm.controls.every(control => control.get('screenshot')?.value);
  }

  isAllCompare(): boolean {
    const totalSteps = this.stepsForm.controls.length;
    const stepsWithScreenshot = this.stepsForm.controls.filter(control => control.get('screenshot')?.value);
    const stepsWithCompare = this.stepsForm.controls.filter(control => control.get('compare')?.value === true);

    // If there are no steps with screenshot, return false
    if (stepsWithScreenshot.length === 0) return false;
    
    // The "Select All" checkbox is marked as true only if the number of steps with compare is equal to the total number of steps
    return stepsWithCompare.length === totalSteps;
  }

  getGroupedActions(actions: Action[]): { name: string; actions: Action[] }[] {
    const groups = {
      'Browser Steps': [] as Action[],
      'Mobile Steps': [] as Action[],
      'API Steps': [] as Action[],
      'Database Steps': [] as Action[],
      'Other Steps': [] as Action[]
    };

    actions.forEach(action => {
      const stepType = action.step_type?.toUpperCase() || '';
      switch (stepType) {
        case 'BROWSER':
          groups['Browser Steps'].push(action);
          break;
        case 'MOBILE':
          groups['Mobile Steps'].push(action);
          break;
        case 'API':
          groups['API Steps'].push(action);
          break;
        case 'DATABASE':
          groups['Database Steps'].push(action);
          break;
        default:
          groups['Other Steps'].push(action);
      }
    });

    // Return only non-empty groups
    return Object.entries(groups)
      .filter(([_, actions]) => actions.length > 0)
      .map(([name, actions]) => ({ name, actions }));
  }

  onCompareChange(event: MatCheckboxChange, i: number) {
    const stepFormGroup = this.stepsForm.at(i) as FormGroup;
    if (event.checked) {
      // If the user marks compare, also mark screenshot        
      stepFormGroup.get('screenshot')?.setValue(true);
    }
    // We don't unmark screenshot if compare is unchecked, only activate it when marking compare
    this._cdr.detectChanges();
  }

  @ViewChildren('stepTextarea') stepTextareas!: QueryList<ElementRef<HTMLTextAreaElement>>;

  ngAfterViewInit() {
    
    // When the view is ready, update all textareas to set their initial resize state.
    this.updateAllTextareasResize();

    // Subscribe to changes in the list of textareas (e.g., when steps are added/removed)
    // and update their state accordingly.
    this.subs.sink = this.stepTextareas.changes.subscribe(() => {
        this.updateAllTextareasResize();
    });
    
    // Also subscribe to autocomplete triggers changes
    if (this.autocompleteTriggers) {
      this.subs.sink = this.autocompleteTriggers.changes.subscribe(() => {
        this.autocompleteTriggers.forEach((trigger, idx) => {
          const triggerEl = (trigger as any)._element?.nativeElement;
        });
      });
    }
  }


  /**
   * Iterates through all step textareas and updates their resize state.
   * Uses a timeout to ensure the DOM is stable before measuring.
   */
  private updateAllTextareasResize(): void {
    setTimeout(() => {
      this.stepsForm.controls.forEach((_, index) => {
        this.updateTextareaResize(index);
      });
    }, 0);
  }

  /**
   * Checks a specific textarea's content and adds or removes the 'allow-resize'
   * class to enable or disable the vertical resize handle.
   * @param index The index of the step to update.
   */
  private updateTextareaResize(index: number): void {
    const textareaRef = this.stepTextareas?.toArray()[index];
    if (!textareaRef) return;

    const textarea = textareaRef.nativeElement;
    const value = this.stepsForm.at(index)?.get('step_content')?.value || '';
    
    // To get an accurate measurement, we first reset the state.
    this.renderer.removeClass(textarea, 'allow-resize');

    // Enable resize if there's an explicit newline or if the content visually wraps.
    const hasExplicitNewline = value.includes('\n');
    const isVisuallyWrapped = textarea.scrollHeight > textarea.clientHeight;

    if (hasExplicitNewline || isVisuallyWrapped) {
      this.renderer.addClass(textarea, 'allow-resize');
    }
  }

  /**
   * Automatically grows the textarea height to fit its content.
   * @param event The input event from the textarea.
   */
  autoGrowTextarea(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  /**
   * Toggle selection of all steps.
   */
  toggleSelectAllSteps(event: MatCheckboxChange) {
    const checked = event.checked;
    this.stepsForm.controls.forEach(control => {
      control.get('selected')?.setValue(checked);
    });
    
    // Automatically copy selected steps when select all changes
    setTimeout(() => {
      this.copySelectedSteps();
    }, 0);
    
    this._cdr.detectChanges();
  }

  /**
   * Returns true if all steps are selected.
   */
  areAllStepsSelected(): boolean {
    return this.stepsForm.controls.length > 0 && 
           this.stepsForm.controls.every(control => control.get('selected')?.value);
  }

  /**
   * Returns true if some (but not all) steps are selected.
   */
  areSomeStepsSelected(): boolean {
    const selectedCount = this.stepsForm.controls.filter(control => control.get('selected')?.value).length;
    return selectedCount > 0 && selectedCount < this.stepsForm.controls.length;
  }

  /**
   * Returns true if there is at least one selected step.
   */
  hasSelectedSteps(): boolean {
    return this.stepsForm.controls.some(control => control.get('selected')?.value);
  }

  /**
   * Toggle all step documentation visibility
   */
  toggleAllDocumentation() {
    const shouldShow = !this.areAllDocumentationVisible();

    this.stepsForm.controls.forEach((_, index) => {
      const visible = this.stepVisible[index];
      if (shouldShow && !visible) {
        // Load documentation for all steps when showing all
        this.loadStepDocumentation(index);
        this.stepVisible[index] = true;
      } else if (!shouldShow && visible) {
        this.stepVisible[index] = false;
      }
    });

    this._cdr.detectChanges();
  }

  /**
   * Extracts the original action name from a step content (ignoring modifications inside quotes)
   */
  private extractOriginalActionName(stepContent: string): string {
    const text = stepContent.trim();
    if (!text) return '';
    
    // Split by quotes and take the first part (before first quote)
    const parts = text.split('"');
    const actionPart = parts[0].trim();
    

    
    return actionPart;
  }

  /**
   * Detects if a step is a mobile step based on its content
   */
  private isMobileStep(stepContent: string): boolean {
    const text = stepContent.toLowerCase();
    // Check for mobile-related keywords and patterns
    const mobilePatterns = [
      'mobile',
      'android',
      'ios',
      'app',
      'device',
      'capabilities',
      'start app',
      'connect to mobile',
      'start mobile'
    ];
    
    return mobilePatterns.some(pattern => text.includes(pattern));
  }

  /**
   * Generates documentation for mobile actions based on their action name
   */
  private generateMobileDocumentation(actionName: string): { description: string; examples: string } {
    const actionNameLower = actionName.toLowerCase();
    
    // Start mobile emulator
    if (actionNameLower.includes('start mobile') && actionNameLower.includes('capabilities')) {
      return {
        description: 'Starts a mobile emulator with specified capabilities and references it to a variable for use in mobile automation tests.',
        examples: 'Start mobile "Android_13.0_API33_x86_64" use capabilities """{"platformName": "Android", "app": "/path/to/app.apk"}""" reference to "myMobile"'
      };
    }
    
    // Connect to mobile
    if (actionNameLower.includes('connect to mobile') && actionNameLower.includes('capabilities')) {
      return {
        description: 'Connects to an existing mobile device or emulator using specified capabilities and references it to a variable.',
        examples: 'Connect to mobile "6c7f06630a88" use capabilities """{"platformName": "Android"}""" reference to "myMobile"'
      };
    }
    
    // Start mobile app
    if (actionNameLower.includes('on mobile start app')) {
      return {
        description: 'Launches a specific mobile application using its package name and activity name on the connected mobile device.',
        examples: 'On mobile start app "com.example.app" "com.example.app.MainActivity"'
      };
    }
    
    // Install app
    if (actionNameLower.includes('install app')) {
      return {
        description: 'Installs an APK file on the connected mobile device for testing purposes.',
        examples: 'Install app "new_app.apk" on mobile'
      };
    }
    
    // Tap on element
    if (actionNameLower.includes('on mobile tap on')) {
      return {
        description: 'Taps on a specific element in the mobile application using the provided selector.',
        examples: 'On mobile tap on "~Login Button"'
      };
    }
    
    // Long press
    if (actionNameLower.includes('on mobile long press')) {
      return {
        description: 'Performs a long press gesture on a specific element in the mobile application.',
        examples: 'On mobile long press "~Menu Button"'
      };
    }
    
    // Double tap
    if (actionNameLower.includes('on mobile double tap on')) {
      return {
        description: 'Performs a double tap gesture on a specific element in the mobile application.',
        examples: 'On mobile double tap on "~Image"'
      };
    }
    
    // Swipe actions
    if (actionNameLower.includes('on mobile swipe')) {
      if (actionNameLower.includes('right')) {
        return {
          description: 'Performs a swipe gesture to the right on the mobile screen.',
          examples: 'On mobile swipe right'
        };
      } else if (actionNameLower.includes('left')) {
        return {
          description: 'Performs a swipe gesture to the left on the mobile screen.',
          examples: 'On mobile swipe left'
        };
      } else if (actionNameLower.includes('up')) {
        return {
          description: 'Performs a swipe gesture upward on the mobile screen.',
          examples: 'On mobile swipe up'
        };
      } else if (actionNameLower.includes('down')) {
        return {
          description: 'Performs a swipe gesture downward on the mobile screen.',
          examples: 'On mobile swipe down'
        };
      } else if (actionNameLower.includes('from coordinate')) {
        return {
          description: 'Performs a swipe gesture from one coordinate to another on the mobile screen.',
          examples: 'On mobile swipe from coordinate "100,200" to "300,400"'
        };
      }
    }
    
    // Set value
    if (actionNameLower.includes('on mobile set value')) {
      return {
        description: 'Sets a value in a text input field on the mobile application.',
        examples: 'On mobile set value "test@example.com" in "~Email Input"'
      };
    }
    
    // Clear textbox
    if (actionNameLower.includes('on mobile clear textbox')) {
      return {
        description: 'Clears the content of a text input field on the mobile application.',
        examples: 'On mobile clear textbox "~Search Input"'
      };
    }
    
    // Assert actions
    if (actionNameLower.includes('on mobile assert if')) {
      if (actionNameLower.includes('screen contains')) {
        return {
          description: 'Asserts that the mobile screen contains specific text or elements.',
          examples: 'On mobile assert if screen contains "Welcome"'
        };
      } else {
        return {
          description: 'Asserts a condition on a specific element in the mobile application.',
          examples: 'On mobile assert if "~Button" is enabled'
        };
      }
    }
    
    // Switch to frame
    if (actionNameLower.includes('on mobile switch to frame')) {
      return {
        description: 'Switches the context to an iframe within the mobile application.',
        examples: 'On mobile switch to frame with id "webview"'
      };
    }
    
    // Default fallback for unknown mobile actions
    return {
      description: `Mobile automation action: ${actionName}`,
      examples: 'This is a mobile automation step for testing mobile applications'
    };
  }

  /**
   * Loads documentation for a specific step index
   * Always shows documentation for the original step (without modifications inside quotes)
   */
  private loadStepDocumentation(index: number) {
    const stepContent = this.stepsForm.at(index)?.get('step_content')?.value || '';
    const stepType = this.stepsForm.at(index)?.get('step_type')?.value;
    
    // Detect if it's a mobile step based on content if stepType is not set correctly
    const isMobile = stepType === 'MOBILE' || this.isMobileStep(stepContent);
    
    if (isMobile) {
      // Extract action name from step content for mobile steps (original without quote modifications)
      const text = stepContent.trim();
      if (text) {
        // Get the part before the first quote (action name)
        const prefix = text.split('"')[0].trim().toLowerCase();
        
        // Try to find the action by matching the prefix
        let activatedAction = this.actions.find(action => {
          const actionPrefix = action.action_name.split('"')[0].trim().toLowerCase();
          return actionPrefix === prefix;
        });
        
        // If not found by exact prefix match, try a more flexible search
        if (!activatedAction) {
          activatedAction = this.actions.find(action => {
            // Check if the action name contains the prefix or vice versa
            const actionName = action.action_name.toLowerCase();
            const actionPrefix = actionName.split('"')[0].trim();
            return actionPrefix === prefix || actionName.includes(prefix) || prefix.includes(actionPrefix);
          });
        }
        
        // If still not found, try searching in the full action name
        if (!activatedAction) {
          activatedAction = this.actions.find(action => {
            const actionName = action.action_name.toLowerCase();
            return actionName.includes(prefix);
          });
        }
        
        if (activatedAction) {
          // Use fallback directly since the API doesn't exist
          if (activatedAction.description && activatedAction.description.trim()) {
            const rawDesc = activatedAction.description.replace(/<br\s*\/?>/gi, '');
            const { description: descriptionText, examples: examplesText } = this.parseStepDocumentation(rawDesc);
            
            this.stepsDocumentation[index] = {
              description: descriptionText || 'Documentation loaded from action description',
              examples: examplesText || 'Examples loaded from action description'
            };
          } else {
            // Generate documentation based on action name for mobile steps
            const { description: descriptionText, examples: examplesText } = this.generateMobileDocumentation(activatedAction.action_name);
            this.stepsDocumentation[index] = {
              description: descriptionText,
              examples: examplesText
            };
          }
          this._cdr.detectChanges();
        } else {
          this.stepsDocumentation[index] = {
            description: 'No documentation found for this step',
            examples: 'No examples available'
          };
        }
      } else {
        this.stepsDocumentation[index] = {
          description: 'Enter a step to see documentation',
          examples: 'Examples will appear here when you enter a valid step'
        };
      }
    } else {
      // For non-mobile steps, extract documentation using parseStepDocumentation
      if (stepContent.trim()) {
        // Find action by matching the original step structure (before quote modifications)
        let action = this.actions.find(a => {
          // Check if the step content contains the action name (original structure)
          return stepContent.toLowerCase().includes(a.action_name.toLowerCase());
        });
        
        // If not found, try more flexible matching for browser/URL actions
        if (!action) {
          const stepLower = stepContent.toLowerCase();
          action = this.actions.find(a => {
            const actionLower = a.action_name.toLowerCase();
            // Check for browser-related keywords
            return (stepLower.includes('startbrowser') && actionLower.includes('startbrowser')) ||
                   (stepLower.includes('url') && actionLower.includes('url')) ||
                   (stepLower.includes('browser') && actionLower.includes('browser'));
          });
        }
        
        if (action) {
          // Clean HTML breaks and parse documentation
          const rawDesc = action.description.replace(/<br\s*\/?>/gi, '');
          const { description: descriptionText, examples: examplesText } = this.parseStepDocumentation(rawDesc);
          this.stepsDocumentation[index] = {
            description: descriptionText || 'No documentation found for this step',
            examples: examplesText || 'No examples available'
          };
        } else {

          
          this.stepsDocumentation[index] = {
            description: 'No documentation found for this step',
            examples: 'No examples available'
          };
        }
      } else {
        // If step is empty, show placeholder documentation
        this.stepsDocumentation[index] = {
          description: 'Enter a step to see documentation',
          examples: 'Examples will appear here when you enter a valid step'
        };
      }
    }
  }

  /**
   * Returns true if all documentation is visible
   */
  areAllDocumentationVisible(): boolean {
    return this.stepsForm.controls.length > 0 && 
           this.stepsForm.controls.every((_, index) => this.stepVisible[index]);
  }

  /**
   * Returns the number of selected steps.
   */
  getSelectedStepsCount(): number {
    return this.stepsForm.controls.filter(control => control.get('selected')?.value).length;
  }

  /**
   * Copies the selected steps to the clipboardSteps array.
   */
  copySelectedSteps() {
    this.clipboardSteps = this.stepsForm.controls
      .map((control, idx) => control.get('selected')?.value ? control.getRawValue() : null)
      .filter(step => step !== null);
  }

  /**
   * Returns true if there are steps in the clipboard to paste.
   */
  canPasteSteps(): boolean {
    return this.clipboardSteps && this.clipboardSteps.length > 0;
  }

  /**
   * Pastes the steps from clipboardSteps after the last selected step, or at the end if none selected.
   */
  pasteSteps(insertAtIndex?: number) {
    let insertIndex: number;
    
    if (insertAtIndex !== undefined) {
      // If called from context menu, insert at the specified index
      insertIndex = insertAtIndex + 1;
    } else {
      // Original behavior: find the last selected index, or -1 if none
      let lastSelectedIndex = -1;
      this.stepsForm.controls.forEach((control, index) => {
        if (control.get('selected')?.value) {
          lastSelectedIndex = index;
        }
      });
      insertIndex = lastSelectedIndex >= 0 ? lastSelectedIndex + 1 : this.stepsForm.length;
    }
    
    // Insert each step from clipboardSteps
    this.clipboardSteps.forEach((step, i) => {
      const formGroup = this._fb.group({
        enabled: step.enabled,
        screenshot: step.screenshot,
        step_keyword: step.step_keyword,
        compare: step.screenshot ? step.compare : false,
        step_content: [step.step_content, CustomValidators.StepAction.bind(this)],
        step_action: step.step_action || '',
        step_type: step.step_type,
        continue_on_failure: step.continue_on_failure,
        timeout: step.timeout || this.department?.settings?.step_timeout || 60,
        selected: false  // Add the selected FormControl, pasted steps start unselected
      });
      this.stepsForm.insert(insertIndex + i, formGroup);
    });
    // Clear clipboard after pasting
    this.clipboardSteps = [];
    // Clear selection
    this.stepsForm.controls.forEach(control => {
      control.get('selected')?.setValue(false);
    });
    this._cdr.detectChanges();
  }

  /**
   * Automatically copies selected steps when selection changes.
   */
  onSelectStepChange(event: MatCheckboxChange, index: number) {
    // Automatically copy selected steps whenever selection changes
    setTimeout(() => {
      this.copySelectedSteps();
    }, 0);
  }

  /**
   * Handles click on Select checkbox, supporting shift+click multi-selection.
   * @param event MouseEvent
   * @param index Index of the clicked checkbox
   */
  onSelectCheckboxClick(event: MouseEvent, index: number) {
    if (event.shiftKey && this.lastSelectCheckedIndex !== null) {
      // Always set checked to true for shift+click multi-select
      const checked = true;
      const [start, end] = [this.lastSelectCheckedIndex, index].sort((a, b) => a - b);
      for (let i = start; i <= end; i++) {
        this.stepsForm.at(i).get('selected')?.setValue(checked);
      }
      event.preventDefault(); // Prevent default click behavior
      
      // Update clipboard after multi-selection
      setTimeout(() => {
        this.copySelectedSteps();
        this._cdr.detectChanges(); // Force UI update to reflect Select All checkbox state
      }, 0);
    }
    this.lastSelectCheckedIndex = index;
  }

  /**
   * Deletes the selected steps after confirmation.
   */
  deleteSelectedSteps() {
    const selectedCount = this.stepsForm.controls.filter(control => control.get('selected')?.value).length;
    
    this._dialog
      .open(AreYouSureDialog, {
        data: {
          title: 'Delete Selected Steps',
          description: `Are you sure you want to delete ${selectedCount} selected step${selectedCount > 1 ? 's' : ''}?`,
        } as AreYouSureData,
        autoFocus: true,
      })
      .afterClosed()
      .subscribe(confirmed => {
        if (confirmed) {
          // Get indices of selected steps in reverse order to maintain correct indices during deletion
          const selectedIndices: number[] = [];
          this.stepsForm.controls.forEach((control, index) => {
            if (control.get('selected')?.value) {
              selectedIndices.push(index);
            }
          });
          
          // Delete in reverse order to maintain indices
          selectedIndices.reverse().forEach(index => {
            this.stepsForm.removeAt(index);
          });
          
          // Clear clipboard since all selected steps were deleted
          this.clipboardSteps = [];
          
          this._cdr.detectChanges();
        }
      });
  }

  /**
   * Handles click on Enable checkbox, supporting shift+click multi-selection.
   * @param event MouseEvent
   * @param index Index of the clicked checkbox
   */
  onEnableCheckboxClick(event: MouseEvent, index: number) {
    if (event.shiftKey && this.lastEnableCheckedIndex !== null) {
      // Always set checked to true for shift+click multi-select
      const checked = true;
      const [start, end] = [this.lastEnableCheckedIndex, index].sort((a, b) => a - b);
      for (let i = start; i <= end; i++) {
        this.stepsForm.at(i).get('enabled')?.setValue(checked);
      }
      event.preventDefault(); // Prevent default click behavior
    }
    this.lastEnableCheckedIndex = index;
  }

  /**
   * Handles click on Screenshot checkbox, supporting shift+click multi-selection.
   * @param event MouseEvent
   * @param index Index of the clicked checkbox
   */
  onScreenshotCheckboxClick(event: MouseEvent, index: number) {
    if (event.shiftKey && this.lastScreenshotCheckedIndex !== null) {
      // Always set checked to true for shift+click multi-select
      const checked = true;
      const [start, end] = [this.lastScreenshotCheckedIndex, index].sort((a, b) => a - b);
      for (let i = start; i <= end; i++) {
        this.stepsForm.at(i).get('screenshot')?.setValue(checked);
      }
      event.preventDefault();
    }
    this.lastScreenshotCheckedIndex = index;
  }

  /**
   * Handles click on Compare checkbox, supporting shift+click multi-selection.
   * @param event MouseEvent
   * @param index Index of the clicked checkbox
   */
  onCompareCheckboxClick(event: MouseEvent, index: number) {
    if (event.shiftKey && this.lastCompareCheckedIndex !== null) {
      // Always set checked to true for shift+click multi-select
      const checked = true;
      const [start, end] = [this.lastCompareCheckedIndex, index].sort((a, b) => a - b); 
      for (let i = start; i <= end; i++) {
        this.stepsForm.at(i).get('compare')?.setValue(checked);
        // If compare is checked, ensure screenshot is also checked
        if (checked) {
          this.stepsForm.at(i).get('screenshot')?.setValue(true);
        }
      }
      event.preventDefault();
    }
    this.lastCompareCheckedIndex = index;
  }

  /**
   * Update the disabled state of continue_on_failure checkbox based on department and user settings
   */
  private updateContinueOnFailureState() {
    // Get the continue_on_failure control from the form
    const continueOnFailureControl = this.stepsForm.at(0)?.get('continue_on_failure');
    if (!continueOnFailureControl) return;

    // Check if department settings or user settings force disable the checkbox
    // If continue_on_failure is false in settings, it means the checkbox should be disabled (forced)
    const departmentForcedDisabled = this._editFeature?.department?.settings?.continue_on_failure === false;
    const userForcedDisabled = this.user?.settings?.continue_on_failure === false;
    const isForcedDisabled = departmentForcedDisabled || userForcedDisabled;
    
    if (isForcedDisabled) {
      continueOnFailureControl.disable();
    } else {
      continueOnFailureControl.enable();
    }
  }

  /**
   * Returns the list of .apk file names for the current department (not removed).
   * Used for the app_package dropdown.
   */
  get appPackages(): string[] {
    return (this.department?.files as UploadedFile[])
      ?.filter(file => file.name.toLowerCase().endsWith('.apk') && !file.is_removed)
      ?.map(file => file.name.replace(/\.apk$/i, '')) || [];
  }

  // Focus the dropdown when it appears
  ngAfterViewChecked() {
    if (this.showMobileDropdown && this.dropdownRef) {
      this.dropdownRef.nativeElement.focus();
      // Scroll the active option into view
      const options = this.dropdownOptionRefs?.toArray();
      if (options && options[this.dropdownActiveIndex]) {
        options[this.dropdownActiveIndex].nativeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  // Handle keyboard navigation in the custom dropdown
  onDropdownKeydown(event: KeyboardEvent) {
    let optionsLength = 0;
    if (this.mobileDropdownType === 'package') {
      optionsLength = this.appPackages.length;
    } else {
      optionsLength = this.runningMobiles.length;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.dropdownActiveIndex = (this.dropdownActiveIndex + 1) % optionsLength;
      this._cdr.detectChanges();
      setTimeout(() => {
        const options = this.dropdownOptionRefs?.toArray();
        if (options && options[this.dropdownActiveIndex]) {
          options[this.dropdownActiveIndex].nativeElement.scrollIntoView({ block: 'nearest' });
        }
      }, 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.dropdownActiveIndex = (this.dropdownActiveIndex - 1 + optionsLength) % optionsLength;
      this._cdr.detectChanges();
      setTimeout(() => {
        const options = this.dropdownOptionRefs?.toArray();
        if (options && options[this.dropdownActiveIndex]) {
          options[this.dropdownActiveIndex].nativeElement.scrollIntoView({ block: 'nearest' });
        }
      }, 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (optionsLength > 0) {
        if (this.mobileDropdownType === 'package') {
          this.onMobileDropdownSelect(this.appPackages[this.dropdownActiveIndex]);
        } else {
          const mobile = this.runningMobiles[this.dropdownActiveIndex];
          this.onMobileDropdownSelect(this.mobileDropdownType === 'code' ? mobile.hostname : mobile.image_name);
        }
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation(); // Prevent dialog close
      this.showMobileDropdown = false;
      this.dropdownActiveIndex = 0;
      this._cdr.detectChanges();
    }
    this._cdr.detectChanges();
  }
}
