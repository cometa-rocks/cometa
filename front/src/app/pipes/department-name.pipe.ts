import { Pipe, PipeTransform } from '@angular/core';
import { SelectSnapshot } from '@ngxs-labs/select-snapshot';
import { UserState } from '../store/user.state';
import memo from 'memo-decorator';
import { LogService } from '@services/log.service';

@Pipe({
  name: 'departmentName',
  standalone: true,
})
export class DepartmentNamePipe implements PipeTransform {

  constructor(private logger: LogService) {}

  @SelectSnapshot(UserState.RetrieveUserDepartments) departments: Department[];

  @memo()
  transform(departmentId: number): string {
    this.logger.msg('4', `Show me the id + ${departmentId}`, 'department-name.pipe');
    return this.departments.find(dept => dept.department_id === departmentId)
      .department_name;
  }
}
