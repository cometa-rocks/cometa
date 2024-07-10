import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class InputFocusService {
  private inputFocusSubject = new BehaviorSubject<boolean>(false);
  inputFocus$ = this.inputFocusSubject.asObservable();

  setInputFocus(isFocused: boolean) {
    this.inputFocusSubject.next(isFocused);
  }
}