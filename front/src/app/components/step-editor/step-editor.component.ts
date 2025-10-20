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
import { MatLegacyAutocompleteTrigger as MatAutocompleteTrigger } from '@angular/material/legacy-autocomplete';
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
export class StepEditorComponent extends SubSinkAdapter implements OnInit, AfterViewChecked {
  stepsForm: UntypedFormArray;

  @ViewSelectSnapshot(ActionsState) actions: Action[];
  @ViewSelectSnapshot(UserState) user!: UserInfo;
  @Output() textareaFocusToParent = new EventEmitter<{isFocused: boolean, event: any}>();

  //Added to send event (editVariables button) to parent component
  @Output() editVariablesRequested = new EventEmitter<void>();
  editVariables() {
    this.logger.msg("4","editVariables button clicked","step-editor.component.ts");
    this.editVariablesRequested.emit();
  }

  @Input() feature: Feature;
  @Input() name: string;
  @Input() mode: 'new' | 'edit' | 'clone';
  @Input() variables: VariablePair[];
  @Input() department: Department;

  //  {file_path} area variables. Add property for file path autocomplete
  filePathAutocompleteOptions: { value: string; label: string; path: string }[] = [];
  showFilePathAutocomplete: boolean = false;
  lastSelectedFilePaths: Map<number, string> = new Map();
  currentFilePathStepIndex: number | null = null;

  @ViewChild('filePathAutocompletePanel') filePathAutocompletePanel: ElementRef;
  @ViewChild('basicMenu') basicContextMenu: any; // Context menu reference
  
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
  variablePopupHeight: number = 260;

  @ViewChildren('customAutocompleteOption', { read: ElementRef })
  varlistItems: QueryList<ElementRef>;
  @ViewChild(MatList, { read: ElementRef }) varlist: ElementRef;
  @ViewChild('variable_name', { read: ElementRef, static: false })
  varname: ElementRef;
  @ViewChild('variableAutocompletePanel') variableAutocompletePanel: ElementRef;


  displayedVariables: (VariablePair | string)[] = [];
  stepVariableData = <VariableInsertionData>{};
  snack: any;

  private editingApiCallIndex: number | null = null;

  filteredGroupedActions$ = new BehaviorSubject<{ name: string; actions: Action[] }[]>([]);

  private lastPointer = { x: 0, y: 0, target: null as EventTarget | null };
  
  /**
   * Clipboard for storing copied steps.
   */
  clipboardSteps: any[] = [];
  // Track last checked index for multi-selection
  private lastEnableCheckedIndex: number | null = null;
  private lastScreenshotCheckedIndex: number | null = null;
  private lastSelectCheckedIndex: number | null = null;

  runningMobiles: any[] = []; // Should be Container[], but using any to avoid import issues
  userMobiles: any[] = [];
  sharedMobiles: any[] = [];
  showMobileDropdown: boolean = false;
  mobileDropdownStepIndex: number | null = null;
  mobileDropdownReplaceIndex: number | null = null;

  // Holds the pixel width of the quoted content for the mobile dropdown
  mobileDropdownWidth: number = 200;
  mobileDropdownHeight: number = 200;

  // Tracks whether the dropdown is for mobile_name or mobile_code
  mobileDropdownType: 'name' | 'code' | 'package' = 'name';

  // Removed static appActivities list – activities dropdown no longer used

  @ViewChild('dropdownRef') dropdownRef!: ElementRef<HTMLDivElement>;
  @ViewChildren('dropdownOptionRef') dropdownOptionRefs!: QueryList<ElementRef<HTMLLIElement>>;
  dropdownActiveIndex: number = 0;

  @ViewChild('stepHelpTrigger', { read: MatAutocompleteTrigger })
  stepHelpTrigger!: MatAutocompleteTrigger;

  // Add a new property to track the initial dropdown position
  initialDropdownPosition: number | null = null;
  mobileDropdownLeft: number = 0;

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
    private logger: LogService,
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
    this.logger.msg("4","sendTextareaFocusToParent","step-editor", isFocused)
    this.inputFocusService.setInputFocus(isFocused)

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

  /**
   * Get error data for overlay display
   * @param step FormGroup containing the step
   * @returns Object with error details and closest match for template rendering
   */
  getStepErrorData(step: FormGroup): { errorDetails: string; closestMatch: string | null } {
    const errors = step.get('step_content')?.errors;
    
    if (!errors || !errors['invalidStep']) {
      return { errorDetails: '', closestMatch: null };
    }

    return { 
      errorDetails: errors['errorDetails'] || '', 
      closestMatch: errors['closestMatch'] || null 
    };
  }

  /**
   * Parse error details text to highlight quoted characters
   * Returns array of text segments with flags for found/expected quoted content
   */
  parseErrorDetails(errorDetails: string): { text: string; isFoundChar: boolean; isExpectedChar: boolean }[] {
    if (!errorDetails) return [];
    
    const parts: { text: string; isFoundChar: boolean; isExpectedChar: boolean }[] = [];
    
    // Regex to match: found 'X' and expected 'Y' patterns
    const regex = /found\s+'([^']*)'\s*,\s*expected\s+'([^']*)'/gi;
    const match = regex.exec(errorDetails);
    
    if (match) {
      const beforeMatch = errorDetails.substring(0, match.index);
      const afterMatch = errorDetails.substring(regex.lastIndex);
      const foundChar = match[1];
      const expectedChar = match[2];
      
      // Add text before the match
      if (beforeMatch) {
        parts.push({ 
          text: beforeMatch, 
          isFoundChar: false, 
          isExpectedChar: false 
        });
      }
      
      // Add "found" text
      parts.push({ 
        text: 'found ', 
        isFoundChar: false, 
        isExpectedChar: false 
      });
      
      // Add found character in quotes (red)
      parts.push({ 
        text: `'${foundChar}'`, 
        isFoundChar: true, 
        isExpectedChar: false 
      });
      
      // Add middle text
      parts.push({ 
        text: ', expected ', 
        isFoundChar: false, 
        isExpectedChar: false 
      });
      
      // Add expected character in quotes (green)
      parts.push({ 
        text: `'${expectedChar}'`, 
        isFoundChar: false, 
        isExpectedChar: true 
      });
      
      // Add remaining text
      if (afterMatch) {
        parts.push({ 
          text: afterMatch, 
          isFoundChar: false, 
          isExpectedChar: false 
        });
      }
    } else {
      // Fallback: if pattern doesn't match, return original text
      parts.push({ 
        text: errorDetails, 
        isFoundChar: false, 
        isExpectedChar: false 
      });
    }
    
    return parts;
  }

  /**
   * Show floating suggestion overlay near error icon
   */
  showSuggestionOverlay(evt: MouseEvent, index: number, step: FormGroup): void {
    const errors = step.get('step_content')?.errors;
    if (!errors || !errors['invalidStep']) return;

    // Exception: Don't show overlay for API call step (too many parameters, confusing)
    const stepContent = step.get('step_content')?.value || '';
    if (stepContent.toLowerCase().includes('make an api call') && 
        stepContent.includes('params:') && 
        stepContent.includes('headers:')) {
      return;
    }

    const target = (evt.currentTarget || evt.target) as HTMLElement | null;
    if (target) {
      const rect = target.getBoundingClientRect();
      const top = rect.bottom + 6 + window.scrollY;
      const right = rect.right + window.scrollX - 125;
      this.suggestionPosition[index] = { top, right };
    } else {
      // fallback by query
      const icon = document.querySelector(`[data-step-index="${index}"] .invalid-sign`) as HTMLElement | null;
      if (icon) {
        const rect = icon.getBoundingClientRect();
        this.suggestionPosition[index] = { top: rect.bottom + 6 + window.scrollY, right: rect.right + window.scrollX - 120 };
      }
    }
    this.suggestionOverlayVisible[index] = true;
    this._cdr.detectChanges();
  }

  /** Hide floating suggestion overlay */
  hideSuggestionOverlay(index: number): void {
    this.suggestionOverlayVisible[index] = false;
    this._cdr.detectChanges();
  }

  /**
   * Get suggestion characters for overlay, showing only missing characters
   */
  getSuggestionChars(step: FormGroup): { char: string; isMissing: boolean }[] {
    const errors = step.get('step_content')?.errors;
    if (!errors || !errors['closestMatch']) {
      return [];
    }

    const userInput = step.get('step_content')?.value || '';
    const correctStep = errors['closestMatch'];
    
    // Use CustomValidators unified comparison logic
    return CustomValidators.compareStepsForOverlay(userInput, correctStep);
  }

  /**
   * Autocomplete the step with the suggested correction
   * @param index Step index
   * @param step FormGroup containing the step
   * @param event Keyboard event
   */
  autocompleteStep(index: number, step: FormGroup, event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const errors = step.get('step_content')?.errors;
    if (!errors || !errors['closestMatch']) {
      return;
    }

    const correctStep = errors['closestMatch'];
    const userValue = step.get('step_content')?.value || '';
    const merged = this.mergePreservingQuotedContent(userValue, correctStep);
    
    // Hide floating overlay immediately and prevent it from showing again
    this.hideSuggestionOverlay(index);
    
    // Set a flag to prevent overlay from showing during this update
    this.suggestionOverlayVisible[index] = false;
    
    // Update the step value
    step.get('step_content')?.setValue(merged);
    
    // Trigger validation to clear any remaining errors
    step.get('step_content')?.updateValueAndValidity();
    
    // Small delay to ensure validation completes before onStepChange runs
    setTimeout(() => {
      // Double-check that overlay is still hidden after validation
      if (this.suggestionOverlayVisible[index]) {
        this.hideSuggestionOverlay(index);
      }
    }, 10);
    
    // Focus on the textarea
    const textarea = document.querySelector(`[data-step-index="${index}"] textarea`) as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
    }

    this._cdr.detectChanges();
  }

  /**
   * Merge suggested step with user's value preserving text inside quotes from user input.
   * Example: user: Start ... "631" ... ; suggestion: Start ... "{url}" ...
   * Result keeps "631".
   */
  private mergePreservingQuotedContent(userValue: string, suggested: string): string {
    // Extract quoted contents in order of appearance from user input
    const userQuotedContents: string[] = [];
    const userRegex = /"([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = userRegex.exec(userValue)) !== null) {
      userQuotedContents.push(m[1]);
    }

    // Replace each quoted block in suggested with corresponding user content (if available)
    let userIndex = 0;
    const result = suggested.replace(/"([^"]*)"/g, (_match: string, _p1: string) => {
      const replacement = userQuotedContents[userIndex++] ?? _p1;
      return `"${replacement}"`;
    });
    return result;
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
   * Fetch the list of mobile containers (running and paused) and store them in runningMobiles.
   * This includes all mobiles with different status so paused mobiles are visible but not interactive.
   */
  fetchRunningMobiles() {
    this._api.getContainersList().subscribe((containers: any[]) => { // Changed type to any[] to avoid import issues
      // Include all mobile containers regardless of status so paused mobiles are visible
      this.runningMobiles = containers.filter(c => 
        c.service_status === 'Running' || 
        c.service_status === 'Stopped' || 
        c.service_status === 'Stopping' ||
        c.service_status === 'Paused' ||
        c.service_status === 'Pausing'
      );
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
    this.logger.msg('4', '=== onStepTextareaClick() === Onsteptextareaclick', 'step-editor');
    const textarea = event.target as HTMLTextAreaElement;
    const value = textarea.value;

    this.logger.msg('4', '=== onStepTextareaClick() ===  this.lastSelectedFilePaths', 'step-editor', this.lastSelectedFilePaths);
    // Check if this step contains {file_path} OR has a previously selected file path
    if (this.lastSelectedFilePaths.has(index)) {
      // Call the existing function that handles file path autocomplete
      this.onTextareaFocusFilePath(event as any, index);
    }

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

    // Use custom dropdown instead of dialog when clicking inside quotes for mobile patterns

    // Reset dropdown state – will reopen only if a valid placeholder is found
    this.showMobileDropdown = false;
    this.mobileDropdownStepIndex = null;
    this.mobileDropdownReplaceIndex = null;
    
    // Strategy file_path: Hide mat-autocomplete panel with CSS
    const autocompletePanel = document.querySelector('.mat-optgroup');
    if (autocompletePanel) {
      (autocompletePanel as HTMLElement).style.display = 'none';
    }

    this._cdr.detectChanges();

    // Only show dropdown if clicking directly on a placeholder text
    this.checkAndShowMobileDropdown(textarea, index, cursorPos);

    // if the value includes $, show the variable dropdown
    if (value.includes('$')) {
      this.onStepChange(event as any, index);
    }
  }

  /**
   * Checks if the cursor is on a mobile placeholder and shows dropdown only if clicking on placeholder text
   */
  public checkAndShowMobileDropdown(textarea: HTMLTextAreaElement, index: number, cursorPos: number) {
    const value = textarea.value;
    const stepFormGroup = this.stepsForm.at(index) as FormGroup;
    const stepAction = stepFormGroup.get('step_action')?.value || '';

    // Simple regex-based approach to find quoted sections
    const quotedMatches: RegExpExecArray[] = [];
    const regex = /"([^"]*)"/g;
    let match;
    while ((match = regex.exec(value)) !== null) {
      quotedMatches.push(match);
    }
    let found = false;

    // Loop through all quoted matches to find the one where the cursor is inside
    for (let i = 0; i < quotedMatches.length; i++) {
      const match = quotedMatches[i];
      const start = match.index! + 1; // after first quote
      const end = match.index! + match[0].length - 1; // before last quote
      
      if (cursorPos >= start && cursorPos <= end) {
        // Cursor is inside these quotes
        const insideText = match[1]; // content without quotes
        
        // Use the current index as parameter position
        const paramIndex = i;

        // Only show dropdown if the text is exactly a placeholder or if it's an empty quote in a mobile action
        let shouldShowDropdown = false;
        
        // Check if step starts with "Connect to mobile" or "Start mobile" patterns
        const stepStartsWithMobile = /^(Connect to mobile|Start mobile)\s*"/i.test(value.trim());
        if (stepStartsWithMobile && paramIndex === 0) {
          // For first quoted parameter in Connect to mobile or Start mobile patterns
          shouldShowDropdown = true;
          if (value.toLowerCase().includes('connect to mobile')) {
            this.mobileDropdownType = 'code';
          } else {
            this.mobileDropdownType = 'name';
          }
        }
        // Check if it's exactly a placeholder text
        else if (insideText === '{mobile_name}' || insideText === '{mobile_code}') {
          shouldShowDropdown = true;
          // Determine dropdown type based on the placeholder
          if (insideText === '{mobile_code}') {
            this.mobileDropdownType = 'code';
          } else if (insideText === '{mobile_name}') {
            this.mobileDropdownType = 'name';
          }
        }
        // Check if it's an existing mobile value (for editing)
        else if (this.runningMobiles.some(m => m.image_name === insideText) ||
                 this.runningMobiles.some(m => m.hostname === insideText)) {
          shouldShowDropdown = true;
          // Determine dropdown type based on what matches
          const matchingMobile = this.runningMobiles.find(m => m.hostname === insideText);
          if (matchingMobile) {
            this.mobileDropdownType = 'code';
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

          // Separate mobiles into user and shared groups and refresh status
          this.separateMobilesByOwnership();
          
          // Force status refresh after a short delay
          setTimeout(() => {
            this.refreshMobileStatus();
          }, 100);

          // Calculate mobile dropdown position similar to variables
          this.calculateMobileDropdownPosition(index, textarea);


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
   * Separate mobiles into user and shared groups
   */
  separateMobilesByOwnership() {
    this.userMobiles = [];
    this.sharedMobiles = [];
    
    this.runningMobiles.forEach(mobile => {
      // Debug logging to see mobile properties
      this.logger.msg('4', '=== separateMobilesByOwnership === Mobile data:', 'step-editor', {
        image_name: mobile.image_name,
        hostname: mobile.hostname,
        shared: mobile.shared,
        created_by: mobile.created_by,
        current_user_id: this.user?.user_id
      });
      
      // Ensure we have valid user and mobile data
      const currentUserId = this.user?.user_id;
      const mobileCreatedBy = mobile.created_by;
      
      // Check if mobile is owned by current user
      const isOwnedByCurrentUser = !mobileCreatedBy || 
        (currentUserId && mobileCreatedBy === currentUserId);
      
      if (isOwnedByCurrentUser) {
        // Mobile belongs to current user - always in USER section
        this.userMobiles.push(mobile);
      } else {
        // Mobile belongs to another user - check if it's explicitly shared
        if (mobile.shared === true) {
          // Mobile is shared by someone else - goes to SHARED section
          this.sharedMobiles.push(mobile);
        }
      }
    });
  }

  /**
   * Check if a mobile is interactive (available for selection)
   */
  isMobileInteractive(mobile: any): boolean {
    return mobile.service_status === 'Running';
  }

  /**
   * Get all mobiles (user + shared) in one combined array for simplified rendering
   */
  getAllMobiles(): any[] {
    const allMobiles = [...this.userMobiles, ...this.sharedMobiles];
    
    // Filter to show only Android emulators, exclude browsers
    return allMobiles.filter(mobile => {
      const imageName = mobile.image_name || mobile.mobile_image_name || '';
      const hostname = mobile.hostname || '';
      
      // Include only Android emulators (contain "Android" in name)
      // Exclude browsers like Chrome, Firefox, etc.
      return imageName.toLowerCase().includes('android') && 
             !imageName.toLowerCase().includes('chrome') &&
             !imageName.toLowerCase().includes('firefox') &&
             !imageName.toLowerCase().includes('browser') &&
             !imageName.toLowerCase().includes('safari');
    });
  }

  /**
   * Check if a mobile is shared to determine badge display
   */
  isSharedMobile(mobile: any): boolean {
    return this.sharedMobiles.includes(mobile);
  }

  /**
   * Refresh mobile status by refetching the list
   */
  refreshMobileStatus() {
    this.fetchRunningMobiles();
    this.separateMobilesByOwnership();
  }

  /**
   * Calculate mobile dropdown position at cursor location
   */
  calculateMobileDropdownPosition(stepIndex: number, textarea: HTMLTextAreaElement) {
    // Calculate position exactly like variables do - get cursor coordinates
    const coords = this.getCaretCoordinates(textarea, this.mobileDropdownReplaceIndex! + 1);
    
    // Get the textarea position to add relative to document
    const textareaRect = textarea.getBoundingClientRect();
    
    // Calculate height like variables but for mobiles - MUST do this first
    const allMobiles = this.getAllMobiles();
    const mobileCount = allMobiles.length;
    if (mobileCount === 0) {
      this.mobileDropdownHeight = 120;
    } else if (mobileCount <= 4) {
      this.mobileDropdownHeight = (mobileCount * 50) + 80;
    } else {
      this.mobileDropdownHeight = 260;
    }
    
    // Set position to cursor coordinates like variables do - absolute positioning
    this.initialDropdownPosition = textareaRect.top + coords.top + 25; // Add some offset from cursor
    this.mobileDropdownLeft = textareaRect.left + coords.left;
    
    this.logger.msg('4', '=== calculateMobileDropdownPosition === Calculated initialDropdownPosition:', 'step-editor', this.initialDropdownPosition);
    this.logger.msg('4', '=== calculateMobileDropdownPosition === Calculated mobileDropdownLeft:', 'step-editor', this.mobileDropdownLeft);
    
    // Set width
    this.mobileDropdownWidth = 450;
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
    this.closeMobileDropdown();
  }

  closeMobileDropdown() {
    this.showMobileDropdown = false;
    this.mobileDropdownStepIndex = null;
    this.mobileDropdownReplaceIndex = null;
    this.dropdownActiveIndex = 0;
    this.initialDropdownPosition = null;
    this.mobileDropdownLeft = 0;
    this._cdr.detectChanges();
  }

  /**
   * Custom function to fix or validate each step
   * every time the user loses focus for the given step
   * @param {FocusEvent} event Event of blur
   * @param {number} index Index of step
   */
  fixStep(event: any, index: number) {
    this.logger.msg('4', '=== fixStep() === Mat Autocomplete Fix Step', 'step-editor');
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

    if (this.displayedVariables.length > 0) {
      return; // Exit early if variable dropdown is open
    }

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
    // Commented function to prevent the focus from being sent twice to the parent since it already called in the html)
    // this.sendTextareaFocusToParent(true, index, false);
    
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
          this.runningMobiles.some(m => m.image_name === nextQuote.text) ||
          this.runningMobiles.some(m => m.hostname === nextQuote.text)) {
        
        // Set dropdown type based on placeholder or existing value
        if (nextQuote.text === '{mobile_code}' || this.runningMobiles.some(m => m.hostname === nextQuote.text)) {
          this.mobileDropdownType = 'code';
        } else {
          this.mobileDropdownType = 'name';
        }
        
        // Always refresh the list of running mobiles before showing the dropdown
        this.fetchRunningMobiles();
        
        this.showMobileDropdown = true;
        this.mobileDropdownStepIndex = i;
        this.mobileDropdownReplaceIndex = nextQuote.start - 1;
        
        // Separate mobiles into user and shared groups
        this.separateMobilesByOwnership();
        
        // Force status refresh after a short delay
        setTimeout(() => {
          this.refreshMobileStatus();
        }, 100);
        
        // Position the dropdown with mobile-friendly adjustments
        // Calculate mobile dropdown position similar to variables
        this.calculateMobileDropdownPosition(i, textarea);
        

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
    const currentValue = step.value;
    
    this.logger.msg('4', '=== onClickVariable() === Original value:', 'step-editor', currentValue);
    this.logger.msg('4', '=== onClickVariable() === Quote indexes:', 'step-editor', this.stepVariableData.quoteIndexes);
    
    // Get the content between quotes (including quotes)
    const contentBetweenQuotes = currentValue.substring(
      this.stepVariableData.quoteIndexes.prev,
      this.stepVariableData.quoteIndexes.next
    );
    
    this.logger.msg('4', '=== onClickVariable() === Content between quotes:', 'step-editor', contentBetweenQuotes);
    
    // Remove quotes to get the inner content
    const innerContent = contentBetweenQuotes.replace(/"/g, '');
    
    this.logger.msg('4', '=== onClickVariable() === Inner content:', 'step-editor', innerContent);
    
    // Replace the $ part with the selected variable, preserving any text after $
    let newInnerContent;
    if (innerContent.includes('$')) {
      // Find the position of $ and replace everything from $ onwards
      const dollarIndex = innerContent.indexOf('$');
      newInnerContent = innerContent.substring(0, dollarIndex) + `$${variable_name}`;
      this.logger.msg('4', '=== onClickVariable() === Dollar found at index:', 'step-editor', dollarIndex);
    } else {
      // If no $ found, just add the variable
      newInnerContent = innerContent + `$${variable_name}`;
      this.logger.msg('4', '=== onClickVariable() === No dollar found, appending:', 'step-editor', '');
    }
    
    this.logger.msg('4', '=== onClickVariable() === New inner content:', 'step-editor', newInnerContent);
    
    // Reconstruct the full text with quotes preserved
    const newValue = currentValue.substring(0, this.stepVariableData.quoteIndexes.prev) +
                    `"${newInnerContent}"` +
                    currentValue.substring(this.stepVariableData.quoteIndexes.next);
    
    this.logger.msg('4', '=== onClickVariable() === Final value:', 'step-editor', newValue);
    
    step.setValue(newValue);

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

    // Only reset position when changing steps, not when typing
    if (this.stepVariableData.currentStepIndex !== index) {
      this.initialDropdownPosition = null;
    }

    const textarea = event.target as HTMLTextAreaElement;
    // Update resize state on input but preserve dropdown position
    this.updateTextareaResize(index);
    const textareaValue = textarea.value.trim();

    // Auto-hide suggestion overlay if step is now valid
    const stepFormGroup = this.stepsForm.at(index) as FormGroup;
    const stepErrors = stepFormGroup?.get('step_content')?.errors;
    if (this.suggestionOverlayVisible[index] && (!stepErrors || !stepErrors['invalidStep'])) {
      this.hideSuggestionOverlay(index);
    }
    
    // If overlay is explicitly hidden (e.g., after TAB autocomplete), don't show it again
    if (!this.suggestionOverlayVisible[index]) {
      return;
    }

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

    this.logger.msg('4', '=== onStepChange() === Quote indexes:', 'step-editor', this.stepVariableData.quoteIndexes);
    this.logger.msg('4', '=== onStepChange() === Step value:', 'step-editor', this.stepVariableData.stepValue);
    this.logger.msg('4', '=== onStepChange() === Selection index:', 'step-editor', this.stepVariableData.selectionIndex);

    if (this.stepVariableData.stepValue.startsWith('Run Javascript function')) {
      this.displayedVariables = [];
      this.stepVariableData.currentStepIndex = null;
      return;
    } 

    // return if left quote or right quote index is undefined
    if (
      !this.stepVariableData.quoteIndexes.next ||
      !this.stepVariableData.quoteIndexes.prev
    ) {
      this.logger.msg('4', '=== onStepChange() === No boundaries found, returning', 'step-editor', '');
      return;
    }

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

    this.logger.msg('4', '=== onStepChange() === Str to replace:', 'step-editor', this.stepVariableData.strToReplace);
    this.logger.msg('4', '=== onStepChange() === Str without quotes:', 'step-editor', this.stepVariableData.strWithoutQuotes);

    // Check if cursor is actually between boundaries (quotes or commas) and if the string contains a dollar sign
    const cursorBetweenBoundaries = this.stepVariableData.quoteIndexes.prev !== undefined && 
                                   this.stepVariableData.quoteIndexes.next !== undefined &&
                                   this.stepVariableData.selectionIndex > this.stepVariableData.quoteIndexes.prev && 
                                   this.stepVariableData.selectionIndex < this.stepVariableData.quoteIndexes.next;
    
    this.logger.msg('4', '=== onStepChange() === Cursor between boundaries:', 'step-editor', cursorBetweenBoundaries);
    this.logger.msg('4', '=== onStepChange() === Cursor position:', 'step-editor', this.stepVariableData.selectionIndex);
    this.logger.msg('4', '=== onStepChange() === Boundary range:', 'step-editor', `${this.stepVariableData.quoteIndexes.prev} - ${this.stepVariableData.quoteIndexes.next}`);
    
    // Only proceed if cursor is between boundaries AND the current field contains a dollar sign
    if (cursorBetweenBoundaries) {
      // Check if the current field (between boundaries) actually contains a variable
      const currentField = this.stepVariableData.stepValue.substring(
        this.stepVariableData.quoteIndexes.prev, 
        this.stepVariableData.quoteIndexes.next
      );
      
      this.logger.msg('4', '=== onStepChange() === Current field:', 'step-editor', currentField);
      
      // Check if cursor is positioned near a $ symbol (within 20 characters)
      const cursorPos = this.stepVariableData.selectionIndex - this.stepVariableData.quoteIndexes.prev;
      const textAroundCursor = currentField.substring(Math.max(0, cursorPos - 20), Math.min(currentField.length, cursorPos + 20));
      const hasDollarNearCursor = textAroundCursor.includes('$');
      
      // Check if there's a valid variable pattern near the cursor
      const hasValidVariableNearCursor = hasDollarNearCursor && /\$[a-zA-Z_][a-zA-Z0-9_]*/.test(textAroundCursor);
      
      // Also show variables if the field is just "$" (for starting a new variable)
      const isJustDollar = currentField.trim() === '$' || currentField === '"$"' || currentField === '$';
      
      const shouldShowDialog = hasValidVariableNearCursor || isJustDollar;
      this.logger.msg('4', '=== onStepChange() === Text around cursor:', 'step-editor', textAroundCursor);
      this.logger.msg('4', '=== onStepChange() === Should show dialog:', 'step-editor', shouldShowDialog);
      
      if (shouldShowDialog) {
        this.logger.msg('4', '=== onStepChange() === Showing variables dialog', 'step-editor', '');
        // Do not display variables or the dialog if the step is "Run Javascript function"
        if (this.stepVariableData.stepValue.startsWith('Run Javascript function')) {
          this.displayedVariables = [];
          this.stepVariableData.currentStepIndex = null;
          return;
        }

        // Extract variable name from current field
        const variableMatch = currentField.match(/\$([a-zA-Z_][a-zA-Z0-9_]*)/);
        const variableSearchTerm = variableMatch ? variableMatch[1] : this.stepVariableData.strWithoutQuotes.replace('$', '');
        
        this.logger.msg('4', '=== onStepChange() === Variable search term:', 'step-editor', variableSearchTerm);
        this.logger.msg('4', '=== onStepChange() === Total variables available:', 'step-editor', this.variables.length);
        this.logger.msg('4', '=== onStepChange() === All variables:', 'step-editor', this.variables.map(v => v.variable_name));
        
        // If search term is empty or too short, show all variables
        let filteredVariables;
        if (!variableSearchTerm || variableSearchTerm.length < 2) {
          filteredVariables = this.variables;
          this.logger.msg('4', '=== onStepChange() === Showing all variables (search term too short)', 'step-editor', '');
        } else {
          filteredVariables = this.variables.filter(item =>
            item.variable_name.includes(variableSearchTerm)
          );
      
        }

        this.logger.msg('4', '=== onStepChange() === Filtered variables length:', 'step-editor', filteredVariables.length);
        this.logger.msg('4', '=== onStepChange() === Filtered variables:', 'step-editor', filteredVariables);
        
        // Calculate variable popup height based on filtered variables count
        if (filteredVariables.length === 0) {
          this.variablePopupHeight = 110;
        } else if (filteredVariables.length <= 4) {
          this.variablePopupHeight = (filteredVariables.length*50)+60;
        } else {
          this.variablePopupHeight = 260;
        }
        
        

        // Set initial position only when dropdown first appears (when it was not visible before)
        if (this.initialDropdownPosition === null) {

          const textareas = document.querySelectorAll(`textarea[formcontrolname="step_content"]`);
          const textarea = textareas[index] as HTMLTextAreaElement;
          const stepContent = textarea.closest('.step_content') as HTMLElement;
          const stepContentHeight = stepContent.offsetHeight + 10;

          this.logger.msg('4', '=== onStepChange() === Textarea height:', 'step-editor', stepContentHeight);

          // Calculate initial position based on step index only to prevent shifts when typing
          // Use a fixed calculation that doesn't depend on filtered variables count
          this.initialDropdownPosition = index === 0 
            ? stepContentHeight  // For first step, position below
            : -this.variablePopupHeight;              // For other steps, position above with fixed offset
          
          this.logger.msg('4', '=== onStepChange() === Calculated initialDropdownPosition:', 'step-editor', this.initialDropdownPosition);
        }
        // If position is already set, keep it stable - don't recalculate

        this.displayedVariables =
          filteredVariables.length > 0
            ? filteredVariables
            : ['No variable with this name'];
        // Set current step index when dropdown opens
        this.stepVariableData.currentStepIndex = index;

        this.logger.msg('4', '=== onStepChange() === Displayed variables after assignment:', 'step-editor', this.displayedVariables);

        this._cdr.detectChanges();
        // when flyout of variables opens up, by default the selected element will be the first one
        setTimeout(() => {
          const varlistItemsArray = this.varlistItems.toArray();
          if (varlistItemsArray.length > 0 && varlistItemsArray[0] && varlistItemsArray[0].nativeElement) {
            const firstVariableRef = varlistItemsArray[0].nativeElement;
            this.renderer.addClass(firstVariableRef, 'selected');
          }
        }, 0);
      } else {
        this.logger.msg('4', '=== onStepChange() === No valid variable in current field, not showing dialog', 'step-editor', '');
      }
    } else {
      this.logger.msg('4', '=== onStepChange() === Cursor not between boundaries', 'step-editor', '');
      this.initialDropdownPosition = null;
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
  // Handles nested quotes by tracking quote depth
  getIndexes(str, startIndex): QuoteIndexes {
    // First try to find quotes (for normal cases like "$variable") using nested quote logic
    let prevQuoteIndex = getPrevQuoteWithDepth();
    let nextQuoteIndex = getNextQuoteWithDepth();

    // returns the index of the nearest " that is positioned after received index, considering nested quotes
    function getNextQuoteWithDepth(): number | undefined {
      let quoteDepth = 0;
      let inQuotes = false;
      
      // First, determine if we're inside quotes by scanning from the beginning
      for (let i = 0; i < startIndex; i++) {
        if (str[i] === '"' && (i === 0 || str[i - 1] !== '\\')) {
          if (inQuotes) {
            quoteDepth--;
            if (quoteDepth === 0) {
              inQuotes = false;
            }
          } else {
            quoteDepth = 1;
            inQuotes = true;
          }
        }
      }
      
      // Now find the closing quote from startIndex
      for (let i = startIndex; i < str.length; i++) {
        if (str[i] === '"' && (i === 0 || str[i - 1] !== '\\')) {
          if (inQuotes) {
            quoteDepth--;
            if (quoteDepth === 0) {
              return i + 1; // Return position after the closing quote
            }
          } else {
            quoteDepth = 1;
            inQuotes = true;
          }
        }
      }
      return undefined;
    }

    // returns the index of the nearest " that is positioned before received index, considering nested quotes
    function getPrevQuoteWithDepth(): number | undefined {
      let quoteDepth = 0;
      let inQuotes = false;
      let lastOpeningQuote = -1;
      
      // Scan from beginning to find the opening quote that contains our position
      for (let i = 0; i < startIndex; i++) {
        if (str[i] === '"' && (i === 0 || str[i - 1] !== '\\')) {
          if (inQuotes) {
            quoteDepth--;
            if (quoteDepth === 0) {
              inQuotes = false;
            }
          } else {
            quoteDepth = 1;
            inQuotes = true;
            lastOpeningQuote = i;
          }
        }
      }
      
      // If we're inside quotes, return the opening quote position
      if (inQuotes && lastOpeningQuote !== -1) {
        return lastOpeningQuote;
      }
      
      return undefined;
    }

    // If we found quotes and cursor is between them, check if we're in SQL context
    if (prevQuoteIndex !== undefined && nextQuoteIndex !== undefined && 
        startIndex > prevQuoteIndex && startIndex < nextQuoteIndex) {
      
      // Check if we're inside a SQL query by looking for SQL keywords
      const textBetweenQuotes = str.substring(prevQuoteIndex, nextQuoteIndex - 1);
      const isSQLContext = /INSERT\s+INTO|UPDATE|DELETE\s+FROM|SELECT/i.test(textBetweenQuotes);
      
      if (isSQLContext) {
        // For SQL context, try to find comma boundaries within the quoted text
        let prevCommaIndex = getPrevCommaWithinQuotes(prevQuoteIndex, nextQuoteIndex);
        let nextCommaIndex = getNextCommaWithinQuotes(prevQuoteIndex, nextQuoteIndex);
        
        // If we found comma boundaries, use them instead of quotes
        if (prevCommaIndex !== undefined && nextCommaIndex !== undefined) {
          // Skip whitespace and trailing characters around comma/parenthesis boundaries
          while (prevCommaIndex < str.length && /\s/.test(str[prevCommaIndex])) {
            prevCommaIndex++;
          }
          while (nextCommaIndex > 0 && /[\s\)\]\}]/.test(str[nextCommaIndex - 1])) {
            nextCommaIndex--;
          }
          return { prev: prevCommaIndex, next: nextCommaIndex };
        }
        
        // If no comma boundaries found in SQL context, fall back to using quotes
        return { prev: prevQuoteIndex, next: nextQuoteIndex };
      }
      
      // If not SQL context or no comma boundaries found, use quotes
      return { prev: prevQuoteIndex, next: nextQuoteIndex };
    }

    // If no quotes or cursor not between them, try comma boundaries (for SQL context like ,$variable,)
    let prevCommaIndex = getPrevComma();
    let nextCommaIndex = getNextComma();

    // returns the index of the nearest , or ( that is positioned before received index within quotes
    function getPrevCommaWithinQuotes(quoteStart: number, quoteEnd: number): number | undefined {
      for (let i = startIndex - 1; i >= quoteStart; i--) {
        if (str[i] === ',' || str[i] === '(') return i + 1; // Skip the comma or parenthesis
      }
      return undefined;
    }

    // returns the index of the nearest , or ) that is positioned after received index within quotes
    function getNextCommaWithinQuotes(quoteStart: number, quoteEnd: number): number | undefined {
      for (let i = startIndex; i < quoteEnd; i++) {
        if (str[i] === ',' || str[i] === ')') return i;
      }
      return undefined;
    }

    // returns the index of the nearest , or ( that is positioned before received index
    function getPrevComma(): number | undefined {
      for (let i = startIndex - 1; i >= 0; i--) {
        if (str[i] === ',' || str[i] === '(') return i + 1; // Skip the comma or parenthesis
      }
      return undefined;
    }

    // returns the index of the nearest , or ) that is positioned after received index
    function getNextComma(): number | undefined {
      for (let i = startIndex; i < str.length; i++) {
        if (str[i] === ',' || str[i] === ')') return i;
      }
      return undefined;
    }

    // Skip whitespace and trailing characters around comma boundaries
    if (prevCommaIndex !== undefined) {
      while (prevCommaIndex < str.length && /\s/.test(str[prevCommaIndex])) {
        prevCommaIndex++;
      }
    }
    if (nextCommaIndex !== undefined) {
      // Skip whitespace and trailing characters like ), ], }
      while (nextCommaIndex > 0 && /[\s\)\]\}]/.test(str[nextCommaIndex - 1])) {
        nextCommaIndex--;
      }
    }

    return { prev: prevCommaIndex, next: nextCommaIndex };
  }

  stepsDocumentation: { description: string, examples: string }[] = [];

  /**
   * Triggered when the user selects a step from the Autocomplete feature
   * @param event MatAutocompleteSelectedEvent
   * @param index Index of the current step
   */
  selectFirstVariable(event: MatAutocompleteSelectedEvent, index: number) {

    // department files
    this.logger.msg('4', '=== onStepChange() === Department Files', 'step-editor', this.department.files);

    // event
    this.logger.msg('4', '=== onStepChange() === Event', 'step-editor', event);

    // index
    this.logger.msg('4', '=== onStepChange() === Index', 'step-editor', index);

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

  @HostListener('keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    const isEscape = event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27;
    if (!isEscape) {
      return;
    }

    this.closeVariableDropdown();

    // Close mobile dropdown panel
    if (this.showMobileDropdown) {
      this.closeMobileDropdown();
      this.logger.msg('4', '=== handleGlobalKeyDown() === Close Mobile Dropdown', 'step-editor');
      event.stopImmediatePropagation();
      event.preventDefault();
      this._cdr.detectChanges();
      return;
    }

    // Close filePathAutocompletePanel
    if (this.showFilePathAutocomplete) {
      this.showFilePathAutocomplete = false;
    }

    // Attempt to close autocomplete panels
    let panelClosed = false;
    this.autocompleteTriggers?.forEach(trigger => {
      if (trigger.panelOpen) {
        this.logger.msg('4', '=== handleGlobalKeyDown() === Close Panel', 'step-editor', trigger);
        trigger.closePanel();
        panelClosed = true;
      }
    });

    // Close variable fly-out (step list) if it is open
    if (this.displayedVariables.length > 0) {
      this.logger.msg('4', '=== handleGlobalKeyDown() === Close Variable Fly-out', 'step-editor');
      this.displayedVariables = [];
      this.stepVariableData.currentStepIndex = null;
      panelClosed = true;
    }

    if (panelClosed) {
      event.stopImmediatePropagation();
      event.preventDefault();
      this.logger.msg('4', '=== handleGlobalKeyDown() === Close Autocomplete', 'step-editor');
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
  
  // Suggestion overlay (floating) state
  suggestionOverlayVisible: boolean[] = [];
  suggestionPosition: { top: number; right: number }[] = [];


  closeAutocomplete(index?: number) {
    this.logger.msg('4', '=== closeAutocomplete() === Close Mat Autocomplete Step Index:', 'step-editor', index);
    const actualIndex = index ?? this.currentFocusedStepIndex;
    
    if (actualIndex !== null) {
      const stepFormGroup = this.stepsForm.at(actualIndex) as FormGroup;
      const stepContent = stepFormGroup?.get('step_content')?.value;
      
      // If the step content is empty, set the documentation to empty
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

  /**
   * Returns the display value with the missing character inserted directly in the text
   */
  getDisplayValueWithMissingChar(index: number): string {
    const stepFormGroup = this.stepsForm.at(index) as FormGroup;
    const value: string = stepFormGroup?.get('step_content')?.value || '';
    if (!value) return '';

    // If step is valid, return original value
    if (!stepFormGroup?.get('step_content')?.errors?.invalidStep) {
      return value;
    }

    // Find the missing character using regex - much simpler approach
    const missingCharInfo = this.getMissingCharInfoSimple(value);
    if (!missingCharInfo) return value;

    // Insert the missing character at the correct position
    const { position, missingChar } = missingCharInfo;
    const beforeMissing = value.substring(0, position);
    const afterMissing = value.substring(position);
    
    // Set CSS custom properties for highlighting
    this.setMissingCharHighlight(index, position, missingChar.length);
    
    // Return the text with the missing character inserted
    return beforeMissing + missingChar + afterMissing;
  }


  /**
   * Escapes HTML special characters to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Simple method to find missing character using regex patterns
   */
  getMissingCharInfoSimple(value: string): { position: number; missingChar: string } | null {
    // Common patterns for missing characters
    const patterns = [
      { regex: /continuin(?!g)/, missingChar: 'g', position: (match: RegExpMatchArray) => match.index! + match[0].length },
      { regex: /runnin(?!g)/, missingChar: 'g', position: (match: RegExpMatchArray) => match.index! + match[0].length },
      { regex: /startin(?!g)/, missingChar: 'g', position: (match: RegExpMatchArray) => match.index! + match[0].length },
      { regex: /stoppin(?!g)/, missingChar: 'g', position: (match: RegExpMatchArray) => match.index! + match[0].length },
      { regex: /waitin(?!g)/, missingChar: 'g', position: (match: RegExpMatchArray) => match.index! + match[0].length },
      { regex: /loadin(?!g)/, missingChar: 'g', position: (match: RegExpMatchArray) => match.index! + match[0].length },
      { regex: /savin(?!g)/, missingChar: 'g', position: (match: RegExpMatchArray) => match.index! + match[0].length },
      { regex: /openin(?!g)/, missingChar: 'g', position: (match: RegExpMatchArray) => match.index! + match[0].length },
      { regex: /closin(?!g)/, missingChar: 'g', position: (match: RegExpMatchArray) => match.index! + match[0].length },
      { regex: /clickin(?!g)/, missingChar: 'g', position: (match: RegExpMatchArray) => match.index! + match[0].length },
      { regex: /typ(?!in)/, missingChar: 'in', position: (match: RegExpMatchArray) => match.index! + match[0].length },
      { regex: /writ(?!in)/, missingChar: 'in', position: (match: RegExpMatchArray) => match.index! + match[0].length },
      { regex: /read(?!in)/, missingChar: 'in', position: (match: RegExpMatchArray) => match.index! + match[0].length },
      { regex: /delet(?!in)/, missingChar: 'in', position: (match: RegExpMatchArray) => match.index! + match[0].length },
      { regex: /creat(?!in)/, missingChar: 'in', position: (match: RegExpMatchArray) => match.index! + match[0].length },
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern.regex);
      if (match) {
        return {
          position: pattern.position(match),
          missingChar: pattern.missingChar
        };
      }
    }

    return null;
  }

  /**
   * Sets CSS custom properties to highlight the missing character position
   */
  setMissingCharHighlight(index: number, position: number, charWidth: number): void {
    // Use setTimeout to ensure DOM is updated
    setTimeout(() => {
      const textareas = this.stepTextareas?.toArray();
      if (!textareas || !textareas[index]) return;

      const textarea = textareas[index].nativeElement;
      
      // Set CSS custom properties for character position and width
      textarea.style.setProperty('--char-position', position.toString());
      textarea.style.setProperty('--char-width', charWidth.toString());
    }, 0);
  }

  /**
   * Returns information about the missing character for an invalid step
   */
  getMissingCharInfo(index: number): { position: number; missingChar: string } | null {
    const stepFormGroup = this.stepsForm.at(index) as FormGroup;
    const value: string = stepFormGroup?.get('step_content')?.value || '';
    if (!value) return null;

    // Build a mask that marks quoted regions
    const quotedRanges: Array<[number, number]> = [];
    const quoteRegex = /".*?"/g;
    let m: RegExpExecArray | null;
    while ((m = quoteRegex.exec(value)) !== null) {
      quotedRanges.push([m.index, m.index + m[0].length]);
    }

    // Helper to check if position is inside quotes
    const isInQuotes = (pos: number) => quotedRanges.some(([s, e]) => pos >= s && pos < e);

    const sanitizedStep = value.replace(/".*?"/g, '').trim();
    if (!sanitizedStep) return null;

    // Prepare action candidates: remove prefixes and quoted parts to compare outside of quotes
    const candidates = (this.actions || []).map(a => {
      let name = a.action_name.trim();
      name = name.replace(/^(then|when|given|and|if)\s+/i, '');
      name = name.replace(/".*?"/g, '');
      return name.trim();
    }).filter(t => !!t);

    if (candidates.length === 0) return null;

    // Find best candidate by longest common prefix with sanitized step (case-sensitive)
    let best: { candidate: string; common: number } = { candidate: '', common: -1 };
    for (const c of candidates) {
      const common = this.getCommonPrefixLength(sanitizedStep, c);
      if (common > best.common) {
        best = { candidate: c, common };
      }
    }

    const mismatchIndex = best.common;
    if (mismatchIndex < 0 || mismatchIndex >= best.candidate.length) return null;

    // Get the expected character from the best matching action
    const expectedChar = best.candidate.charAt(mismatchIndex);
    if (!expectedChar || expectedChar === ' ') return null;

    // Map mismatch index back to the original string
    let realIndex = 0;
    let outsideCount = 0;
    for (let i = 0; i < value.length; i++) {
      if (!isInQuotes(i)) {
        if (outsideCount === mismatchIndex) { 
          realIndex = i; 
          break; 
        }
        outsideCount++;
      }
    }

    return { position: realIndex, missingChar: expectedChar };
  }

  private getCommonPrefixLength(a: string, b: string): number {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      if (a[i] !== b[i]) return i;
    }
    return len;
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
    this.logger.msg('4', '=== onAutocompleteOpened() === On Mat Autocomplete Opened Step Index:', 'step-editor', index);
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
      if (currentFocusedTextarea !== textarea) return;
    
      // Reset autocomplete filtering to show all actions for new steps
      const stepContent = this.stepsForm.at(stepIndex)?.get('step_content')?.value || '';
      if (!stepContent.trim()) {
        this.filteredGroupedActions$.next(this.getGroupedActions(this.actions));
      }
      
      const triggers = this.autocompleteTriggers?.toArray();
      const trigger = triggers?.[stepIndex];
      if (trigger && !trigger.panelOpen) {
        trigger.openPanel();
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
      step_content: ['', [Validators.required, CustomValidators.StepAction.bind(this)]],
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

  /**
   * Add a step from backup data
   */
  addStepFromBackup(stepData: any, index: number = -1): void {
    const template = this._fb.group({
      enabled: [stepData.enabled !== undefined ? stepData.enabled : true],
      screenshot: [stepData.screenshot || false],
      step_keyword: [stepData.step_keyword || 'Given'],
      compare: [stepData.compare || false],
      step_content: [stepData.step_content || '', [Validators.required]],
      step_action: [stepData.step_action || ''],
      step_type: [stepData.step_type || ''],
      continue_on_failure: [stepData.continue_on_failure || false],
      timeout: [stepData.timeout || this.department?.settings?.step_timeout || 60],
      selected: [false]
    });

    if (index >= 0) {
      this.stepsForm.insert(index, template);
    } else {
      this.stepsForm.push(template);
    }

    this._cdr.detectChanges();
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
      this._snackBar.open('Steps copied to clipboard!', 'OK', {
        panelClass: ['cometa-snackbar']
      });
    } else {
      this._snackBar.open('Error copying to clipboard.', 'OK', {
        panelClass: ['cometa-snackbar']
      });
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
      this._snackBar.open('There are no steps to export', 'OK', {
        panelClass: ['cometa-snackbar']
      });
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
        this._snackBar.open('Invalid JSON syntax', 'OK', {
          panelClass: ['cometa-snackbar']
        });
        return;
      }
      if (Array.isArray(stepsA)) {
        const length = stepsA.length;
        for (let i = 0; i < length; i++) {
          if (!stepsA[i].hasOwnProperty('step_content')) {
            this._snackBar.open('Invalid data properties', 'OK', {
              panelClass: ['cometa-snackbar']
            });
            return;
          }
        }
        this.setSteps(stepsA, false);
        (
          document.getElementsByClassName('upload_json')[0] as HTMLInputElement
        ).value = '';
        this._snackBar.open('Successfully imported steps!', 'OK', {
          panelClass: ['cometa-snackbar']
        });
      } else {
        this._snackBar.open('Invalid data', 'OK', {
          panelClass: ['cometa-snackbar']
        });
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
          this._snackBar.open('Invalid JSON syntax', 'OK', {
          panelClass: ['cometa-snackbar']
        });
          return;
        }
        if (Array.isArray(stepsA)) {
          const length = stepsA.length;
          for (let i = 0; i < length; i++) {
            if (!stepsA[i].hasOwnProperty('step_content')) {
              this._snackBar.open('Invalid data properties', 'OK', {
              panelClass: ['cometa-snackbar']
            });
              return;
            }
          }
          this.setSteps(stepsA, false);
          (
            document.getElementsByClassName(
              'upload_json'
            )[0] as HTMLInputElement
          ).value = '';
          this._snackBar.open('Successfully imported steps!', 'OK', {
          panelClass: ['cometa-snackbar']
        });
          this.scrollStepsToBottom();
        } else {
          this._snackBar.open('Invalid data', 'OK', {
          panelClass: ['cometa-snackbar']
        });
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


  // This is a function to check if the step is an API call step
  // It is used to show the collapsed API call in the step editor
  stepStates: { [key: number]: StepState } = {};
  isApiCallStep(index: number): boolean {
    // If uncommented, it will log the index infite times (Ng if of textarea doing this)
    // this.logger.msg('4', '=== isApiCallStep() === Index: ', 'step-editor', index);
    const content = this.stepsForm.controls[index]?.get('step_content')?.value;
    return content?.includes('Make an API call');
  }

  // This is a function to check if the step is being edited
  // It is used to show the API call dialog when the user clicks on the API call step
  isEditingApiCall(index: number): boolean {
    this.logger.msg('4', '=== isEditingApiCall() === Index: ', 'step-editor', index);
    return this.editingApiCallIndex === index;
  }

  // This is a function to expand the API call
  // It is used to show the API call dialog when the user clicks on the API call step
  expandApiCall(index: number): void {
    this.logger.msg('4', '=== expandApiCall() === Index: ', 'step-editor', index);
    this.editingApiCallIndex = index;
    this._cdr.detectChanges();
  }

  // This is a function to get the collapsed API call content
  // It is used to show the API call dialog when the user clicks on the API call step
  getCollapsedApiCall(index: number): string {
    const content = this.stepsForm.controls[index]?.get('step_content')?.value;
    this.logger.msg('4', `=== getCollapsedApiCall(${index}) === Content: "${content}"`, 'step-editor');
    if (!content) return '';
    return content;
  }

  // This is a function to edit the API call
  // It is used to show the API call dialog when the user clicks on the API call step
  editApiCall(item: any) {
    this.logger.msg('4', '=== editApiCall() === Item: ', 'step-editor', item);
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

    // Listen for scroll only in edit-feature dialog containers and component root
    // (Removed global window listener to avoid over-closing outside the dialog)
    const candidateSelectors = [
      '.edit-feature-panel',      // overlay pane of edit-feature dialog
      '.editFeatureContent'       // content of edit-feature dialog
    ];
    const nodeLists = candidateSelectors.map(sel => document.querySelectorAll(sel));
    nodeLists.forEach(list => {
      Array.from(list).forEach(el => {
        this.subs.sink = fromEvent(el as Element, 'scroll', { capture: true } as any)
          .subscribe(() => this._ngZone.run(() => this.closeAllOnScroll()));
      });
    });
    // Also listen on the component root element
    this.subs.sink = fromEvent(this._elementRef.nativeElement, 'scroll', { capture: true } as any)
      .subscribe(() => this._ngZone.run(() => this.closeAllOnScroll()));
    
    // Track mouse movement to update lastPointer
    this.subs.sink = fromEvent(document, 'mousemove', { capture: true } as any)
      .subscribe((event: any) => {
        this.lastPointer = {
          x: event.clientX,
          y: event.clientY,
          target: event.target
        };
      });
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
    if (event.shiftKey && this.lastEnableCheckedIndex !== null) {
      // Always set checked to true for shift+click multi-select
      const checked = true;
      const [start, end] = [this.lastEnableCheckedIndex, index].sort((a, b) => a - b); 
      for (let i = start; i <= end; i++) {
        this.stepsForm.at(i).get('compare')?.setValue(checked);
        // If compare is checked, ensure screenshot is also checked
        if (checked) {
          this.stepsForm.at(i).get('screenshot')?.setValue(true);
        }
      }
      event.preventDefault();
    }
    this.lastEnableCheckedIndex = index;
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
      optionsLength = this.getAllMobiles().length;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      // Navigate to next interactive mobile
      let attempts = 0;
      do {
        this.dropdownActiveIndex = (this.dropdownActiveIndex + 1) % optionsLength;
        attempts++;
      } while (attempts < optionsLength && !this.isMobileInteractive(this.getAllMobiles()[this.dropdownActiveIndex]));
      
      this._cdr.detectChanges();
      setTimeout(() => {
        const options = this.dropdownOptionRefs?.toArray();
        if (options && options[this.dropdownActiveIndex]) {
          options[this.dropdownActiveIndex].nativeElement.scrollIntoView({ block: 'nearest' });
        }
      }, 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      // Navigate to previous interactive mobile
      let attempts = 0;
      do {
        this.dropdownActiveIndex = (this.dropdownActiveIndex - 1 + optionsLength) % optionsLength;
        attempts++;
      } while (attempts < optionsLength && !this.isMobileInteractive(this.getAllMobiles()[this.dropdownActiveIndex]));
      
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
          const mobile = this.getAllMobiles()[this.dropdownActiveIndex];
          // Only allow selection if mobile is interactive
          if (this.isMobileInteractive(mobile)) {
            this.onMobileDropdownSelect(this.mobileDropdownType === 'code' ? mobile.hostname : mobile.image_name);
          }
        }
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation(); // Prevent dialog close
      this.closeMobileDropdown();
      this._cdr.detectChanges();
    }
    this._cdr.detectChanges();
  }

  activeOptionIndex: number = 0

  // Highlight the active option in the autocomplete panel
  setActiveOption(index: number) {
    this.logger.msg('4', '=== setActiveOption() === Set Active Option - Path', 'step-editor', index);
    this.activeOptionIndex = index;
  }


  /*
  * getStepContentAtIndex() - Get the step content at a specific index 
  * (generic function used by Shift+Alt+F and onFilePathSelect())
  *
  * @param index number
  * @returns string
  */
  getStepContentAtIndex(index: number) {
    this.logger.msg('4', '=== getStepContentAtIndex() === Get Step Content At Index: ', 'step-editor', index);
    const stepFormGroup = this.stepsForm.at(index) as FormGroup;
    const returnValue =  stepFormGroup.get('step_content')?.value;
    this.logger.msg('4', '=== getStepContentAtIndex() === Return Value: ', 'step-editor', returnValue);
    return returnValue;
  }

  /*
  * Creates a DIV like a mat autocomplete for the files name to be selected
  * Used for the file path autocomplete - trigger by <textarea (keydown.alt.shift.f)="createFilePathAutocomplete($event, i)">
  * Shift+Alt+F
  * 
  * @param $event KeyboardEvent
  * @param index number
  */
  createFilePathAutocomplete($event: KeyboardEvent, index: number) {

    // Store the index of the step that have the {file_path} - save because if (function onFilePathSelect) its called will be have any index
    this.currentFilePathStepIndex = index;

    this.logger.msg('4', '=== createFilePathAutocomplete() currentFilePathStepIndex ===', 'step-editor', this.currentFilePathStepIndex);

    // Hide the autocomplete panel
    const autocompletePanel = document.querySelector('.mat-optgroup');
    if (autocompletePanel) {
      (autocompletePanel as HTMLElement).style.display = 'none';
    }

    // Get the step content
    const stepContent = this.getStepContentAtIndex(index);
    this.logger.msg('4', '=== createFilePathAutocomplete() === Current Value: ', 'step-editor', stepContent);

    // get the Files for the Pop to be shown
    let files = [];
    if (stepContent.includes('on mobile')) { 
      // If step contains "on mobile", filter for APK files only
      files = this.department.files.filter(file => file.name.endsWith('.apk') && !file.is_removed);
    } else {
      // Otherwise, filter for non-APK files
      files = this.department.files.filter(file => !file.name.endsWith('.apk') && !file.is_removed);
    }

    // Create the options for the file Path Autocomplete
    const fileOptions = files.map(file => ({
      value: file.uploadPath, //complete path to be used in the step
      label: file.name, //friendly name to show to the user
      path: file.uploadPath //already have the full path
    }));

    // Show the file path autocomplete
    this.showFilePathAutocomplete = true;
    this.logger.msg('4', '=== createFilePathAutocomplete() === Show File Path Autocomplete', 'step-editor', this.showFilePathAutocomplete);

    // Update the autocomplete options (files)
    this.filePathAutocompleteOptions = fileOptions;
    this.logger.msg('4', '=== createFilePathAutocomplete() === File Path Autocomplete Options', 'step-editor', this.filePathAutocompleteOptions);
    
    // Calculate position and height dynamically
    this.calculateFilePathAutocompletePosition($event, index);
  }

  /**
   * Calculate file path autocomplete position at cursor location
   */
  calculateFilePathAutocompletePosition($event: KeyboardEvent, stepIndex: number) {
    const textarea = $event.target as HTMLTextAreaElement;
    
    // Find the position of {file_path} in the textarea
    const textareaValue = textarea.value;
    const filePathIndex = textareaValue.indexOf('{file_path}');
    
    if (filePathIndex === -1) {
      this.logger.msg('4', '=== calculateFilePathAutocompletePosition === {file_path} not found', 'step-editor');
      return;
    }

    // Calculate position exactly like variables do - get cursor coordinates
    const coords = this.getCaretCoordinates(textarea, filePathIndex);
    
    // Get the textarea position to add relative to document
    const textareaRect = textarea.getBoundingClientRect();
    
    // Calculate height based on number of files - limit maximum height
    const fileCount = this.filePathAutocompleteOptions.length;
    let panelHeight = 40; // Header height
    const maxHeight = 280; // Maximum height for the panel
    
    if (fileCount === 0) {
      panelHeight = 80; // Header + "No files found" message
    } else if (fileCount <= 4) {
      panelHeight = 40 + (fileCount * 48); // 48px per file + header
    } else {
      panelHeight = maxHeight; // Use maximum height with scroll
    }
    
    // Set position to cursor coordinates - absolute positioning
    const panel = this.filePathAutocompletePanel?.nativeElement;
    if (panel) {
      // Position above the textarea, but keep left aligned with cursor
      const top = textareaRect.top - panelHeight + 65; // 10px gap above the textarea
      const left = textareaRect.left + coords.left; // Keep left aligned with cursor position
      
      // Ensure panel doesn't go above viewport
      const finalTop = Math.max(10, top); // At least 10px from top of viewport
      
      // Set CSS custom properties for positioning
      panel.style.setProperty('--textarea-left', left + 'px');
      panel.style.setProperty('--textarea-top', finalTop + 'px');
      panel.style.setProperty('--textarea-height', panelHeight + 'px');
      
      this.logger.msg('4', '=== calculateFilePathAutocompletePosition === Calculated position:', 'step-editor', { 
        top: finalTop, 
        left, 
        panelHeight, 
        fileCount,
        textareaRect: { top: textareaRect.top, left: textareaRect.left, width: textareaRect.width }
      });
    }
  }

  // Handle file selection from autocomplete
  // Replaces the apk file to apk path
  onFilePathSelect(event: any, index: number) {
    this.logger.msg('4', '=== onFilePathSelect() === Selected File Path: ', 'step-editor', event.option.value);

    // Get the selected file path
    const selectedFilePath = event.option.value; 

    this.logger.msg('4', '=== onFilePathSelect() === Index from onFilePathSelect: ', 'step-editor', index);
    
    // Replace {file_path} with the selected file path
    const currentValue = this.getStepContentAtIndex(index);
    this.logger.msg('4', '=== onFilePathSelect() === Current Value: ', 'step-editor', currentValue);
    
    let newValue: string;

    // Replace the path in steps with the word "file" 
    // ... if nothing is found, anyhow the newvalue will contain the current value of the steps for further processing
    const filePathRegex = /file\s*("[^"]*") sheet/g;
    newValue = currentValue.replace(filePathRegex, `file "${selectedFilePath}" sheet`);

    // Replace the path in steps with the word "app"
    const appRegex = /app\s*("[^"]*") on mobile/g;
    newValue = newValue.replace(appRegex, `app "${selectedFilePath}" on mobile`);

    this.logger.msg('4', '=== onFilePathSelect() === New Value after regex replacements: ', 'step-editor', newValue);

    // Set the new value to the textarea (newValue)
    if (newValue !== undefined) {
      this.stepsForm.at(index).get('step_content')?.setValue(newValue);
    }
  
    // Close the autocomplete panel
    this.showFilePathAutocomplete = false;
    // Clear the stored index
    this.currentFilePathStepIndex = null;

    // Store the selected file path for this step to enable future div (autocomplte) triggers
    // This allows users to modify previously selected files in the same step
    // See in th elogs who is working put this in the filter 'onStepTextareaClick()'
    this.lastSelectedFilePaths.set(index, selectedFilePath);
  }

  // Show the autocomplete if cursor focus in the {file_path} area
  onTextareaFocusFilePath(event: FocusEvent, index: number) {
    const textarea = event.target as HTMLTextAreaElement;
    const cursorPos = textarea.selectionStart;
    const content = textarea.value;

    const beforeCursor = content.substring(0, cursorPos);
    const afterCursor = content.substring(cursorPos);

    this.logger.msg('4', '=== onTextareaFocusFilePath() === Before Cursor: ', 'step-editor', beforeCursor);
    this.logger.msg('4', '=== onTextareaFocusFilePath() === After Cursor: ', 'step-editor', afterCursor);
    
    // file match (browser)
    const filePattern = /file\s*"([^"]*)$/;

    // app match (mobile)
    const appPattern = /app\s*"([^"]*)$/;

    this.logger.msg('4', '=== onTextareaFocusFilePath() === File Pattern: ', 'step-editor', filePattern);
    this.logger.msg('4', '=== onTextareaFocusFilePath() === App Pattern: ', 'step-editor', appPattern);     
    
    // file match (browser)
    const fileMatch = beforeCursor.match(filePattern);

    // app match (mobile)
    const appMatch = beforeCursor.match(appPattern);

    this.logger.msg('4', '=== onTextareaFocusFilePath() === File Match: ', 'step-editor', fileMatch);
    this.logger.msg('4', '=== onTextareaFocusFilePath() === App Match: ', 'step-editor', appMatch);
    
    if (fileMatch || appMatch) {
      // Check if there's a closing quote after cursor
      const hasClosingQuote = afterCursor.includes('"'); //Example:  Read text excelfile "text... -->(")
      this.logger.msg('4', '=== onTextareaFocusFilePath() === Has Closing Quote: ', 'step-editor', hasClosingQuote);
      if (hasClosingQuote) { //if closed, show the autocomplete
        this.createFilePathAutocomplete(event as any, index);
      }
    }
  }

  // Close the file path autocomplete panel
  closeFilePathAutocomplete(): void {
    this.showFilePathAutocomplete = false;
  }

  // Method to close variable dropdown
  closeVariableDropdown(): void {
    this.displayedVariables = [];
    this.stepVariableData.currentStepIndex = null;
    this._cdr.detectChanges();
  }

  private closeAllOnScroll(): void {
    // Only skip closing if the pointer is currently inside our own dropdown panels
    const pointerTarget = (this.lastPointer?.target || null) as (Node | null);

    // Angular Material autocomplete panel
    const autoPanelEl = document.querySelector('.mat-autocomplete-panel') as HTMLElement | null;

    // File-path autocomplete panel
    const filePanelEl = this.filePathAutocompletePanel?.nativeElement as (HTMLElement | undefined);

    // Variable dialog - look for the visible one, not the hidden one
    const variablePanelEl = document.querySelector('.custom-variable-autocomplete-panel.visible') as HTMLElement | null;

    // Context menu panel
    const contextMenuEl = document.querySelector('.ngx-contextmenu.step-contect-menu') as HTMLElement | null;

    // Mobile dropdown panel
    const mobilePanelEl = document.querySelector('.custom-mobile-autocomplete-panel.visible') as HTMLElement | null;

    // LOGIC to check if the pointer is inside the dropdown panels
    const insideAuto = !!(pointerTarget && autoPanelEl && autoPanelEl.contains(pointerTarget));
    const insideFile = !!(pointerTarget && filePanelEl && filePanelEl.contains(pointerTarget));
    const insideContextMenu = !!(pointerTarget && contextMenuEl && contextMenuEl.contains(pointerTarget));
    const insideVariable = !!(pointerTarget && variablePanelEl && variablePanelEl.contains(pointerTarget));
    // Check if mobile dropdown is open and pointer is inside it
    const insideMobile = !!(pointerTarget && mobilePanelEl && mobilePanelEl.contains(pointerTarget));
    
    if (insideAuto || insideFile || insideContextMenu || insideVariable || insideMobile) {
      return; 
    }

    // Close any open Material autocomplete panels across all triggers (handles newly added steps)
    const triggers = this.autocompleteTriggers?.toArray() || [];
    triggers.forEach(t => { if (t.panelOpen) { t.closePanel(); } }); 

    // Custom file path panel
    if (this.showFilePathAutocomplete) {
      this.showFilePathAutocomplete = false;
      this._cdr.detectChanges();
    }

    // Close context menu by hiding it
    if (contextMenuEl) {
      (contextMenuEl as HTMLElement).style.display = 'none';
    }

    // Close variable dialog by resetting Angular state
    if (this.displayedVariables.length > 0) {
      this.closeVariableDropdown();
    }

    // Close mobile dropdown by resetting Angular state
    if (this.showMobileDropdown) {
      this.closeMobileDropdown();
    }

  }
  
}

