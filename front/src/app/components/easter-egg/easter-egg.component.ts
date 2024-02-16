import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'cometa-easter-egg',
  templateUrl: './easter-egg.component.html',
  styleUrls: ['./easter-egg.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EasterEggComponent {}
