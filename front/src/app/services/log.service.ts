import { Injectable } from '@angular/core';
import { formatDate } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class LogService {
  constructor() {}

  // trace(msg: any, tag: string) { this.msg("1", msg, tag) }
  // error(msg: any, tag: string) { this.msg("2", msg, tag) }
  // warn(msg: any, tag: string) { this.msg("3", msg, tag) }
  // info(msg: any, tag: string) { this.msg("4", msg, tag) }
  // general(msg: any, tag: string) { this.msg("5", msg, tag) }

  msg(lvl: string, msg: any, tag: string, data: any = '') {
    // read from localstorage
    // co_loglvl + co_logtag
    // 1 = trace
    // 2 = error
    // 3 = warn
    // 4 = info
    // 5 = general
    const ls_lvl = localStorage.getItem('co_loglvl') || '';

    // Reading ls_tag
    const ls_tag = localStorage.getItem('co_logtag') || 'none';

    // just get out of here, if ls_tag is "none" ... we do not want any logging in that case
    if (ls_tag == 'none') {
      return;
    }

    // check ls_lvl is smaller than lvl coming in to print that message
    if (ls_lvl <= lvl) {
      // check that tag is matched to print message
      // tag = * ...... print anything
      // tag = none ... never print
      // tag = foo .... only print foo messages
      if (ls_tag == '*' || ls_tag.match(tag) != null) {
        const currentDate = Date.now();
        const format = 'dd/MM/yyyy hh:mm:ss:SSS';
        const zone = 'en-US';

        const parsedDate = formatDate(currentDate, format, zone);
        console.log(parsedDate, `[${lvl}-${tag}]`, msg, data);
      }
    }
  }
}
