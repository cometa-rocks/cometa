import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'cometa-email-template-help',
  templateUrl: 'email-template-help.component.html',
  styleUrls: ['email-template-help.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailTemplateHelp {
  variables = [
    ['status', 'The status of the result'],
    ['feature_result_id', 'ID of the result'],
    ['feature_id', 'ID of the feature'],
    ['result_date', 'Datetime of the result'],
    ['feature_name', 'Feature name'],
    ['app_name', 'Application name'],
    ['environment_name', 'Environment name'],
    ['department_name', 'Department name'],
    ['total', 'Total steps of result'],
    ['fails', 'Fails of result'],
    ['ok', 'Success steps of result'],
    ['skipped', 'Skipped steps of result'],
    ['execution_time', 'Time in milliseconds of the result'],
    ['pixel_diff', 'Pixel difference of the result'],
    ['log', 'Log output of the result'],
    ['archived', 'Whether or not the result is archived'],
    ['executed_by', 'User ID of who executed the result'],
  ];
}
