import { Component, OnInit, ChangeDetectionStrategy, Input, ChangeDetectorRef, Host, ElementRef, NgZone, ViewChild } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { AddStepComponent } from '@dialogs/add-step/add-step.component';
import { MatDialog , MatDialogRef } from '@angular/material/dialog';
import { ApiService } from '@services/api.service';
import { Store } from '@ngxs/store';
import { ActionsState } from '@store/actions.state';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClipboardService } from 'ngx-clipboard';
import { ImportJSONComponent } from '@dialogs/import-json/import-json.component';
import { BehaviorSubject, debounceTime, distinctUntilChanged, forkJoin, of } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { UntypedFormArray, UntypedFormBuilder, Validators } from '@angular/forms';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { UserState } from '@store/user.state';
import { CustomValidators } from '@others/custom-validators';
import { exportToJSONFile, SubSinkAdapter } from 'ngx-amvara-toolbox';
import { EditFeature } from '@dialogs/edit-feature/edit-feature.component';
import { MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { AreYouSureData, AreYouSureDialog } from '@dialogs/are-you-sure/are-you-sure.component';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { VariablesState } from '@store/variables.state';

@Component({
  selector: 'cometa-step-editor',
  templateUrl: './step-editor.component.html',
  styleUrls: ['./step-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StepEditorComponent extends SubSinkAdapter implements OnInit {

  stepsForm: UntypedFormArray;

  @ViewSelectSnapshot(ActionsState) actions: Action[];
  @ViewSelectSnapshot(UserState) user !: UserInfo;

  @Input() feature: Feature;
  @Input() name: string;
  @Input() mode: 'new' | 'edit' | 'clone';
  @Input() variables: VariablePair[];

  displayedVariables: (VariablePair | string)[] = [];
  stepVariableData = <VariableInsertionData>{};

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
    @Host() public readonly _editFeature: EditFeature
  ) {
    super();
    this.stepsForm = this._fb.array([]);
  }

  setSteps(steps: FeatureStep[], clear: boolean = true) {
    if (clear) this.stepsForm.clear();
    steps.forEach(step => {
      this.stepsForm.push(
        this._fb.group({
          enabled: step.enabled,
          screenshot: step.screenshot,
          step_keyword: step.step_keyword,
          compare: step.compare,
          step_content: [step.step_content, CustomValidators.StepAction.bind(this)],
          step_type: step.step_type,
          continue_on_failure: step.continue_on_failure,
          timeout: step.timeout || this._fb.control(60, Validators.compose([Validators.min(1), Validators.max(1000), Validators.maxLength(4)]))
        })
      )
    })
    this._cdr.detectChanges();
  }

  getSteps(): FeatureStep[] {
    return this.stepsForm.controls.map(control => control.value);
  }

  ngOnInit() {
    // @ts-ignore
    if (!this.feature) this.feature = { feature_id: 0 };
    const featureId = this.mode === 'clone' ? 0 : this.feature.feature_id;
    this.subs.sink = this._store.select(CustomSelectors.GetFeatureSteps(featureId)).subscribe(steps => this.setSteps(steps));
    // When steps$ is changed do the rollup of duplicated steps
    this.subs.sink = this.stepsForm.valueChanges
                                   .pipe(debounceTime(500),distinctUntilChanged())
                                   .subscribe(stepsArray => this.rollupDuplicateSteps(stepsArray));
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
        const urlRegex = /(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#()?&//=]*)/;
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

  onArrowKey(event: Event, direction: string) {
    event.preventDefault();
    const ev = event as any;
    direction === 'down' ?
                  ev.target.nextElementSibling ?
                  ev.target.nextElementSibling.focus() : null
                  :
                  ev.target.previousElementSibling ?
                  ev.target.previousElementSibling.focus() : null
  }

  // when escape is clicked, prevent parent dialog from closing and removes variable flyout
  onStepEscape(event: Event) {
    event.stopImmediatePropagation();
    this.stepVariableData.currentStepIndex = null;
  }

  // removes variable flyout if clicked target on focusout event is not one of the variables
  onStepFocusOut(event: FocusEvent) {
    event.preventDefault();

    const ev = event as any;
    if (!ev.relatedTarget?.attributes.id)  this.stepVariableData.currentStepIndex = null;
  }

  // removes variable flyout on current step row, when keydown TAB event is fired
  onTab(i: number) {
    if ( this.stepVariableData.currentStepIndex === i) {
      this.stepVariableData.currentStepIndex = null;
    }
  }

  onStepChange(event, index: number) {
    this.displayedVariables = [];
    this.stepVariableData = {};

    // sets the index of currently being edited step row
    this.stepVariableData.currentStepIndex = index;

    // gets cursor position on text area
    this.stepVariableData.selectionIndex = event.target.selectionStart;

    // gets whole textarea value
    this.stepVariableData.stepValue = event.target.value as string;

    // gets the position of nearest left and right quotes taking current cursor position as startpoint index
    this.stepVariableData.quoteIndexes = this.getQuoteIndexes(this.stepVariableData.stepValue, this.stepVariableData.selectionIndex);

    // return if left quote or right quote index is undefined
    if(!this.stepVariableData.quoteIndexes.next || !this.stepVariableData.quoteIndexes.prev) return;

    // gets the string between quotes(including quotes)
    this.stepVariableData.strToReplace = this.stepVariableData.stepValue.substring(this.stepVariableData.quoteIndexes.prev, this.stepVariableData.quoteIndexes.next);

    // removes quotes
    this.stepVariableData.strWithoutQuotes = this.stepVariableData.strToReplace.replace(/"/g, '').trim();

    // if the string without quotes contains dollar char, removes it and then the rest of the string is used to filter variables by name
    if (this.stepVariableData.strWithoutQuotes.includes('$')) {
      const strWithoutDollar = this.stepVariableData.strWithoutQuotes.replace('$','')

      const filteredVariables = this.variables.filter(item => item.variable_name.includes(strWithoutDollar));
      this.displayedVariables = filteredVariables.length > 0 ? filteredVariables : ["No variable with this name"];
    }
  }

  onClickVariable(variable_name: string, index: number) {
    let step = this.stepsForm.at(index).get('step_content');
    step.setValue(step.value.replace(this.stepVariableData.strWithoutQuotes, `$${variable_name}`))

    this.stepVariableData.currentStepIndex = null;
  }

  // returns the index of nearest left and right " char in string, taking received startIndex as startpoint reference
  getQuoteIndexes(str, startIndex) {
    let prevQuoteIndex = getPrev();
    let nextQuoteIndex = getNext();

    // returns the index of the nearest " after received index
    function getNext() {
      for(let i = startIndex; i<str.length; i++) {
        if (str[i] === '"')  return i + 1;
      }
    }

    // returns the index of the nearest " before received index
    function getPrev() {
      for(let i = startIndex-1; i >=0; i--) {
        if (str[i] === '"') return i;
      }
    }

    return { prev: prevQuoteIndex, next: nextQuoteIndex };
  }

  /**
   * Triggered when the user selects a step from the Autocomplete feature
   * @param event MatAutocompleteSelectedEvent
   * @param index Index of the current step
   */
  selectFirstVariable(event: MatAutocompleteSelectedEvent, index: number) {
    const step = event.option.value;
    // Get current step input
    const input = this._elementRef.nativeElement.querySelectorAll('textarea.code')[index] as HTMLInputElement;
    // Get where the first parameter starts and ends
    const parameterRegex = /\{[a-z\d\-_\s]+\}/i;
    const match = parameterRegex.exec(step);
    if (match) {
      // Select first parameter
      this._ngZone.runOutsideAngular(() => input.setSelectionRange(match.index, match.index + match[0].length));
    }
  }

  // Automatically adds http:// if URL doesn't contain it
  addhttp(url: string) {
    if (!/^(?:f|ht)tps?\:\/\//.test(url)) {
      url = "http://" + url;
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
          if(!this.realizedRequests.includes(id)) {
            this.realizedRequests.push(id);
            return this._api.getFeatureSteps(id)
          } else {
            return of([])
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
              if (!importsSteps.includes(step.step_content)) importsSteps.push(step.step_content);
            });
          }
        });
        this.importsSteps$.next(importsSteps);
      }
    }
  }

  importsSteps$ = new BehaviorSubject<string[]>([]);

  removeAll() {
    this._dialog.open(AreYouSureDialog, {
      data: {
        title: 'translate:you_sure.remove_all_title',
        description: 'translate:you_sure.remove_all'
      } as AreYouSureData
    }).afterClosed().subscribe(exit => {
      // Close edit feature popup
      if (exit) {
        this.stepsForm.clear();
        this._cdr.detectChanges();
      }
    });
  }

  add() {
    this._dialog.open(AddStepComponent, {
      panelClass: 'add-step-panel',
      autoFocus: true,
      disableClose: true,
      data: {
        templates: false
      }
    }).afterClosed().subscribe((res: Action) => {
      if (res) {
        this.stepsForm.push(
          this._fb.group({
            enabled: true,
            screenshot: res.screenshot,
            step_keyword: 'Given',
            compare: res.compare,
            step_content: [res.interpreted, CustomValidators.StepAction.bind(this)],
            continue_on_failure: false,
            timeout: this._fb.control(60, Validators.compose([Validators.min(1), Validators.max(1000), Validators.maxLength(4)]))
          })
        )
        this._cdr.detectChanges();
        this.focusStep(this.stepsForm.length - 1);
      }
    });
  }

  addEmpty(index: number = null) {
    const template = this._fb.group({
      compare: false,
      screenshot: false,
      step_keyword: 'Given',
      step_content: ['', CustomValidators.StepAction.bind(this)],
      enabled: true,
      continue_on_failure: false,
      timeout: this._fb.control(60, Validators.compose([Validators.min(1), Validators.max(1000), Validators.maxLength(4)]))
    });
    if (index !== null) {
      this.stepsForm.insert(index, template);
    } else {
      this.stepsForm.push(template)
    }
    this._cdr.detectChanges();
    if (index !== null) {
      this.focusStep(index);
    } else {
      this.focusStep(this.stepsForm.length - 1);
    }
  }

  copyItem(index: number, position: string) {
    const stepToCopy = position === 'up' ? this.stepsForm.controls[index] : this.stepsForm.controls[index - 1];
    // Recreate step, if process is not done, copied steps would be synced by reference
    const newStepToCopy = this._fb.group({
      compare: stepToCopy.value.compare,
      screenshot: stepToCopy.value.screenshot,
      step_keyword: stepToCopy.value.step_keyword,
      step_content: [stepToCopy.value.step_content, CustomValidators.StepAction.bind(this)],
      enabled: stepToCopy.value.enabled,
      continue_on_failure: stepToCopy.value.continue_on_failure,
      timeout: stepToCopy.value.timeout
    })
    this.stepsForm.insert(index, newStepToCopy);
    this._cdr.detectChanges();
  }

  drop(event: CdkDragDrop<string[]>) {
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
        document.querySelector(`.mat-dialog-content .step-row:nth-child(${childIndex + 1})`).scrollIntoView({ block: 'center', behavior: 'smooth' });
        (document.querySelector(`.mat-dialog-content .step-row:nth-child(${childIndex + 1}) .code`) as HTMLInputElement).focus();
      } catch (err) { }
    }, 0);
  }

  scrollStepsToBottom(focusLastStep: boolean = false) {
    setTimeout(_ => {
      try {
        document.querySelector(`.mat-dialog-content .step-row:last-child`).scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => {
          if (focusLastStep) {
            (document.querySelector(`.mat-dialog-content .step-row:last-child .code`) as HTMLInputElement).focus();
          }
        }, 500);
      } catch (err) { }
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
      exportToJSONFile(this.feature.feature_name || this.name ||'Unnamed', this.getSteps());
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
        (document.getElementsByClassName('upload_json')[0] as HTMLInputElement).value = '';
        this._snackBar.open('Successfully imported steps!', 'OK');
      } else {
        this._snackBar.open('Invalid data', 'OK');
        return;
      }
    };
    reader.readAsText(file);
  }

  importClipboard() {
    const ref = this._dialog.open(ImportJSONComponent);
    ref.afterClosed().subscribe(success => {
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
          (document.getElementsByClassName('upload_json')[0] as HTMLInputElement).value = '';
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
    if (!event.checked) {
      this.stepsForm.at(i).get('compare').setValue(false);
    }
  }

}
