import {
  Component,
  Input,
  OnInit,
  ChangeDetectionStrategy,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'cometa-feature-metrics-usage',
  templateUrl: './feature-metrics-usage.component.html',
  styleUrls: ['./feature-metrics-usage.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
})
export class FeatureMetricsUsageComponent implements OnInit, OnChanges {

    // @Input() data$: any;    

    ngOnInit() {

    }

    ngOnChanges(): void {
        // Handle input changes if needed
    }

    //   Use mat-card for this component
    //   Use mat-icon for the icon
    //   Use mat-progress-spinner for the loading
    //   Use mat-card-content for the content
    //   Use mat-card-header for the header
    //   Use mat-card-footer for the footer
    //   Use mat-card-actions for the actions
    //   Use mat-card-title for the title
    //   Use mat-card-subtitle for the subtitle
}
