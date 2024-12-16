import { Component, Inject, ViewEncapsulation, ChangeDetectionStrategy, OnInit } from '@angular/core';

import { SharedModule } from '@modules/shared.module';

@Component({
  selector: 'draggable-window',
  templateUrl: './draggable-window.component.html',
  styleUrls: ['./draggable-window.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class DraggableWindowComponent {
  constructor() { }

}
