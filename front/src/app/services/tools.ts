import { titleCase } from 'ngx-amvara-toolbox';

export function formatVersion(version: string): string {
  if (!version) return '';
  return version
    .replace(/\.0/gi, '')
    .replace(/iphone/gi, 'iPhone')
    .replace(/ipad/gi, 'iPad')
    .replace(/ios/gi, 'iOS')
}

export function getBrowserComboText(browser: BrowserstackBrowser, so: boolean = true): string {
  if (browser.mobile_emulation) {
    return `${formatVersion(titleCase(browser.device))} - ${formatVersion(titleCase(browser.os))} ${formatVersion(browser.os_version)}`;
  }
  if (browser.device) {
    // Use device instead of browser if available
    return `${formatVersion(titleCase(browser.device))} ${titleCase(formatVersion(browser.browser_version))} - ${formatVersion(titleCase(browser.os))} ${formatVersion(browser.os_version)}`
  }
  if (so) {
    return `${formatVersion(titleCase(browser.browser))} ${titleCase(formatVersion(browser.browser_version))} - ${formatVersion(titleCase(browser.os))} ${formatVersion(browser.os_version)}`;
  } else {
    return `${formatVersion(titleCase(browser.browser))} ${titleCase(formatVersion(browser.browser_version))}`;
  }
}

/* Return a truthy number */
export function removeCommas(x: string): number {
  return +x.toString().replace(/,|./g, '');
}

/* Return a percent number with/without sign */
export function percent(part: number, total: number, sign?: boolean, space_between?: boolean, zeroSign?: boolean): number | string {
  sign = sign || false;
  space_between = space_between || false;
  zeroSign = zeroSign || false;
  if (zeroSign && total === 0) {
    return '-';
  }
  if (sign) {
    return parseInt(((part * 100) / total).toFixed(0), 10) + (space_between ? ' ' : '') + '%';
  } else {
    return parseInt(((part * 100) / total).toFixed(0), 10);
  }
}

export function getCognosIframe(html): string {
  const htmlDoc = new DOMParser().parseFromString(html, 'text/html');
  try {
    const iframe = htmlDoc.querySelector('iframe');
    const link = iframe.getAttribute('src');
    return link.split('?')[0];
  } catch (err) { // IE Fix
    const regex = /(\/ibmcognos\/cgi-bin\/cognosisapi\.dll\/repository\/sid\/cm\/oid\/(.+)\/content)/g;
    const matches = regex.exec(html);
    return matches[0];
  }
}

export function csvToJson(data): any[] {
  const rows = [];
  const lines: any[] = data.split('\n');
  lines.shift();
  lines.forEach(line => {
    if (line.length > 0) {
      const newRow = [];
      line.split(';').forEach(element => {
        newRow.push(isNaN(element) ? element : +element);
      });
      rows.push(newRow);
    }
  });
  return rows;
}

/**
 * @description This function takes the brower_info as parameter and constructs a unique ID
 * @author Alex Barba
 */
export function getBrowserKey(browser: BrowserstackBrowser) {
  return `${browser.browser}-${browser.browser_version}-${browser.device}-${browser.os}-${browser.os_version}-${browser.real_mobile}`;
}

export function ownFeature(feature: Feature, user: UserInfo, departments: Department[]) {
  return feature?.created_by === user.user_id || departments.map(d => d?.department_name).includes(feature?.department_name);
}

export function getDescendantProp(obj, desc) {
  var arr = desc.split(".");
  while(arr.length && (obj = obj[arr.shift()]));
  return obj;
}