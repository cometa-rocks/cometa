import {
  Component,
  Inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  ViewChild,
  OnDestroy,
  ElementRef,
} from '@angular/core';
import {
  MatLegacyDialog as MatDialog,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { Select, Store } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { UserState } from '@store/user.state';
import { Observable, Subject, takeUntil } from 'rxjs';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';
import { MatSort, Sort, MatSortModule } from '@angular/material/sort';
import {
  MatLegacyTableDataSource as MatTableDataSource,
  MatLegacyTableModule,
} from '@angular/material/legacy-table';
import {
  MatLegacyCheckboxChange as MatCheckboxChange,
  MatLegacyCheckboxModule,
} from '@angular/material/legacy-checkbox';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatLegacyOptionModule } from '@angular/material/legacy-core';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { NgIf, NgFor } from '@angular/common';
import { InputFocusService } from '@services/inputFocus.service';
import { DraggableWindowModule } from '@modules/draggable-window.module';
import { MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { Configuration } from '@store/actions/config.actions';
import { E } from '@angular/cdk/keycodes';

@Component({
  selector: 'edit-configuration',
  templateUrl: './edit-configuration.component.html',
  styleUrls: ['./edit-configuration.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgIf,
    MatLegacyDialogModule,
    CdkDrag,
    CdkDragHandle,
    MatLegacyFormFieldModule,
    MatIconModule,
    MatLegacyInputModule,
    ReactiveFormsModule,
    FormsModule,
    MatLegacyButtonModule,
    MatLegacyMenuModule,
    NgFor,
    MatLegacyCheckboxModule,
    MatLegacyTableModule,
    MatSortModule,
    MatLegacySelectModule,
    MatLegacyOptionModule,
    MatLegacyTooltipModule,
    AmParsePipe,
    AmDateFormatPipe,
    DraggableWindowModule,
  ],
})
export class EditConfigurationComponent implements OnInit, OnDestroy {
  allColumns: Columns[] = [
    { name: 'Name', activated: true, value: 'configuration_name' },
    { name: 'Value', activated: true, value: 'configuration_value' },
    { name: 'Default', activated: true, value: 'default_value' },
    { name: 'Encrypted', activated: true, value: 'encrypted' },
    { name: 'Edit Allowed', activated: true, value: 'can_be_edited' },
    { name: 'Delete Allowed', activated: true, value: 'can_be_deleted' },
    { name: 'Created by', activated: true, value: 'created_by_name' },
    { name: 'Last updated by', activated: true, value: 'updated_by_name' },
    { name: 'Created on', activated: true, value: 'created_on' },
    { name: 'Last updated on', activated: true, value: 'updated_on' },
    { name: 'Actions', activated: true, value: 'actions' },
  ];

  configurations: Configuration[] = [];

  displayedColumns: string[] = [];
  bases: string[] = ['feature', 'environment', 'department'];
  isEditing: boolean = false;
  errors = { name: null, value: null };
  configuration_backup: Configuration;
  destroy$ = new Subject<void>();
  searchTerm: string = '';
  isDialog: boolean = false;
  dataSource;

  @ViewChild('tableWrapper') tableWrapper: ElementRef;
  @ViewChild(MatSort) sort: MatSort;
  // @Select(configurationsState) configurationState$: Observable<Configuration[]>;
  @ViewSelectSnapshot(UserState.GetPermission('manage_configurations'))
  canCreate: boolean;

  constructor(
    private _store: Store,
    private _snack: MatSnackBar,
    private _api: ApiService,
    private cdr: ChangeDetectorRef,
    private _dialog: MatDialog,
    private inputFocusService: InputFocusService,
    private dialogRef: MatDialogRef<EditConfigurationComponent>
  ) { }

  sendInputFocusToParent(inputFocus: boolean): void {
    this.inputFocusService.setInputFocus(inputFocus);
  }

  ngOnInit(): void {
    this._api.getCometaConfigurations().subscribe(
      res => {
        console.log(res);
        if (res) {
          this.configurations = res;
          // Making configurations[...n].disabled = true so that in front row by default editing is disabled
          this.configurations = this.configurations.map(config => ({
            ...config,
            disabled: true,
          })) as Configuration[];

          this.dataSource = new MatTableDataSource(this.configurations);
          this.cdr.markForCheck();
        } else {
          this._snack.open('Error while loading configuration', 'OK');
        }
      },
      () => {
        this._snack.open('Error while loading configuration', 'OK');
      }
    );

    // get displayed columns from localstorage
    const storedColumns = JSON.parse(
      localStorage.getItem('CONFIGURATION_configuration')
    );

    // if result is not null, load columns from localstorage, else load default columns
    storedColumns != null
      ? this.loadStoredColumns(storedColumns)
      : this.onColumnDisplayChange();

    this.dataSource = new MatTableDataSource(this.configurations);

    // Inbuilt MatTableDataSource.filterPredicate determines which columns filter term must be applied to
    this.applyFilterPredicate();

    // apply current searchTerm
    this.applyFilter();

    // this.configurationState$.pipe(takeUntil(this.destroy$)).subscribe(data => {

    // });
    this.restoreSortState();
  }

  ngOnDestroy(): void {
    //   destroy subscription
    //   this.destroy$.next();
    //   this.destroy$.complete();
    //   when this dialog is closed, remove any configuration with id 0 from configuration state.
    //   this.configurations.forEach(configuration => {
    //     if (configuration.id === 0) {
    //       this._store.dispatch(new configurations.Deleteconfiguration(configuration.id));
    //     }
    //   });
  }

  // loads colums received from localstorage if length of the array has items. If array is loads default columns
  loadStoredColumns(storedColumns: string[]) {
    if (storedColumns.length > 0) {
      this.allColumns.map(
        item => (item.activated = storedColumns.includes(item.value))
      );
      this.onColumnDisplayChange();
      return;
    }

    this.onColumnDisplayChange();
  }

  // removes or adds clicked column from displayed columns
  onColumnDisplayChange() {
    this.displayedColumns = this.allColumns
      .filter(item => item.activated)
      .map(item => item.value);

    localStorage.setItem(
      'CONFIGURATION_configuration',
      JSON.stringify(this.displayedColumns)
    );
  }

  onEditVar(configuration: Configuration) {
    // if user is currently editing some configuration row and double click is performed on different configuration row, give feedback message and return
    // this snack feedback message will only be provided if user tries to edit configuration with double click mouse event, while another configuration is being edited.
    if (this.isEditing && configuration.disabled) {
      this._snack.open(
        'Please save changes in order to edit another configuration.',
        'OK'
      );
      return;
    }

    if (!configuration.can_be_edited) {
      this._snack.open('This configuration can not be edited', 'OK');
      return;
    }

    // return if user double clicks on a row that she/he is already editing
    if (this.isEditing && !configuration.disabled) {
      return;
    }

    // save backup of current state of configuration in case user wants to cancel changes
    this.configuration_backup = { ...configuration };

    // notify view that currently there is a configuration that is being edited and enable table row that configuration is located at.
    this.isEditing = true;
    configuration.disabled = false;

    // focus enabled row
    this.focusElement(`name-${configuration.id}`);
  }

  onSaveVar(configuration: Configuration) {
    // If input validators are invalid, return
    // this condition will only be fired when user tries to save configuration with ENTER keyboard event
    if (this.errors.name || this.errors.value) {
      return;
    }

    // Depending on if user is creating new configuration or is patching existing one
    // next piece of code updates existing configuration in state or replaces the removed configuration(with id 0) with the one that is received from XHR
    let action =
      configuration.id === 0
        ? this._api.setConfigurations(configuration)
        : this._api.patchConfigurations(configuration);

    action.subscribe(
      (res: Configuration) => {
        // if new user added, then update the array with new user 
        if (configuration.id === 0) {
          this.configurations[this.configurations.length - 1] = res;
          this.configurations[this.configurations.length - 1].disabled = true;

          // if existing user updated update the new user to array 
        } else {
          this.configurations.forEach((conf, index) => {
            if (conf.id === res.id) {
              this.configurations[index] = res; // Modify the original array
            }
            this.configurations[index].disabled = true;
          });
        }
        this.dataSource = new MatTableDataSource(this.configurations);
        this.cdr.detectChanges();
        this.isEditing = false;
        this._snack.open('Configuration updated successfully', 'Ok');
      },
      () => {
        this._snack.open('Error while saving configuration', 'OK');
      }
    );
  }

  onDeleteVar(configuration: Configuration) {
    // defines action to be realized, in this case > Delete
    let action = this._api.deleteConfigurations(configuration.id);

    // opens confirmation dialog, to prevent accidental elimination
    const confirmDialog = this._dialog.open(AreYouSureDialog, {
      data: {
        title: 'translate:you_sure.delete_item_title',
        description: 'translate:you_sure.delete_item_desc',
      } as AreYouSureData,
    });

    // if dialogs result is 'yes/true', removes configuration completes action to eliminate configuration
    confirmDialog.afterClosed().subscribe(res => {
      if (res) {
        action.subscribe({
          next: (response) => {
              this.configurations = this.configurations.filter(
                config => config.id !== configuration.id
              );
              this.dataSource = new MatTableDataSource(this.configurations);
              this.cdr.markForCheck();
              this._snack.open('Configuration deleted successfully', 'Ok');
          },
          error: (err) => {
            console.log(err)
            this._snack.open('Error while deleting configuration', 'OK');
          }
      });
        return;
      }
    });
  }

  onCancelVar(configuration: Configuration, event: Event) {
    // stop propagation if user cancels modification by clicking ESC key, this will prevent whole popup from closing
    if (event) event.stopImmediatePropagation();

    // if users is cancelling the process of creation of new configuration, dispatches delete event to remove it from state
    // if user is cancelling the process of modification of already existing configuration, dispatches update event to set configuration to its previous state
    if (configuration.id === 0) {
      this.configurations = this.configurations.filter(
        config => config.id !== configuration.id
      );
    } else {
      // forEach loop is faster as compare to map, So using
      this.configurations.forEach((conf, index) => {
        if (conf.id === configuration.id) {
          this.configurations[index] = this.configuration_backup; // Modify the original array
        }
      });
    }
    this.dataSource = new MatTableDataSource(this.configurations);
    this.cdr.detectChanges();

    this.configuration_backup = null;

    // Nullify validators for newly created configurations
    this.nullifyValidators();

    // notify view that user is no longer editing any configuration
    this.isEditing = false;
  }

  onEncryptCheckboxChange(
    event: MatCheckboxChange,
    configuration: Configuration
  ) {
    if (
      !event.checked &&
      configuration.configuration_name.startsWith('U2FsdGVkX1')
    ) {
      // opens confirmation dialog, to prevent accidental elimination of encrypted configuration value
      const confirmDialog = this._dialog.open(AreYouSureDialog, {
        data: {
          title: 'translate:you_sure.decrypt_title',
          description: 'translate:you_sure.decrypt_desc',
        } as AreYouSureData,
      });

      // if dialogs result is 'yes/true', resets the value of configuration. But it is still not saved, user can revert it by hitting ESC key or Cancel button
      confirmDialog.afterClosed().subscribe(res => {
        if (res) {
          configuration.configuration_name = '';
          this.setInputStatus({ required: true }, 'value');
          this.cdr.markForCheck();

          // focus enabled row's configuration-value input
          this.focusElement(`value-${configuration.id}`);
          return;
        }

        // if dialog result is no/false. go back to previous state of value encryption and focus configuration-name input
        configuration.encrypted = true;
        this.focusElement(`name-${configuration.id}`);
        this.cdr.markForCheck();
      });
    }
  }

  onAddConfiguration() {
    if (this.isEditing) {
      this._snack.open('Please save your current variable', 'Ok');
      return false;
    }
    // creates and dispatches new temporary configuration object to state, so it gets rendered in view
    this.createNewVarInstance();
    this.applyValidators();
  }

  // is fired when, sorting of any column on table is changed
  announceSortChange(sortState: Sort) {
    localStorage.setItem('configuration_Sort_State', JSON.stringify(sortState));
    this.dataSource.sort = this.sort;
  }

  restoreSortState() {
    const sortState = JSON.parse(
      localStorage.getItem('configuration_Sort_State')
    );
    if (sortState && this.sort) {
      this.sort.active = sortState.active;
      this.sort.direction = sortState.direction;
      this.dataSource.sort = this.sort;
    }
  }

  // Receives string from search input and adds it to dataSource as filterTerm.
  applyFilter() {
    this.dataSource.filter = this.searchTerm.trim().toLowerCase();
  }

  // Check if element is disabled or .
  isElementDisabled(configuration: Configuration) {
    // if configuration can not be edited then element should be disabled
    // else element should be enabled/disabled depends on configuration.disabled
    return this.isEditing && configuration.can_be_edited
      ? configuration.disabled
      : true;
  }

  // determines which columns filter must be applied to
  applyFilterPredicate() {
    this.dataSource.filterPredicate = (row: Configuration, filter: string) => {
      return (
        row.configuration_name.toLocaleLowerCase().includes(filter) ||
        row.configuration_value.toLocaleLowerCase().includes(filter)
      );
    };
  }

  // bind to (input) event. Actualizes input's validator status every time user focuses out of input
  setInputStatus(errors: any, control: string) {
    this.errors[control] = errors;
  }

  // set validators for newly created temporary configurations
  applyValidators() {
    this.errors = { name: { required: true }, value: { required: true } };
  }

  // nullifies validators, after edit mode cancel
  nullifyValidators() {
    this.errors = { name: null, value: null };
  }

  // focuses dom element that carries id attribute equal received id
  focusElement(id: string) {
    setTimeout(() => {
      document.getElementById(id).focus();
    }, 0);
  }

  // creates temporary configuration object and dispatches it to state, so it is displayed in view and user can fill input fields
  createNewVarInstance() {
    const new_var = <Configuration>{};

    new_var.id = 0;
    new_var.configuration_name = '';
    new_var.configuration_value = '';
    new_var.default_value = '';
    new_var.encrypted = false;
    new_var.can_be_edited = true;
    new_var.can_be_deleted = true;
    new_var.disabled = false;
    this.configurations.push(new_var);
    this.dataSource = new MatTableDataSource(this.configurations);
    this.cdr.detectChanges();
    this.isEditing = true;
  }
}
