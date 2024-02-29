enum MainViewColumn {
  Bar = 'bar',
  Status = 'status',
  Date = 'date',
  Total = 'steps',
  Ok = 'ok',
  Nok = 'nok',
  Skipped = 'skipped',
  Browser = 'browser',
  Time = 'time',
  Pixel = 'pixel',
  Video = 'video',
  Options = 'options',
}

export const MainViewFieldsMobile = [
  MainViewColumn.Bar,
  MainViewColumn.Date,
  MainViewColumn.Ok,
  MainViewColumn.Nok,
  MainViewColumn.Skipped,
  MainViewColumn.Options,
];

export const MainViewFieldsTabletPortrait = [
  MainViewColumn.Bar,
  MainViewColumn.Date,
  MainViewColumn.Total,
  MainViewColumn.Ok,
  MainViewColumn.Nok,
  MainViewColumn.Skipped,
  MainViewColumn.Time,
  MainViewColumn.Video,
  MainViewColumn.Options,
];

export const MainViewFieldsTabletLandscape = [
  MainViewColumn.Status,
  MainViewColumn.Date,
  MainViewColumn.Total,
  MainViewColumn.Ok,
  MainViewColumn.Nok,
  MainViewColumn.Skipped,
  MainViewColumn.Time,
  MainViewColumn.Video,
  MainViewColumn.Options,
];

export const MainViewFieldsDesktop = [
  MainViewColumn.Status,
  MainViewColumn.Date,
  MainViewColumn.Total,
  MainViewColumn.Ok,
  MainViewColumn.Nok,
  MainViewColumn.Skipped,
  MainViewColumn.Browser,
  MainViewColumn.Time,
  MainViewColumn.Pixel,
  MainViewColumn.Video,
  MainViewColumn.Options,
];
