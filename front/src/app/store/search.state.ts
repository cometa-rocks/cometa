import { Injectable } from '@angular/core';
import { State } from '@ngxs/store';

@State<ISearchState>({
  name: 'novels',
  defaults: {
    newNovelForm: {
      model: undefined,
      dirty: false,
      status: '',
      errors: {},
    },
  },
})
@Injectable()
export class SearchState {}
