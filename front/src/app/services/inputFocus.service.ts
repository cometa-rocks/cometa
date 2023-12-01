import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InputFocusService {
  private inputFocusSubject = new Subject<boolean>();
  inputFocus$ = this.inputFocusSubject.asObservable();

  setInputFocus(value: boolean): void {
    this.inputFocusSubject.next(value);
  }
}

