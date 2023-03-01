
/**
 * Department Actions for departments.state.ts
 */
export namespace Departments {

    /**
     * @description Sets the environments for Admin page
     */
    export class GetAdminDepartments {
      static type = '[Departments] Get Admin Departments';
    }
  
    /**
     * @description Add a department for Admin page
     * @param {Department} department Department object
     */
    export class AddAdminDepartment {
      static readonly type = '[Departments] Add Admin Department';
      constructor( public department: Department) { }
    }
  
    /**
     * @description Update department info locally
     * @param {number} departmentId DepartmentID to update
     * @param {Partial<Department>} options Partial department object (any property is optional)
     */
    export class UpdateDepartment {
      static readonly type = '[Departments] Update Department Info';
      constructor(
        public departmentId: number,
        public options: Partial<Department>
      ) { }
    }
  
    /**
     * @description Removes a department of Admins
     * @param {number} department_id DepartmentID
     */
    export class RemoveAdminDepartment {
      static readonly type = '[Departments] Remove Admin Department';
      constructor( public department_id: number) { }
    }

    // file upload process websockets
    export class FileUploadStatusUknown {
      static readonly type = '[Files] Unknown';
      constructor( public file: UploadedFile ) { }
    }

    export class FileUploadStatusProcessing {
      static readonly type = '[Files] Processing';
      constructor( public file: UploadedFile ) { }
    }

    export class FileUploadStatusScanning {
      static readonly type = '[Files] Scanning';
      constructor( public file: UploadedFile ) { }
    }

    export class FileUploadStatusEncrypting {
      static readonly type = '[Files] Encrypting';
      constructor( public file: UploadedFile ) { }
    }

    export class FileUploadStatusDone {
      static readonly type = '[Files] Done';
      constructor( public file: UploadedFile ) { }
    }

    export class FileUploadStatusError {
      static readonly type = '[Files] Error';
      constructor( public file: UploadedFile, public error: FileUploadError ) { }
    }
  }