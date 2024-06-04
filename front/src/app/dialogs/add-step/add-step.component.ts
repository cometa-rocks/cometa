import {
  Component,
  Inject,
  ViewEncapsulation,
  Output, 
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';
import { EnterValueComponent } from '@dialogs/enter-value/enter-value.component';
import { EditFeature } from '@dialogs/edit-feature/edit-feature.component';
import {
  MatLegacyDialogRef as MatDialogRef,
  MatLegacyDialog as MatDialog,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { Select } from '@ngxs/store';
import { ActionsState } from '@store/actions.state';
import { BehaviorSubject, forkJoin, Observable } from 'rxjs';
import { FilterStepPipe } from '@pipes/filter-step.pipe';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { NgIf, NgFor, AsyncPipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';

@Component({
  selector: 'add-step',
  templateUrl: './add-step.component.html',
  styleUrls: ['./add-step.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fontSize', [
      state('false', style({ 'font-size': '0px' })),
      state('true', style({ 'font-size': '16px' })),
      transition('* => *', animate(100)),
    ]),
  ],
  standalone: true,
  imports: [
    EditFeature,
    MatLegacyDialogModule,
    MatLegacyFormFieldModule,
    MatLegacyInputModule,
    ReactiveFormsModule,
    FormsModule,
    NgIf,
    MatLegacyButtonModule,
    MatIconModule,
    NgFor,
    MatLegacyTooltipModule,
    MatLegacyCheckboxModule,
    AsyncPipe,
    FilterStepPipe,
  ],
})
export class AddStepComponent {
  @Select(ActionsState) actions$: Observable<Action[]>;
  @Output() textareaFocusToParent = new EventEmitter<boolean>();

  constructor(
    public dialogRef: MatDialogRef<AddStepComponent>,
    private dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  currentStep: Action = {
    action_id: 0,
    action_name: '',
    application: '',
    compare: false,
    date_created: '',
    department: '',
    description: '',
    values: 0,
  };

  // Shortcut emitter to parent component
  public sendTextareaFocusToParent(isFocused: boolean) {
    this.textareaFocusToParent.emit(isFocused);
    console.log("Aqui esto" + isFocused);
  }

  getStep(action: Action) {
    const values = [];
    const subscribers: Observable<any>[] = [];
    const newReplacements = action.action_name.match(/\{.*?\}/g);
    if (!!newReplacements) {
      newReplacements.reverse().forEach(match => {
        const word = match.slice(1, -1);
        subscribers.push(
          this.dialog
            .open(EnterValueComponent, {
              backdropClass: 'transparent',
              disableClose: true,
              autoFocus: true,
              panelClass: 'enter-value-panel',
              data: {
                word: word,
                value: '',
              },
            })
            .afterClosed()
        );
      });
      forkJoin([...subscribers]).subscribe(res => {
        res.forEach(value => {
          values.push({ word: value.word, value: value.value });
        });
        let newStepStatement = action.action_name;
        let newStepStatement_protected = action.action_name;
        values.forEach(value => {
          newStepStatement = newStepStatement.replace(
            '{' + value.word + '}',
            value.value
          );
          switch (value.word) {
            case 'password':
            case 'pin':
              newStepStatement_protected = newStepStatement_protected.replace(
                '{' + value.word + '}',
                value.value.replace(/./g, '*')
              );
              break;
            default:
              newStepStatement_protected = newStepStatement_protected.replace(
                '{' + value.word + '}',
                value.value
              );
          }
        });
        this.fontSize.next(false);
        setTimeout(() => {
          this.currentStep = action;
          this.currentStep.interpreted = newStepStatement;
          this.step = newStepStatement;
          this.step_protected = newStepStatement_protected;
          setTimeout(() => {
            this.fontSize.next(true);
          }, 100);
        }, 100);
      });
    } else {
      this.fontSize.next(false);
      setTimeout(() => {
        this.currentStep = action;
        this.currentStep.interpreted = action.action_name;
        this.step = action.action_name;
        this.step_protected = action.action_name;
        setTimeout(() => {
          this.fontSize.next(true);
        }, 100);
      }, 100);
    }
  }

  fontSize = new BehaviorSubject<boolean>(true);

  step = '';
  step_protected = '';

  search = '';

  screenshot = false;
  compare = false;

  screenshotChange(event) {
    if (!event) this.compare = false;
  }

  triggerCheckboxes() {
    this.currentStep.screenshot = this.screenshot;
    this.currentStep.compare = this.compare;
  }

  returnResponse() {
    this.triggerCheckboxes();
    this.currentStep.text = this.step;
    return { ...this.currentStep };
  }


}
