import { Directive, HostListener } from '@angular/core';

@Directive({
  selector: '[stopPropagation]',
})
export class StopPropagationDirective {
  @HostListener('click', ['$event'])
  public onClick(event: MouseEvent) {
    event.stopImmediatePropagation();
    event.stopPropagation();
  }
}
