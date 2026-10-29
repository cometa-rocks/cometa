import {
  Component,
  Inject,
  ChangeDetectionStrategy,
  HostListener,
  OnInit,
} from '@angular/core';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { Logs } from '@store/actions/logs.actions';
import { Observable } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { NgIf, AsyncPipe } from '@angular/common';

@Component({
  selector: 'log-output',
  templateUrl: './log-output.component.html',
  styleUrls: ['./log-output.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatDialogModule,
    NgIf,
    MatButtonModule,
    MatProgressSpinnerModule,
    AsyncPipe,
  ],
})
export class LogOutputComponent implements OnInit {
  constructor(
    private dialogRef: MatDialogRef<LogOutputComponent>,
    @Inject(MAT_DIALOG_DATA) private id: number,
    private _store: Store
  ) {
    this.log$ = this._store.select(CustomSelectors.GetLogById(this.id));
  }

  @HostListener('document:keydown', ['$event']) handleKeyboardEvent(
    event: KeyboardEvent
  ) {
    // Escape key
    if (event.keyCode === 27) this.dialogRef.close();
  }

  log$: Observable<string>;

  ngOnInit() {
    return this._store.dispatch(new Logs.GetLogs(this.id));
  }
}
