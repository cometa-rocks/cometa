import { Component, ChangeDetectionStrategy, HostListener } from '@angular/core';
import {
  trigger,
  state,
  style,
  animate,
  transition,
} from '@angular/animations';
import { UserState } from '@store/user.state';
import { SharedActionsService } from '@services/shared-actions.service';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { CustomSelectors } from '@others/custom-selectors';
import { Configuration } from '@store/actions/config.actions';
import { User } from '@store/actions/user.actions';
import { Store } from '@ngxs/store';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { DOCUMENT, NgIf } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { KEY_CODES } from '@others/enums';
import { InputFocusService } from '../../services/inputFocus.service';
import { TranslateModule } from '@ngx-translate/core'; 
import { WhatsNewService } from '@services/whats-new.service';
@Component({
  selector: 'header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('opened', [
      state(
        'false',
        style({
          transform: 'translateX(100vw)',
        })
      ),
      state(
        'true',
        style({
          transform: 'translateX(calc(100vw - 360px))',
        })
      ),
      transition('false <=> true', animate('250ms 0ms ease-in-out')),
    ]),
  ],
  standalone: true,
  imports: [RouterLink, NgIf, MatLegacyTooltipModule, RouterLinkActive, TranslateModule],
})
export class HeaderComponent {
  @ViewSelectSnapshot(UserState.GetPermission('view_admin_panel'))
  canViewAdminPanel: boolean;
  @ViewSelectSnapshot(UserState.GetPermission('create_feature'))
  canCreateFeature: boolean;
  @ViewSelectSnapshot(UserState.HasOneActiveSubscription)
  hasSubscription: boolean;
  @ViewSelectSnapshot(UserState.GetRequiresPayment) requiresPayment: boolean;

  /** Holds if the sidebar menu is opened or not */
  @ViewSelectSnapshot(CustomSelectors.GetConfigProperty('internal.openedMenu'))
  openedMenu: boolean;
  inputFocus: boolean = false;

  private inputFocusSubscription: Subscription;

  constructor(
    public _sharedActions: SharedActionsService,
    private _store: Store,
    private inputFocusService: InputFocusService,
    private whatsNewService: WhatsNewService
  ) {
    this.inputFocusService.inputFocus$.subscribe(isFocused => {
      this.inputFocus = isFocused;
    });
  }

  closeMenu = () =>
    this._store.dispatch(
      new Configuration.SetProperty('internal.openedMenu', false)
    );

  openMenu = () =>
    this._store.dispatch(
      new Configuration.SetProperty('internal.openedMenu', true)
    );

  openWhatsNewDialog(): void {
    this.closeMenu();
    this.whatsNewService.showAllWhatsNewDialog();
  }

  logout = () => this._store.dispatch(new User.Logout());

  // Handle keyboard keys
  @HostListener('document:keydown', ['$event']) handleKeyboardEvent(
    event: KeyboardEvent
  ) {
    const editFeatOpen = document.querySelector('edit-feature') as HTMLElement;
    // If true... return | only execute switch case if input focus is false
    if (this.inputFocus) return;

    switch (event.keyCode) {
      case KEY_CODES.P:
        if(editFeatOpen == null){
          const profileDiv = document.querySelector('div.icon[aria-label="Open profile"]') as HTMLElement;
          if (profileDiv) {
            profileDiv.click();
          }
        }
        break;
      case KEY_CODES.F:
        if(editFeatOpen == null){
          const featureDiv = document.querySelector('div.icon[aria-label="Create feature"]') as HTMLElement;
          if (featureDiv) {
            featureDiv.click();
          }
        }
        break;
      case KEY_CODES.M:
        if(editFeatOpen == null){
          const menuBackdrop = document.querySelector('div.fRight div.icon') as HTMLElement;
          if (menuBackdrop) {
            menuBackdrop.click();
          }
        }
        break;
      default:
        break;
    }
  }
}
