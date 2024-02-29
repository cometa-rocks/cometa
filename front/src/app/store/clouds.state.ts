import { State, Action, StateContext } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { Clouds } from './actions/clouds.actions';
import { Browserstack } from './actions/browserstack.actions';
import { Lyrid } from './actions/browserslyrid.actions';

/**
 * @description Contains the state of all clouds
 * NOT USED
 * @author Alex Barba
 */
@State<Cloud[]>({
  name: 'clouds',
  defaults: [],
})
@Injectable()
export class CloudsState {
  @Action(Clouds.SetClouds)
  getAll(
    { setState, dispatch }: StateContext<Cloud[]>,
    { clouds }: Clouds.SetClouds
  ) {
    const browserstack = clouds.find(cloud => cloud.name === 'browserstack');
    // Get browserstack devices if browserstack cloud is found and is marked as active
    if (browserstack && browserstack.active) {
      dispatch(new Browserstack.GetBrowserstack());
    }
    console.log({ clouds });
    const lyrid = clouds.find(cloud => cloud.name === 'Lyrid.io');
    if (lyrid && lyrid.active) {
      dispatch(new Lyrid.GetLyridBrowsers());
    }
    setState(clouds);
  }
}
