import { Directive, Input, TemplateRef, ViewContainerRef, EmbeddedViewRef } from '@angular/core';

/**
 * Custom Directive to dynamicly assign calculated value to a static value context
 * @url https://stackblitz.com/edit/directive-collection-with-examples?file=src%2Fapp%2Fng-let.directive.ts
 */
@Directive({
    selector: '[ngLet]',
    standalone: true
})
export class LetDirective {
    _ref: EmbeddedViewRef<any>;
    context: any = {};

    @Input()
    set ngLet(value: any) {
      // if embeadded view doesn't exist yet create it (only once)
      if (!this._ref) {
          this.createView();
      }
      // if value is empty destroy the component
      // here it's acctualy works like ngIf (will rerender on non-empty value)
      /* if (!value) {
        this._ref.destroy();
        this._ref = undefined;
        return;
      } */
      // add the value to the context
      this._ref.context.$implicit = this.context.ngLet = value;
    }

    constructor(
      private readonly vcRef: ViewContainerRef,
      private readonly templateRef: TemplateRef<any>
    ) {}

    createView(): void {
      this.vcRef.clear();
      this._ref = this.vcRef.createEmbeddedView(this.templateRef, this.context);
    }
}