import {
  Component,
  Input,
  SimpleChanges,
  OnChanges,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnInit,
} from '@angular/core';
import * as Highcharts from 'highcharts/highstock';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import MAIN_VIEW_CHART_SCHEMA from './chart-schema';
import { delay, filter, map, tap } from 'rxjs/operators';
import { SeriesSplineOptions } from 'highcharts';
import { HighchartsChartModule } from 'highcharts-angular';
import { NgIf, AsyncPipe } from '@angular/common';

@Component({
  selector: 'behave-chart-desktop-steps',
  templateUrl: './behave-chart.component.html',
  styleUrls: ['./behave-chart.component.scss'],
  providers: [AmParsePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgIf, HighchartsChartModule, AsyncPipe],
})
export class BehaveChartTestComponent
  implements OnChanges, OnInit, AfterViewInit
{
  Highcharts: typeof Highcharts = Highcharts;

  @Input() data: FeatureResult[] = [];

  chart$: Observable<Highcharts.Options>;
  updateFlag = false;

  ngAfterViewInit() {
    this.afterViewInitFired$.next(true);
  }

  constructor(private _amParse: AmParsePipe) {}

  ngOnInit() {
    // Wait for ngOnChanges and ngAfterViewInit to process chart data
    this.chart$ = combineLatest([this.data$, this.afterViewInitFired$]).pipe(
      filter(([_, init]: [any[], boolean]) => init),
      map(([data, _]: [any[], boolean]) => {
        // Get chart schema
        const chart_schema = MAIN_VIEW_CHART_SCHEMA;
        // Calculate data for chart
        const chart_data = this.getSeriesData(data);
        // Replace chart data if available
        if (chart_data) {
          // Set ok, nok, pixel and execution on chart schema
          (chart_schema.series[0] as SeriesSplineOptions).data = chart_data.ok;
          (chart_schema.series[1] as SeriesSplineOptions).data = chart_data.nok;
          (chart_schema.series[2] as SeriesSplineOptions).data =
            chart_data.pixel;
          (chart_schema.series[3] as SeriesSplineOptions).data =
            chart_data.time;
          // Set minimum and maximum navigator extremes,
          // this is because when data is updated the chart preserves the min and max of the first page
          (
            chart_schema.navigator.xAxis as Highcharts.NavigatorXAxisOptions
          ).min = chart_data.ok?.[0]?.[0] || 0;
          (
            chart_schema.navigator.xAxis as Highcharts.NavigatorXAxisOptions
          ).max = chart_data.ok?.[chart_data.ok.length - 1]?.[0] || 0;
        }
        return chart_schema;
      }),
      delay(0), // Implicit setTimeout, to allow for other page components to load before this
      tap(_ => (this.updateFlag = true)) // Tell the highcharts plugin to update the chart
    );
  }

  /** Used to emit ngOnChanges as Observable */
  data$ = new BehaviorSubject<any[]>([]);

  /** Used to emit whenever the component has initialized the HTML */
  afterViewInitFired$ = new BehaviorSubject<boolean>(false);

  ngOnChanges(changes: SimpleChanges) {
    this.data$.next(changes?.data.currentValue || []);
  }

  getSeriesData(data: FeatureResult[]) {
    // Sort data by date time
    data = [...data].sort(
      (a, b) =>
        this._amParse.transform(a.result_date).getTime() -
        this._amParse.transform(b.result_date).getTime()
    );
    // Initialize array values of series
    const pixelArray = [];
    const timeArray = [];
    const okArray = [];
    const nokArray = [];
    // Iterate each run and push corresponding fields to each array
    for (const run of data) {
      pixelArray.push([
        this._amParse.transform(run.result_date).getTime(),
        run.pixel_diff,
      ]);
      timeArray.push([
        this._amParse.transform(run.result_date).getTime(),
        Number(run.execution_time) / 1000,
      ]);
      okArray.push([
        this._amParse.transform(run.result_date).getTime(),
        run.ok,
      ]);
      nokArray.push([
        this._amParse.transform(run.result_date).getTime(),
        run.fails,
      ]);
    }
    return {
      ok: okArray,
      nok: nokArray,
      pixel: pixelArray,
      time: timeArray,
    };
  }
}
