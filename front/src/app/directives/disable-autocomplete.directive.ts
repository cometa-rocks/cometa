import { Directive, ElementRef, Renderer2 } from '@angular/core';

@Directive({
  selector: '[disableAutocomplete]',
  standalone: true,
})
export class DisableAutocompleteDirective {
  constructor(
    private readonly el: ElementRef,
    private readonly renderer: Renderer2
  ) {}

  ngAfterViewInit() {
    const randomString = Math.random().toString(36).slice(-10);
    this.renderer.setAttribute(this.el.nativeElement, 'name', randomString);
    this.renderer.setAttribute(
      this.el.nativeElement,
      'autocomplete',
      randomString
    );
  }
}
