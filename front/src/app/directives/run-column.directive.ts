import { Directive, ElementRef, Input, OnChanges, OnInit, Renderer2, SimpleChanges } from '@angular/core';
import { SharedActionsService } from '@services/shared-actions.service';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { map } from 'rxjs/operators';

@UntilDestroy()
@Directive({
    selector: '[runColumn]',
    standalone: true
})
export class RunColumnDirective implements OnChanges, OnInit {

  /**
   * This pipe returns the column order and displaying for the given column ID
   * @param name Column ID of the given column
   */

  @Input() runColumn: string;

  @Input() name: string;

  constructor(
    private _sharedActions: SharedActionsService,
    private _ref: ElementRef,
    private _renderer: Renderer2
    ) {}

  startTime = performance.now();
  static n = 1;
  static avg = 0;
  name$ = new BehaviorSubject<string>('');

  ngOnInit() {
    combineLatest([
      this._sharedActions.headers$.asObservable().pipe(
        // Add some virtual headers
        map(headers => ([
          { id: 'bar', enable: true },
          ...headers,
          { id: 'video', enable: true},
          { id: 'options', enable: true }
        ]))
      ),
      this.name$.asObservable()
    ]).pipe(
      untilDestroyed(this)
    ).subscribe(([headers, name]) => {
      const index = headers.findIndex(header => header.id === name)
      this._renderer.setStyle(this._ref.nativeElement, 'order', index + 1);
      if (index !== -1) {
        this._renderer.addClass(this._ref.nativeElement, 'show');
        this._renderer.removeClass(this._ref.nativeElement, 'hide');
      } else {
        this._renderer.removeClass(this._ref.nativeElement, 'show');
        this._renderer.addClass(this._ref.nativeElement, 'hide');
      }
    })
  }

  ngOnChanges(changes: SimpleChanges) {
    const name = changes.runColumn.currentValue;
    this.name$.next(name);
  }

}
