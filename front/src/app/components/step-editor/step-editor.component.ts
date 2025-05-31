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
  ComponentFactoryResolver
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
  ],
})
export class StepEditorComponent extends SubSinkAdapter implements OnInit {
  stepsForm: UntypedFormArray;

  @ViewSelectSnapshot(ActionsState) actions: Action[];
  @ViewSelectSnapshot(UserState) user!: UserInfo;
  @Output() textareaFocusToParent = new EventEmitter<boolean>();

  @Input() feature: Feature;
  @Input() name: string;
  @Input() mode: 'new' | 'edit' | 'clone';
  @Input() variables: VariablePair[];
  @Input() department: Department;

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
    private _sharedActions: SharedActionsService,
  ) {
    super();
    this.stepsForm = this._fb.array([]);
  }

  @ViewSelectSnapshot(UserState.RetrieveUserDepartments) 

  // departments$ = this._store.select(UserState.RetrieveUserDepartments);
  departments$!: Department[];
  @Select(DepartmentsState) allDepartments$: Observable<Department[]>;
  @Select(FeaturesState.GetFeaturesAsArray) allFeatures$: Observable<Feature[]>;

  // Shortcut emitter to parent component
  sendTextareaFocusToParent(isFocused: boolean, index?: number): void {
    this.textareaFocusToParent.emit(isFocused);

    if (index === undefined) {
      return;
    }

    // Esto hace que aparezca o desaparezca la guía de IA
    if (isFocused) {
      // Hacer visible el paso en la UI
      this.stepVisible[index] = true;

      const stepFormGroup = this.stepsForm.at(index) as FormGroup;

      const stepAction = stepFormGroup.get('step_action')?.value;
      const stepContent = stepFormGroup.get('step_content')?.value;

      if (stepContent === undefined) {
        // Limpiar la descripción y ejemplos si el contenido está vacío
        this.descriptionText = '';
        this.examplesText = '';
        this._cdr.detectChanges();
        return;
      }

      const activatedAction = this.actions.find(action =>
        action.action_name === stepAction
      );

      if (activatedAction) {
        // Asignar título y descripción de la acción seleccionada
        this.selectedActionTitle = activatedAction.action_name;
        this.selectedActionDescription = activatedAction.description;

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

        // Actualizar la documentación del paso correspondiente
        const currentIndex = this.stepsForm.value.findIndex(step => step.step_action === stepAction);
        if (currentIndex !== -1) {
          this.stepsDocumentation[currentIndex] = {
            description: this.descriptionText,
            examples: this.examplesText
          };
        }

        this._cdr.detectChanges();
      }
    } else {
      if (index !== undefined) {
        this.stepVisible[index] = false;
      }
    }
  }

  setSteps(steps: FeatureStep[], clear: boolean = true) {
    if (clear) this.stepsForm.clear();
    steps.forEach(step => {
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
        timeout: step.timeout || this.department?.settings?.step_timeout || 60
      });



      this.stepsForm.push(formGroup);
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
    
    this.subs.sink = this._store
      .select(CustomSelectors.GetFeatureSteps(featureId))
      .subscribe(steps => {
        // Ensure compare is disabled initially
        const stepsWithCompareDisabled = steps.map(step => ({
          ...step,
          compare: step.screenshot ? step.compare : false // Only allow compare if there is screenshot
        }));
        this.setSteps(stepsWithCompareDisabled);
      });

    // When steps$ is changed do the rollup of duplicated steps
    this.subs.sink = this.stepsForm.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(stepsArray => this.rollupDuplicateSteps(stepsArray));

    // insert default step if currently viewed feature, is new and still not created
    if (this.feature.feature_id === 0) {
      this.insertDefaultStep();
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
    event.stopImmediatePropagation();
    this.stepVariableData.currentStepIndex = null;
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
    // If this is an API call step, expand it for editing
    if (this.isApiCallStep(index)) {
      this.editingApiCallIndex = index;
      this._cdr.detectChanges();
    }
    this.sendTextareaFocusToParent(true, index);
  }

  // removes variable flyout on current step row, when keydown TAB event is fired
  onTextareaTab(i: number) {
    if (this.stepVariableData.currentStepIndex === i) {
      this.stepVariableData.currentStepIndex = null;
    }
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

    if (!textareaValue) {
      this.stepsDocumentation[index] = {
        description: '',
        examples: ''
      };
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
    // Obtain the value of the selected step
    const step = event.option.value;

    // Make the step visible in the UI for the specified index
    this.stepVisible[index] = true;

    const cleanedStep = step.replace(/Parameters:([\s\S]*?)Example:/gs, '').trim();

    // We use a regular expression to extract the action name and the variable
    const matchResult = step.match(/^(.*?)\s*"(.*?)"/);
    if (matchResult) {
      const actionName = matchResult[1].trim();

      // Search for the corresponding action using the action name
      const activatedAction = this.actions.find(action =>
        action.action_name.split('"')[0].trim() === actionName
      );

      // Access the specific FormGroup for this step in the list of forms
      const stepFormGroup = this.stepsForm.at(index) as FormGroup;

      // Update the value of "step_action" in the FormGroup
      stepFormGroup.patchValue({ step_action: activatedAction.action_name });

      // Update the documentation for this step
      this.selectedActionTitle = activatedAction.action_name;
      this.selectedActionDescription = activatedAction.description;

      // Clean the <br> tags from the description
      this.selectedActionDescription = this.selectedActionDescription.replace(/<br\s*\/?>/gi, '');

      // Separate the description and examples if necessary
      if (this.selectedActionDescription.includes("Example")) {
        const parts = this.selectedActionDescription.split("Example:");
        this.descriptionText = parts[0].trim();
        this.examplesText = parts[1]?.trim() || '';
      } else {
        this.descriptionText = this.selectedActionDescription;
        this.examplesText = '';
      }

      // Store the documentation for the current step
      this.stepsDocumentation[index] = {
        description: this.descriptionText,
        examples: this.examplesText
      };

      this._cdr.detectChanges();
    }

    // Get the corresponding textarea and select the first parameter
    const input = this._elementRef.nativeElement.querySelectorAll('textarea.code')[index] as HTMLInputElement;
    const parameterRegex = /\{[a-z\d\-_\s]+\}/i;
    const match = parameterRegex.exec(step);
    if (match) {
      this._ngZone.runOutsideAngular(() =>
        input.setSelectionRange(match.index, match.index + match[0].length)
      );
    }

    this._cdr.detectChanges();
  }


  selectedActionTitle: string = '';
  selectedActionDescription: string = '';
  descriptionText: string = '';
  examplesText: string = '';
  showHideStepDocumentation: boolean = true;

  onOptionActivated(event: MatAutocompleteActivatedEvent, index): void {
    if (event && event.option) {
      const activatedActionName = event.option.value;

      const activatedAction = this.actions.find(action => action.action_name === activatedActionName);
      if (activatedAction) {
        // Asignar los valores de la acción seleccionada
        this.selectedActionTitle = activatedAction.action_name;
        this.selectedActionDescription = activatedAction.description;

        // Limpiar las etiquetas <br> de la descripción
        this.selectedActionDescription = this.selectedActionDescription.replace(/<br\s*\/?>/gi, '');

        // Separar la descripción y los ejemplos si es necesario
        if (this.selectedActionDescription.includes("Example")) {
          const parts = this.selectedActionDescription.split("Example:");

          // Guardar la descripción y ejemplos por separado
          this.descriptionText = parts[0].trim();
          this.examplesText = parts[1]?.trim() || '';

        } else {
          this.descriptionText = this.selectedActionDescription;
          this.examplesText = '';
        }

        // Aquí puedes agregar la actualización de la documentación para este paso
        // Si tienes un arreglo de `stepsDocumentation`, puedes almacenarlo aquí también
        this.stepsDocumentation[index] = {
          description: this.descriptionText,
          examples: this.examplesText
        };

        this._cdr.detectChanges();
      }
    }
  }


  toggleShowHideDoc() {
    this.showHideStepDocumentation = !this.showHideStepDocumentation
  }

  @ViewChild(MatAutocompleteTrigger) autocompleteTrigger!: MatAutocompleteTrigger;


  // @HostListener('document:keydown', ['$event'])
  // handleKeydown(event: KeyboardEvent): void {
  //   if (event.keyCode === KEY_CODES.ESCAPE) {
  //     this.closeAutocomplete();
  //   }
  // }

  iconPosition = { top: 0, left: 0 };

  focusedIndex: number | null = null;
  stepVisible: boolean[] = [];

  closeAutocomplete(index?: number) {
    const stepFormGroup = this.stepsForm.at(index) as FormGroup;
    const stepContent = stepFormGroup.get('step_content')?.value;
    if (stepContent == '') {
      this.stepsDocumentation[index] = {
        description: '',
        examples: ''
      };
    }

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

  onAutocompleteOpened(index?: number) {
    this.stepVisible[index] = true;
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


  addEmpty(index: number = -1) {
    const template = this._fb.group({
      enabled: [true],
      screenshot: [false],
      step_keyword: ['Given'],
      compare: [false],
      step_content: ['', [Validators.required]],
      step_action: [''],
      step_type: [''],
      continue_on_failure: [false],
      timeout: [this.department?.settings?.step_timeout || 60]
    });



    if (index >= 0) {
      this.stepsForm.insert(index, template);
    } else {
      this.stepsForm.push(template);
    }

    this._cdr.detectChanges();
    
    // Focus the new step
    const stepIndex = index >= 0 ? index : this.stepsForm.length - 1;
    this.focusStep(stepIndex);
  }

  copyItem(index: number, position: string) {
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
      this.selectedActionDescription = activatedAction.description;

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
  }

  drop(event: CdkDragDrop<string[]>) {
    // if (this.stepVisible.length > 0) {
    //   this.stepVisible = this.stepVisible.map(() => false);
    // } else {
    //   console.warn('stepVisible está vacío');
    // }
    const panel = document.querySelector('.stepContainer');
    if (panel) {
      this.renderer.removeChild(document.body, panel);
    }

    const control = this.stepsForm.controls[event.previousIndex];
    this.stepsForm.removeAt(event.previousIndex);
    this.stepsForm.insert(event.currentIndex, control);

    this._cdr.detectChanges();
  }


  deleteStep(i: number) {
    this.stepsForm.removeAt(i);
    this._cdr.detectChanges();
  }

  focusStep(childIndex) {
    setTimeout(_ => {
      try {
        document
          .querySelector(
            `.mat-dialog-content .step-row:nth-child(${childIndex + 1})`
          )
          .scrollIntoView({ block: 'center', behavior: 'smooth' });
        (
          document.querySelector(
            `.mat-dialog-content .step-row:nth-child(${childIndex + 1}) .code`
          ) as HTMLInputElement
        ).focus();
      } catch (err) {}
    }, 0);
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
      timeout: [this.department?.settings?.step_timeout || 60]
    });


    this.stepsForm.push(defaultStep);
  }

  insertStep(event: KeyboardEvent, i: number){
    event.preventDefault();
    if(event.key == 'ArrowDown'){
      this.addEmpty(i+1);
    }
    else if (event.key == 'ArrowUp'){
      this.addEmpty(i);
    }
  }

  copyStep(event: KeyboardEvent, i: number){
    event.preventDefault();
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
        // control.get('compare')?.setValue(false);
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

}
