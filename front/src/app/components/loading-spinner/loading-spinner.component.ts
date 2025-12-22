import { Component, Input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgIf } from '@angular/common';

@Component({
    selector: 'app-loading-spinner',
    templateUrl: './loading-spinner.component.html',
    styleUrls: ['./loading-spinner.component.scss'],
    imports: [MatProgressSpinnerModule, NgIf]
})
export class LoadingSpinnerComponent {
  @Input() isVisible = true;
  @Input() size = 40;
  @Input() message?: string;
  @Input() paddingTop = 40;
  @Input() paddingBottom = 40;
} 