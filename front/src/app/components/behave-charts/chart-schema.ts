import { Options } from "highcharts/highstock";

export const MAIN_VIEW_CHART_SCHEMA: Options = {
  navigator: {
    xAxis: {}
  },
  rangeSelector: {
    floating: false,
    buttonPosition: {
        align: 'right',
        y: 0,
        x: 0
    },

    selected: 5,
    inputEnabled: false,
    buttons: [{
      type: 'hour',
      count: 1,
      text: 'Hour'
    }, {
      type: 'day',
      count: 1,
      text: 'Day'
    }, {
      type: 'week',
      count: 1,
      text: 'Week'
    }, {
      type: 'month',
      count: 1,
      text: 'Month'
    }, {
      type: 'year',
      count: 1,
      text: 'Year'
    }, {
      type: 'all',
      count: 1,
      text: 'All'
    }],
    enabled: true
  },
  colors: ['#00a99d', '#f97412', '#3782d8', '#d4145a'],
  chart: {
    backgroundColor: 'transparent',
    marginLeft: 5,
    marginRight: 5,
    marginBottom: 20
  },
  credits: {
    enabled: false
  },
  series: [{
    tooltip: {
      valueDecimals: 0
    },
    type: 'areaspline',
    name: 'OK',
    data: [],
    yAxis: 1
  }, {
    tooltip: {
      valueDecimals: 0
    },
    type: 'areaspline',
    name: 'NOK',
    data: [],
    yAxis: 1
  }, {
    tooltip: {
      valueDecimals: 0
    },
    type: 'spline',
    name: 'Pixel difference',
    data: [],
    yAxis: 0
  }, {
    tooltip: {
      valueDecimals: 0
    },
    type: 'spline',
    name: 'Execution time',
    data: [],
    yAxis: 2
  }],
  yAxis: [{
    title: {
      text: 'Pixel difference'
    },
    height: '100%',
    lineWidth: 2
  }, {
    title: {
      text: 'OK/NOK'
    },
    height: '100%',
    offset: 0,
    lineWidth: 2
  }, {
    title: {
      text: 'Execution time'
    },
    height: '100%',
    offset: 0,
    lineWidth: 2
  }],
  xAxis: {
    minRange: 0
  }
}

export default MAIN_VIEW_CHART_SCHEMA;