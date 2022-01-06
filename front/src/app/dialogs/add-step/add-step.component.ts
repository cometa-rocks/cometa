import { Component, Inject, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { EnterValueComponent } from '@dialogs/enter-value/enter-value.component';
import { MatDialogRef, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Select } from '@ngxs/store';
import { ActionsState } from '@store/actions.state';
import { BehaviorSubject, forkJoin, Observable } from 'rxjs';

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
      transition('* => *', animate(100))
    ])
  ]
})
export class AddStepComponent {

  @Select(ActionsState) actions$: Observable<Action[]>;

  constructor(
    public dialogRef: MatDialogRef<AddStepComponent>,
    private dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) { }

  currentStep: Action = {
    action_id: 0,
    action_name: '',
    application: '',
    compare: false,
    date_created: '',
    department: '',
    description: '',
    values: 0
  };

  getStep(action: Action) {
    const values = [];
    const subscribers: Observable<any>[] = [];
    const newReplacements = action.action_name.match(/\{.*?\}/g);
    if (!!newReplacements) {
      newReplacements.reverse().forEach((match) => {
        const word = match.slice(1, -1);
        subscribers.push(this.dialog.open(EnterValueComponent, {
          backdropClass: 'transparent',
          disableClose: true,
          autoFocus: true,
          panelClass: 'enter-value-panel',
          data: {
            word: word,
            value: ''
          }
        }).afterClosed());
      });
      forkJoin([...subscribers]).subscribe(res => {
        res.forEach((value) => {
          values.push({ word: value.word, value: value.value });
        });
        let newStepStatement = action.action_name;
        let newStepStatement_protected = action.action_name;
        values.forEach(value => {
          newStepStatement = newStepStatement.replace('{' + value.word + '}', value.value);
          switch (value.word) {
            case 'password':
            case 'pin':
              newStepStatement_protected = newStepStatement_protected.replace('{' + value.word + '}', value.value.replace(/./g, '*'));
              break;
            default:
              newStepStatement_protected = newStepStatement_protected.replace('{' + value.word + '}', value.value);
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
