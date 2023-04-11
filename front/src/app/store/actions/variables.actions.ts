
/**
 * Variable Actions for variables.state.ts
 */
export namespace Variables {

    /**
     * @description Makes a request to get all variables
     */
    export class GetVariables {
      static readonly type = '[Variables] Get All';
    }
  
    /**
     * @description Allows to set all variables array
     * @param {string} environment_name Environment Name
     * @param {string} department_name Department Name
     * @param {VariablePair[]} variables Array of variables
     */
    export class SetVariables {
      static readonly type = '[Variables] Set Variables';
      constructor(
        public environment_name: string,
        public department_name: string,
        public variables: VariablePair[]
      ) { }
    }
  
    /**
     * @description Update one environment variable
     * @param {VariablePair} variable Variable object to update
     */
    export class UpdateOrCreateVariable {
      static readonly type = '[Variables] Update Variable';
      constructor(
        public variable: VariablePair
      ) { }
    }

    /**
     * @description Update one environment variable
     * @param {VariablePair} variable Variable object to update
     */
    export class DeleteVariable {
      static readonly type = '[Variables] Delete Variable';
      constructor(
        public id: number
      ) { }
    }
  
  }