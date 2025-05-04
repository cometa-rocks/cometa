import { Pipe, PipeTransform } from '@angular/core';
import { SelectSnapshot } from '@ngxs-labs/select-snapshot';
import { UserState } from '../store/user.state';
import memo from 'memo-decorator';

@Pipe({
  name: 'departmentName',
  standalone: true,
})
export class DepartmentNamePipe implements PipeTransform {
  @SelectSnapshot(UserState.RetrieveUserDepartments) departments: Department[];

  @memo()
  transform(departmentId: number): string {
    if (!departmentId || !this.departments) return '';
    const department = this.departments.find(dept => dept.department_id === departmentId);
    return department ? department.department_name : '';
  }
}
