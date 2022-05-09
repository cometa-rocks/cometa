import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ConfigState } from '@store/config.state';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { SocketService } from '@services/socket.service';
import { Select } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { Observable } from 'rxjs';

@Component({
  selector: 'cometa-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutComponent {

  @Select(CustomSelectors.GetConfigProperty('serverInfo.version')) serverVersion$: Observable<string>;
  @ViewSelectSnapshot(ConfigState) config$ !: Config;

  constructor(
    public _socketService: SocketService,
  ) { }

  licenses = [
    ['Angular', 'https://github.com/angular/angular/blob/master/LICENSE', 'MIT License'],
    ['date-fns', 'https://date-fns.org/v1.9.0/docs/License', 'MIT License'],
    ['@ngx-translate', 'https://github.com/ngx-translate/core/blob/master/LICENSE', 'MIT License'],
    ['angular-svg-round-progressbar', 'https://github.com/crisbeto/angular-svg-round-progressbar/blob/master/LICENSE', 'MIT License'],
    ['Nginx', 'https://github.com/nginx/nginx/blob/master/docs/text/LICENSE', '2-Clause BSD License'],
    ['Postgres', 'https://github.com/postgres/postgres/blob/master/COPYRIGHT', 'PostgreSQL License (MIT-Like)'],
    ['Imagick', 'https://github.com/Imagick/imagick/blob/master/LICENSE', 'Open-Source License'],
    ['SLES', 'https://www.suse.com/es-es/licensing/', 'GNU-GPL License'],
    ['Django', 'https://github.com/django/django/blob/master/LICENSE', 'BSD License'],
    ['Behave', 'https://github.com/behave/behave/blob/master/LICENSE', 'BSD License'],
    ['Python', 'https://github.com/python/cpython/blob/master/LICENSE', 'Python Software Foundation License']
  ]

  showConfig = false;

}
