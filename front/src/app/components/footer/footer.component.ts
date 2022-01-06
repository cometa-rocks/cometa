import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Select } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { SocketService } from '@services/socket.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FooterComponent {

  constructor(
    public _socketService: SocketService
  ) { }

  @Select(CustomSelectors.GetConfigProperty('version')) version$: Observable<string>;
  @Select(CustomSelectors.GetConfigProperty('serverInfo.version')) serverVersion$: Observable<string>;

}
