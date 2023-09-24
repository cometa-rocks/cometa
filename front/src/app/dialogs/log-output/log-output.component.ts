import {
  Component,
  Inject,
  ChangeDetectionStrategy,
  HostListener,
  OnInit,
} from '@angular/core';
import {
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
} from '@angular/material/legacy-dialog';
import { Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { Logs } from '@store/actions/logs.actions';
import { Observable } from 'rxjs';

@Component({
  selector: 'log-output',
  templateUrl: './log-output.component.html',
  styleUrls: ['./log-output.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
