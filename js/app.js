/*
Moodle Web Log Analytics Tool from Moodle Standard Logs
Copyright (c) 2020 Source code, Daniel Amo
Released under the MIT License
*/

String.prototype.dePersonalize = function () {
  var hash = 0;
  if (this.length == 0) {
    return hash;
  }
  for (var i = 0; i < this.length; i++) {
    var char = this.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

Date.prototype.diffTimestamp = function (timestamp) {
  let dateDiffInSec = ((this.getTime() / 1000 - timestamp) / 60 / 60) * 3600;
  let days = Math.floor(dateDiffInSec / (3600 * 24));
  dateDiffInSec -= days * 3600 * 24;
  let hours = Math.floor(dateDiffInSec / 3600);
  dateDiffInSec -= hours * 3600;
  let minutes = Math.floor(dateDiffInSec / 60);
  dateDiffInSec -= minutes * 60;
  return {
    days: days,
    hours: hours,
    minutes: minutes,
    seconds: dateDiffInSec,
  };
};

function gradient(maxVal, val) {
  let perct = (val * 100) / maxVal;
  if (perct <= 25) return "#C6DEFF";
  else if (perct <= 50) return "#82CAFF";
  else if (perct <= 75) return "#56A5EC";
  else if (perct <= 100) return "#1589FF";
}

function getGradientColor(start_color, end_color, percent) {
  start_color = start_color.replace(/^\s*#|\s*$/g, "");
  end_color = end_color.replace(/^\s*#|\s*$/g, "");
  if (start_color.length == 3) {
    start_color = start_color.replace(/(.)/g, "$1$1");
  }
  if (end_color.length == 3) {
    end_color = end_color.replace(/(.)/g, "$1$1");
  }
  var start_red = parseInt(start_color.substr(0, 2), 16),
    start_green = parseInt(start_color.substr(2, 2), 16),
    start_blue = parseInt(start_color.substr(4, 2), 16);
  var end_red = parseInt(end_color.substr(0, 2), 16),
    end_green = parseInt(end_color.substr(2, 2), 16),
    end_blue = parseInt(end_color.substr(4, 2), 16);
  var diff_red = end_red - start_red;
  var diff_green = end_green - start_green;
  var diff_blue = end_blue - start_blue;
  diff_red = (diff_red * percent + start_red).toString(16).split(".")[0];
  diff_green = (diff_green * percent + start_green).toString(16).split(".")[0];
  diff_blue = (diff_blue * percent + start_blue).toString(16).split(".")[0];
  if (diff_red.length == 1) diff_red = "0" + diff_red;
  if (diff_green.length == 1) diff_green = "0" + diff_green;
  if (diff_blue.length == 1) diff_blue = "0" + diff_blue;
  return "#" + diff_red + diff_green + diff_blue;
}

function dateToYMD(offset, separator = "") {
  var dateOffset = 24 * 60 * 60 * 1000 * offset; // offset days
  var d = new Date();
  d.setTime(d.getTime() - dateOffset);
  return (
    d.getFullYear() +
    separator +
    (d.getMonth() + 1 < 10 ? "0" + (d.getMonth() + 1) : d.getMonth() + 1) +
    separator +
    (d.getDate() < 10 ? "0" + d.getDate() : d.getDate())
  );
}

function YMDToDate(ymd) {
  let month = ymd.substr(4, 2) - 1;
  return new Date(
    ymd.substr(0, 4),
    10 > month ? "0" + month : month,
    ymd.substr(6, 2)
  );
}

/** @type {Dashboard} */
var dashb = new Dashboard({
  global: {
    css:
      "\
        .widget {resize:both;overflow:auto;margin:10px;padding:10px;background:white;border: 1px #d7dfe3 solid;border-radius:4px;-webkit-box-shadow: 0px 5px 20px rgba(0, 0, 0, 0.05);box-shadow: 0px 5px 20px rgba(0, 0, 0, 0.05);}\
        .widget .title {color:green;}\
        .widget .content {}\
        .widget .rows {font-size:30px;color:green;text-align:center}\
        .widget.section {background:#636363 !important;color:white !important}\
        .widget.section h2 {margin:2px}\
        .widget.section p {margin:2px}\
        .widget table {background:white}\
        .widget table > thead {background:gray;color:white}\
      ",
  },
  widget: {
    html:
      '\
        <div onresize="console.log(\'t\');" class="widget" id="%ID%" style="width:%WIDTH%px;height:%HEIGHT%px">\n\
            <h2 id="title_%ID%" onclick="%CALLBACK%(\'%ID%\');" style="white-space:nowrap;overflow:hidden">%TITLE%</h2>\n\
            <div id="content_%ID%" class="content" style="width:100%;overflow:auto">\n\
              <div id="rows_%ID%" class="rows"></div>\n\
            </div>\n\
        </div>\
      ',
  },
  db: {
    schema: schema,
    filters: filters,
    widgetFilter: {
      yearMonthDay: ["BETWEENEQ (" + dateToYMD(365) + "," + dateToYMD(0) + ")"],
    },
    //globalFilter:{user: ['NOT BEGIN (Marc Segarra)','NOT BEGIN (Admin)','NOT BEGIN (Daniel Amo)','NOT BEGIN (Maria Alsina)','NOT BEGIN (Roger Olivella)','NOT BEGIN (Silvia Carretero)','NOT BEGIN (Eduard de Torres)','NOT BEGIN (Alba LLau)']}
    //widgetFilter: { yearMonthDay: ['BETWEENEQ (20000212,20200727)'] }
  },
});

/** @type {codemirror} */
var codeditor;

/**
 * Callback for input file change event.
 * @callback changeInputFile
 * @param {event} e - The event value.
 */
function changeInputFile(e) {
  displayFileContents(createLoadingContent());
  dashb.msldb.readLogFromFile(e, rlffOnLoad, rlffOnProgress);
}

function createLoadingContent() {
  return '<p id="loading-content">Loading content...</p><div class="loader"></div>';
}

function showFileReaderError() {
  return '<div class="timeout-error">There was an error reading the file. Please refresh the page and try again.</div>';
}

function showTimeoutError() {
  return '<div class="timeout-error">Reading the file took too long. Please refresh the page and try again.</div>';
}

/**
 * Callback for load dashboard input file change event.
 * @callback fillDashboard
 * @param {event} e - The event value.
 */
function fillDashboard(e) {
  dashb.readFromFile(e, rlffDashbOnLoad);
}

/**
 * Callback for fillDashboard on load management.
 * @callback rlffDashbOnLoad
 * @param {event} e - The event value.
 */
function rlffDashbOnLoad(e) {
  // dashboard initialization
  dashb.init();

  renderDashboard(e.widgets);
}

function navigatorFilter(index, val, field) {
  //let navigator = document.getElementById("menu-navigator");
  dashb.msldb.widgetFilter = dashb.msldb.widgetFilter || {};
  if (0 == index) val = "";
  dashb.msldb.widgetFilter[field] = ["BEGIN (" + val + ")"];
  //dashb.msldb.init();
  reRenderDashboard();
}

function reRenderDashboard() {
  if (0 < dashb.widgets.length) {
    let dashLoader = document.getElementById("loading-resources");

    document.getElementById("widgets").innerHTML = "";
    document.getElementById("widgets").style.opacity = 0.5;

    dashLoader.style.display = "block";

    let renderPromise = new Promise((resolve, reject) => {
      setTimeout(function () {
        resolve();
      }, 250);
    });

    renderPromise.then(() => {
      renderDashboard(dashb.widgets);
    });
  }
}

/**
 * Callback for readLogFromFile on load management.
 * @callback rlffOnLoad
 * @param {event} e - The event value.
 */
function rlffOnLoad(e, error) {
  // if (error !== null && error.errno === 2) {
  //   displayFileContents(showFileReaderError());
  // } else {
  let logLabel = document.getElementById("file-log-label");
  let dropArea = document.getElementById("drop-area");
  let subHeader = document.getElementById("subheader");
  let menuBar = document.getElementById("menu-bar");
  let menuLeft = document.getElementById("menu-left");
  let subjectName = dashb.msldb.logs[0].context.split("_")[1];

  subHeader.style.display = "flex";
  menuBar.style.display = "block";
  menuLeft.style.display = "flex";
  dropArea.style.display = "none";
  logLabel.innerHTML = "Log: <b>" + e.fileName + "</b>";
  document.title = subjectName + " | Moodle Log Analytics";

  renderDefaultDashboard();
  // }
}

const timeoutPromise = function (ms, promise) {
  // Create a promise that rejects in <ms> milliseconds
  let timeout = new Promise((resolve, reject) => {
    let id = setTimeout(() => {
      clearTimeout(id);
      reject("Timed out in " + ms + "ms.");
    }, ms);
  });

  // Returns a race between our timeout and the passed in promise
  return Promise.race([promise, timeout]);
};

/**
 * Callback for readLogFromFile progress management.
 * @callback rlffOnEventProgress
 * @param {event} e - The event value.
 */
function rlffOnProgress(e) {
  let dataLoadingPromise = function () {
    return new Promise((resolve, reject) => {
      let total = Math.floor(Math.round(e.total / 1024 / 1024));
      let progress = Math.floor(Math.round(e.loaded / 1024 / 1024));
      let lcP = document.getElementById("loading-content");
      lcP.innerHTML = "Loading content (" + progress + " of " + total + ")...";
    });
  };

  let loading = timeoutPromise(15000, dataLoadingPromise());

  loading.catch(() => {
    displayFileContents(showTimeoutError());
  });
}

function createWidgets(widgets) {
  widgets.forEach((widget) => {
    dashb.createWidget(widget);
  });
}

function renderDashboard(widgets) {
  if (0 < dashb.widgets.length) {
    let dashLoader = document.getElementById("loading-resources");
    let dashLoaderMsg = document.getElementById("loading-resources-msg");
    let dashLoaderN = document.getElementById("loading-resources-n");
    let dashLoaderTotal = document.getElementById("loading-resources-total");

    dashLoaderMsg.innerHTML = "Loading charts resources";
    dashLoaderTotal.innerHTML = widgets.length;
    dashLoaderN.innerHTML = "0";
    dashLoader.style.display = "block";
    checkRender();
  }
}

function renderDefaultDashboard() {
  let widgets = [];

  let widgetsTemplate = [
    /* Campo editable de texto asignado a cada campo del filtro (por ejemplo usuario) */
    /* Poder cargar la información de dos campos distintos y filtros distintos */
    {
      html:
        '<div class="widget" style="flex-basis: 100%;">\
      <h1>Dashboard</h1>\
      </div>',
      mode: WIDGET_TEXT,
    },
    {
      html:
        '<div class="widget section" style="flex-basis: 100%;">\
      <h2>1 Resum d\'interaccions en el curs</h2>\
      <p>Informació relativa al número d\'interaccions</p>\
      </div>',
      mode: WIDGET_TEXT,
    },
    {
      height: 200,
      size: 0.5,
      css: ".widget .rowsOnly {font-weight:bold}",
      title: "Total",
      srcJS: "https://canvasjs.com/assets/script/canvasjs.min.js",
      srcCSS: "",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{let number = "%COUNT%"-0;document.getElementById("rows_%ID%").classList.add("rowsOnly");document.getElementById("rows_%ID%").innerHTML = number.toLocaleString();}',
      kpi: "",
    },
    {
      height: 200,
      size: 0.5,
      title: "Tasques",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{let number = "%COUNT%"-0;document.getElementById("rows_%ID%").innerHTML = number.toLocaleString();}',
      field: "event",
      filter: { description: ["CONTAINS (assignment)"] },
    },
    {
      height: 200,
      size: 0.5,
      title: "Fitxer",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{let number = "%COUNT%"-0;document.getElementById("rows_%ID%").innerHTML = number.toLocaleString();}',
      field: "event",
      filter: {
        component: ["IN (Fitxer)"],
        description: ["CONTAINS ('resource' activity)"],
      },
    },
    {
      height: 200,
      size: 0.5,
      title: "Pàgines",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{let number = "%COUNT%"-0;document.getElementById("rows_%ID%").innerHTML = number.toLocaleString();}',
      field: "component",
      filter: { component: ["BEGIN (Pà)"] },
    },
    {
      height: 200,
      size: 0.5,
      title: "URL",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{let number = "%COUNT%"-0;document.getElementById("rows_%ID%").innerHTML = number.toLocaleString();}',
      field: "component",
      filter: { component: ["IN (URL)"] },
    },
    {
      height: 200,
      size: 0.5,
      title: "LTI",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{let number = "%COUNT%"-0;document.getElementById("rows_%ID%").innerHTML = number.toLocaleString();}',
      field: "component",
      filter: { component: ["CONTAINS (lti)"] },
    },
    {
      height: 200,
      size: 0.5,
      title: "Wiki",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{let number = "%COUNT%"-0;document.getElementById("rows_%ID%").innerHTML = number.toLocaleString();}',
      field: "component",
      filter: { component: ["CONTAINS (Wiki)"] },
    },
    {
      html: '<div style="flex-basis: 100%;"></div>',
      mode: WIDGET_TEXT,
    },
    {
      visible: false,
      mode: WIDGET_CODE_SNIPPET,
      snippet: "[%LABELS%,%VALUES%]",
      field: "yearMonthDay",
      sortBy: "key",
      filter: { component: ["BEGIN (Pà)"] },
    },
    {
      visible: false,
      mode: WIDGET_CODE_SNIPPET,
      snippet: "[%LABELS%,%VALUES%]",
      field: "yearMonthDay",
      sortBy: "key",
      filter: { component: ["IN (URL)"] },
    },
    {
      width: "1000",
      height: "300",
      title: "Timeline d'interaccions",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '\
      let labels = %LABELS%;\
      let values = %VALUES%;\
      let dataPoints = new Array();\
      for (let i = 0; i < labels[0].length; i++){\
        dataPoints.push({x:new Date(labels[0][i].substr(0,4), labels[0][i].substr(4,2)-1, labels[0][i].substr(6,2)),y:values[0][i]});\
      };\
      let dataPoints2 = new Array();\
      for (let i = 0; i < labels[1].length; i++){\
        dataPoints2.push({x:new Date(labels[1][i].substr(0,4), labels[1][i].substr(4,2)-1, labels[1][i].substr(6,2)),y:values[1][i]});\
      };\
      let dataPoints3 = new Array();\
      for (let i = 0; i < labels[2].length; i++){\
        dataPoints3.push({x:new Date(labels[2][i].substr(0,4), labels[2][i].substr(4,2)-1, labels[2][i].substr(6,2)),y:values[2][i]});\
      };\
      let dataPoints4 = new Array();\
      for (let i = 0; i < labels[3].length; i++){\
        dataPoints4.push({x:new Date(labels[3][i].substr(0,4), labels[3][i].substr(4,2)-1, labels[3][i].substr(6,2)),y:values[3][i]});\
      };\
      let dataPoints5 = new Array();\
      for (let i = 0; i < labels[4].length; i++){\
        dataPoints5.push({x:new Date(labels[4][i].substr(0,4), labels[4][i].substr(4,2)-1, labels[4][i].substr(6,2)),y:values[4][i]});\
      };\
      document.getElementById("content_%ID%").style.height = (%HEIGHT%-70)+"px";\
      var chart = new CanvasJS.Chart("content_%ID%", {\
        height:%HEIGHT%-70\
        ,animationEnabled: true,\
        title:{\
          text: ""\
        },\
        toolTip: {\
          shared: true\
        },\
        legend: {\
          cursor: "pointer",\
          verticalAlign: "top",\
          itemWidth:150\
        },\
        data: [\
          {\
            type: "line",\
            name: "Total",\
            showInLegend: true,\
            dataPoints: dataPoints\
          },\
          {\
            type: "line",\
            name: "Tasca",\
            showInLegend: true,\
            dataPoints: dataPoints2\
          },\
          {\
            type: "line",\
            name: "Fitxer",\
            showInLegend: true,\
            dataPoints: dataPoints3\
          },\
          {\
            type: "line",\
            name: "Pàgina",\
            showInLegend: true,\
            dataPoints: dataPoints4\
          },\
          {\
            type: "line",\
            name: "URL",\
            showInLegend: true,\
            dataPoints: dataPoints5\
          }\
        ]\
      });\
      chart.render();',
      field: "yearMonthDay",
      sortBy: "key",
      filter: [
        {},
        { description: ["CONTAINS (assignment)"] },
        {
          component: ["IN (Fitxer)"],
          description: ["CONTAINS ('resource' activity)"],
        },
        { component: ["BEGIN (Pà)"] },
        { component: ["IN (URL)"] },
      ],
    },
    {
      width: "1000",
      height: "500",
      title: "Interaccions dies i franja horària",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{\
            let widget = document.getElementById("content_%ID%");\
            let labels = %LABELS%;\
            let values = %VALUES%;\
            let height = %HEIGHT% - 100;\
            let diesHores = {};\
            let maxVal = 0;\
            for (let i = 0; i < labels.length; i++){\
              let wDate = new Date(labels[i]*1000);\
              if (undefined === diesHores[wDate.getDay()])\
                diesHores[wDate.getDay()] = {};\
              if (undefined === diesHores[wDate.getDay()][wDate.getHours()])\
                diesHores[wDate.getDay()][wDate.getHours()] = 0;\
              diesHores[wDate.getDay()][wDate.getHours()] += values[i];\
              if (diesHores[wDate.getDay()][wDate.getHours()] > maxVal)\
                maxVal = diesHores[wDate.getDay()][wDate.getHours()];\
            }\
            diesHores[7] = diesHores[0];\
            let str = "<table>\
                <thead>\
                    <tr>\
                        <th class=\\"tdLeft\\" style=\\"width:100px\\">Franja</th>\
                        <th class=\\"tdCenter\\" style=\\"width:100px\\">Dilluns</th>\
                        <th class=\\"tdCenter\\" style=\\"width:100px\\">Dimarts</th>\
                        <th class=\\"tdCenter\\" style=\\"width:100px\\">Dimecres</th>\
                        <th class=\\"tdCenter\\" style=\\"width:100px\\">Dijous</th>\
                        <th class=\\"tdCenter\\" style=\\"width:100px\\">Divendres</th>\
                        <th class=\\"tdCenter\\" style=\\"width:100px\\">Dissabte</th>\
                        <th class=\\"tdCenter\\" style=\\"width:100px\\">Diumenge</th>\
                    </tr>\
                </thead>\
                <tbody style=\'max-height:"+height+"px\'>";\
                for (let i = 0; i <24; i++) {\
                  str += "<tr>";\
                  str += "<td class=\\"tdLeft\\" style=\\"width:100px\\">" + i + ":00-"+i+":59</td>";\
                  for (let j = 1; j <= 7; j++) {\
                    diesHores[j] = diesHores[j] || {};\
                    let val = ((undefined !== diesHores[j][i])?diesHores[j][i]:0);\
                    str += "<td class=\\"tdCenter\\" style=\\"background:"+gradient(maxVal,val)+";width:100px\\">" + val.toLocaleString() + "</td>";\
                  }\
                  str += "</tr>";\
                }\
                str += "</tbody>\
                </table>";\
              widget.insertAdjacentHTML("afterbegin", str);\
          }',
      field: "timestamp",
    },
    {
      html:
        '<div class="widget section" style="flex-basis: 100%;">\
      <h2>2 Estudiants</h2>\
      <p>Informació relativa a les interaccions dels estudiants</p>\
      </div>',
      mode: WIDGET_TEXT,
    },
    {
      width: "1000",
      height: "300",
      title: "Últim accés i estudiant",
      srcJS: "https://canvasjs.com/assets/script/canvasjs.min.js",
      srcCSS: "",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '\
      let labels = %LABELS%;\
      let values = %VALUES%;\
      let lvGroup = {};\
      let lvGroupStudent = {};\
      let dataPoints = new Array();\
      let maxDays = 0;\
      for (let i = 0; i < labels.length; i++){\
        let diff = new Date().diffTimestamp(values[i]);\
        lvGroup[diff.days] = ((undefined!==lvGroup[diff.days])?lvGroup[diff.days]:0) + 1;\
        if (undefined===lvGroupStudent[diff.days])\
        {\
          lvGroupStudent[diff.days] = new Array();\
        }\
        lvGroupStudent[diff.days][lvGroupStudent[diff.days].length] = labels[i];\
        maxDays = (diff.days > maxDays)?diff.days:maxDays;\
      };\
      for (let prop in lvGroup){\
        dataPoints.push({x:prop,y:lvGroup[prop]});\
      };\
      document.getElementById("content_%ID%").style.height = (%HEIGHT%-70)+"px";\
      var chart = new CanvasJS.Chart("content_%ID%", {\
        height:%HEIGHT%-70\
        ,animationEnabled: true,\
        title:{\
          text: ""\
        },\
        toolTip: {\
          contentFormatter: function ( e ) {\
                      return "Fa " +  e.entries[0].dataPoint.x + " dies accediren " + e.entries[0].dataPoint.y + " estudiants<br/>" + lvGroupStudent[e.entries[0].dataPoint.x].join("<br/>");  \
          },\
          shared: true\
        },\
        legend: {\
          cursor: "pointer",\
          verticalAlign: "top",\
          itemWidth:150\
        },\
        axisX:{\
          interval: 5,\
          maximum: maxDays+1,\
          includeZero: true\
        },\
        data: [\
          {\
            type: "line",\
            name: "Estudiants",\
            showInLegend: true,\
            dataPoints: dataPoints\
          },\
        ]\
      });\
      chart.render();',
      field: "fullName",
      calcFn: { fn: "lastconnection", field: "timestamp" },
    },
    {
      width: "1000",
      height: "500",
      title: "Mapa calor Accesos Recursos - Estudiant",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{\
        let widget = document.getElementById("content_%ID%");\
        let labels = %LABELS%;\
        let values = %VALUES%;\
        let height = %HEIGHT% - 100;\
        let axisX = new Array();\
        for (let i = 0; i < labels.length; i++) {\
          for (let prop in values[i]){\
            axisX[prop] = 0;\
          }\
        }\
        let str = "<table style=\\"min-width:150px\\">\
            <thead>\
                <tr>\
                    <th style=\\"min-width:150px;max-width:150px;white-space: nowrap\\" class=\\"tdLeft\\">Recurs</th>";\
                    for (let prop in axisX){\
                      str += "<th title=\\"" + prop + "\\" style=\\"min-width:40px;max-width:40px;overflow: hidden;text-overflow: ellipsis;width:150px;white-space: nowrap\\" class=\\"tdCenter\\">" + prop + "</th>";\
                    };\
        str += "</tr>\
            </thead>\
            <tbody style=\'max-height:"+height+"px\'>";\
        let maxVal = 0;\
        for (let i = 0; i < labels.length; i++) {\
          for (let prop in axisX){\
            let val = ((undefined!==values[i][prop])?values[i][prop]:0);\
            if (val > maxVal)\
              maxVal = val;\
          };\
        };\
        for (let i = 0; i < labels.length; i++) {\
            str += "<tr>";\
            str += "<td title=\\"" + labels[i].replace(\'"\',\'"\') + "\\" style=\\"min-width:150px;max-width:150px;overflow: hidden;text-overflow: ellipsis;width:150px;white-space: nowrap\\" class=\\"tdLeft\\">" + labels[i] + "</td>";\
            for (let prop in axisX){\
              let val = ((undefined!==values[i][prop])?values[i][prop]:0);\
              str += "<td style=\\"min-width:40px;width:40px;white-space: nowrap;background:"+gradient(maxVal,val)+"\\" class=\\"tdRight\\">" + val.toLocaleString() + "</td>";\
            };\
            str += "</tr>"; };\
        str += "</tbody>\
            </table>";\
        widget.insertAdjacentHTML("afterbegin", str);\
      }',
      sortBy: "key",
      order: "ASC",
      field: "context",
      calcFn: { fn: "countgroup", field: "fullName" },
      filter: { fullName: ["NOT BEGIN (undefined)"] },
    },
    {
      width: "475",
      height: "500",
      title: "Participació",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{\
        let interactions = dashb.widgets[2].data.values[0];\
        let widget = document.getElementById("content_%ID%");\
        let labels = %LABELS%;\
        let values = %VALUES%;\
        let height = %HEIGHT% - 100;\
        let str = "<table>\
            <thead>\
                <tr>\
                    <th  class=\\"tdLeft\\">Estudiant</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">%</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">#</th>\
                </tr>\
            </thead>\
            <tbody style=\'max-height:"+height+"px\'>";\
        for (let i = 0; i < labels.length; i++) {\
            let percent = (values[i]*100)/interactions;\
            str += "<tr>";\
            str += "<td class=\\"tdLeft\\">" + labels[i] + "</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdCenter " + ((10<percent)?"tdGreenLight":((5<percent)?"tdOrangeLight":"tdRedLight")) + "\\">" + (Math.round(percent*100)/100).toLocaleString() + "%</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdRight\\">" + values[i] + "</td>";\
            str += "</tr>"; };\
        str += "</tbody>\
            </table>";\
        widget.insertAdjacentHTML("afterbegin", str);\
      }',
      sortBy: "key",
      order: "ASC",
      field: "fullName",
    },
    {
      width: "475",
      height: "500",
      title: "Últim accés",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{\
        let interactions = dashb.widgets[2].data.values[0];\
        let widget = document.getElementById("content_%ID%");\
        let labels = %LABELS%;\
        let values = %VALUES%;\
        let height = %HEIGHT% - 100;\
        let str = "<table>\
            <thead>\
                <tr>\
                    <th class=\\"tdLeft\\">Estudiant</th>\
                    <th style=\\"width:160px;\\" class=\\"tdCenter\\">Últim accés</th>\
                </tr>\
            </thead>\
            <tbody style=\'max-height:"+height+"px\'>";\
        for (let i = 0; i < labels.length; i++) {\
          if (labels[0].length){\
            let wDate = new Date(values[i]*1000).toLocaleString();\
            let percent = (values[i]*100)/interactions;\
            let wDateDiff = new Date().diffTimestamp(values[i]);\
            let wDateStr = wDateDiff.days+" dies "+wDateDiff.hours+" hores <br />"+wDateDiff.minutes+" minuts, "+Math.floor(wDateDiff.seconds)+" segons";\
            str += "<tr>";\
            str += "<td class=\\"tdLeft\\">" + labels[i] + "</td>";\
            str += "<td style=\\"width:160px;\\" class=\\"tdCenter " + ((1>wDateDiff.days)?"tdGreenLight":((3>wDateDiff.days)?"tdOrangeLight":"tdRedLight")) + "\\">" + wDate + "<br/><b>" + wDateStr + "</b></td>";\
            str += "</tr>"; };\
          }\
          str += "</tbody>\
            </table>";\
          widget.insertAdjacentHTML("afterbegin", str);\
        }',
      field: "fullName",
      calcFn: { fn: "lastconnection", field: "timestamp" },
    },
    {
      html:
        '<div class="widget section" style="flex-basis: 100%;">\
      <h2>3 Recursos</h2>\
      <p>Informació relativa a interaccions amb recursos</p>\
      </div>',
      mode: WIDGET_TEXT,
    },
    {
      width: "475",
      height: "500",
      title: "Última interacció recursos",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{\
        let interactions = dashb.widgets[2].data.values[0];\
        let widget = document.getElementById("content_%ID%");\
        let labels = %LABELS%;\
        let values = %VALUES%;\
        let height = %HEIGHT% - 100;\
        let str = "<table>\
            <thead>\
                <tr>\
                    <th class=\\"tdLeft\\">Recurs</th>\
                    <th style=\\"width:160px;\\" class=\\"tdCenter\\">Últim accés</th>\
                </tr>\
            </thead>\
            <tbody style=\'max-height:"+height+"px\'>";\
        for (let i = 0; i < labels.length; i++) {\
          if (labels[0].length){\
            let wDate = new Date(values[i]*1000).toLocaleString();\
            let percent = (values[i]*100)/interactions;\
            let wDateDiff = new Date().diffTimestamp(values[i]);\
            let wDateStr = wDateDiff.days+" dies "+wDateDiff.hours+" hores <br />"+wDateDiff.minutes+" minuts, "+Math.floor(wDateDiff.seconds)+" segons";\
            str += "<tr>";\
            str += "<td class=\\"tdLeft\\">" + labels[i] + "</td>";\
            str += "<td style=\\"width:160px;\\" class=\\"tdCenter " + ((1>wDateDiff.days)?"tdGreenLight":((3>wDateDiff.days)?"tdOrangeLight":"tdRedLight")) + "\\">" + wDate + "<br/><b>" + wDateStr + "</b></td>";\
            str += "</tr>"; };\
          }\
          str += "</tbody>\
            </table>";\
          widget.insertAdjacentHTML("afterbegin", str);\
        }',
      field: "context",
      calcFn: { fn: "lastconnection", field: "timestamp" },
    },
    {
      width: "475",
      height: "500",
      title: "Interaccions amb recursos",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{\
        let interactions = dashb.widgets[2].data.values[0];\
        let widget = document.getElementById("content_%ID%");\
        let labels = %LABELS%;\
        let values = %VALUES%;\
        let height = %HEIGHT% - 100;\
        let str = "<table>\
            <thead>\
                <tr>\
                    <th  class=\\"tdLeft\\">Recurs</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">%</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">#</th>\
                </tr>\
            </thead>\
            <tbody style=\'max-height:"+height+"px\'>";\
        for (let i = 0; i < labels.length; i++) {\
            let percent = (values[i]*100)/interactions;\
            str += "<tr>";\
            str += "<td class=\\"tdLeft\\">" + labels[i] + "</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdCenter " + ((10<percent)?"tdGreenLight":((5<percent)?"tdOrangeLight":"tdRedLight")) + "\\">" + (Math.round(percent*100)/100).toLocaleString() + "%</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdRight\\">" + values[i] + "</td>";\
            str += "</tr>"; };\
        str += "</tbody>\
            </table>";\
        widget.insertAdjacentHTML("afterbegin", str);\
      }',
      sortBy: "key",
      order: "ASC",
      field: "context",
    },
    {
      width: "475",
      height: "500",
      title: "Interaccions amb components",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{\
        let interactions = dashb.widgets[2].data.values[0];\
        let widget = document.getElementById("content_%ID%");\
        let labels = %LABELS%;\
        let values = %VALUES%;\
        let height = %HEIGHT% - 100;\
        let str = "<table>\
            <thead>\
                <tr>\
                    <th  class=\\"tdLeft\\">Component</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">%</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">#</th>\
                </tr>\
            </thead>\
            <tbody style=\'max-height:"+height+"px\'>";\
        for (let i = 0; i < labels.length; i++) {\
            let percent = (values[i]*100)/interactions;\
            str += "<tr>";\
            str += "<td class=\\"tdLeft\\">" + labels[i] + "</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdCenter " + ((10<percent)?"tdGreenLight":((5<percent)?"tdOrangeLight":"tdRedLight")) + "\\">" + (Math.round(percent*100)/100).toLocaleString() + "%</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdRight\\">" + values[i] + "</td>";\
            str += "</tr>"; };\
        str += "</tbody>\
            </table>";\
        widget.insertAdjacentHTML("afterbegin", str);\
      }',
      sortBy: "key",
      order: "ASC",
      field: "component",
    },
    {
      width: "475",
      height: "500",
      title: "Interaccions amb esdeveniments",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{\
        let interactions = dashb.widgets[2].data.values[0];\
        let widget = document.getElementById("content_%ID%");\
        let labels = %LABELS%;\
        let values = %VALUES%;\
        let height = %HEIGHT% - 100;\
        let str = "<table>\
            <thead>\
                <tr>\
                    <th  class=\\"tdLeft\\">Esdeveniment</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">%</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">#</th>\
                </tr>\
            </thead>\
            <tbody style=\'max-height:"+height+"px\'>";\
        for (let i = 0; i < labels.length; i++) {\
            let percent = (values[i]*100)/interactions;\
            str += "<tr>";\
            str += "<td class=\\"tdLeft\\">" + labels[i] + "</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdCenter " + ((10<percent)?"tdGreenLight":((5<percent)?"tdOrangeLight":"tdRedLight")) + "\\">" + (Math.round(percent*100)/100).toLocaleString() + "%</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdRight\\">" + values[i] + "</td>";\
            str += "</tr>"; };\
        str += "</tbody>\
            </table>";\
        widget.insertAdjacentHTML("afterbegin", str);\
      }',
      sortBy: "key",
      order: "ASC",
      field: "event",
    },
    {
      width: "475",
      height: "500",
      title: "Interaccions amb context",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{\
        let interactions = dashb.widgets[2].data.values[0];\
        let widget = document.getElementById("content_%ID%");\
        let labels = %LABELS%;\
        let values = %VALUES%;\
        let height = %HEIGHT% - 100;\
        let str = "<table>\
            <thead>\
                <tr>\
                    <th  class=\\"tdLeft\\">Context</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">%</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">#</th>\
                </tr>\
            </thead>\
            <tbody style=\'max-height:"+height+"px\'>";\
        for (let i = 0; i < labels.length; i++) {\
            let percent = (values[i]*100)/interactions;\
            str += "<tr>";\
            str += "<td class=\\"tdLeft\\">" + labels[i] + "</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdCenter " + ((10<percent)?"tdGreenLight":((5<percent)?"tdOrangeLight":"tdRedLight")) + "\\">" + (Math.round(percent*100)/100).toLocaleString() + "%</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdRight\\">" + values[i] + "</td>";\
            str += "</tr>"; };\
        str += "</tbody>\
            </table>";\
        widget.insertAdjacentHTML("afterbegin", str);\
      }',
      sortBy: "key",
      order: "ASC",
      field: "context",
      filter: { context: ["NOT BEGIN (Curs:)"] },
    },
    {
      width: "475",
      height: "500",
      title: "Interaccions amb URL",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{\
        let interactions = dashb.widgets[2].data.values[0];\
        let widget = document.getElementById("content_%ID%");\
        let labels = %LABELS%;\
        let values = %VALUES%;\
        let height = %HEIGHT% - 100;\
        let str = "<table>\
            <thead>\
                <tr>\
                    <th  class=\\"tdLeft\\">URL</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">%</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">#</th>\
                </tr>\
            </thead>\
            <tbody style=\'max-height:"+height+"px\'>";\
        for (let i = 0; i < labels.length; i++) {\
            let percent = (values[i]*100)/interactions;\
            str += "<tr>";\
            str += "<td class=\\"tdLeft\\">" + labels[i] + "</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdCenter " + ((10<percent)?"tdGreenLight":((5<percent)?"tdOrangeLight":"tdRedLight")) + "\\">" + (Math.round(percent*100)/100).toLocaleString() + "%</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdRight\\">" + values[i] + "</td>";\
            str += "</tr>"; };\
        str += "</tbody>\
            </table>";\
        widget.insertAdjacentHTML("afterbegin", str);\
      }',
      sortBy: "key",
      order: "ASC",
      field: "context",
      filter: { component: ["IN (URL)"] },
    },
    {
      width: "475",
      height: "500",
      title: "Interaccions amb Pàgines",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{\
        let interactions = dashb.widgets[2].data.values[0];\
        let widget = document.getElementById("content_%ID%");\
        let labels = %LABELS%;\
        let values = %VALUES%;\
        let height = %HEIGHT% - 100;\
        let str = "<table>\
            <thead>\
                <tr>\
                    <th  class=\\"tdLeft\\">Pàgina</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">%</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">#</th>\
                </tr>\
            </thead>\
            <tbody style=\'max-height:"+height+"px\'>";\
        for (let i = 0; i < labels.length; i++) {\
            let percent = (values[i]*100)/interactions;\
            str += "<tr>";\
            str += "<td class=\\"tdLeft\\">" + labels[i] + "</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdCenter " + ((10<percent)?"tdGreenLight":((5<percent)?"tdOrangeLight":"tdRedLight")) + "\\">" + (Math.round(percent*100)/100).toLocaleString() + "%</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdRight\\">" + values[i] + "</td>";\
            str += "</tr>"; };\
        str += "</tbody>\
            </table>";\
        widget.insertAdjacentHTML("afterbegin", str);\
      }',
      sortBy: "key",
      order: "ASC",
      field: "context",
      filter: { component: ["IN (Pàgina)"] },
    },
    {
      width: "475",
      height: "500",
      title: "Interaccions amb Eina ext LTI",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        '{\
        let interactions = dashb.widgets[2].data.values[0];\
        let widget = document.getElementById("content_%ID%");\
        let labels = %LABELS%;\
        let values = %VALUES%;\
        let height = %HEIGHT% - 100;\
        let str = "<table>\
            <thead>\
                <tr>\
                    <th  class=\\"tdLeft\\">Eina ext LTI</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">%</th>\
                    <th style=\\"width:50px;\\" class=\\"tdCenter\\">#</th>\
                </tr>\
            </thead>\
            <tbody style=\'max-height:"+height+"px\'>";\
        for (let i = 0; i < labels.length; i++) {\
            let percent = (values[i]*100)/interactions;\
            str += "<tr>";\
            str += "<td class=\\"tdLeft\\">" + labels[i] + "</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdCenter " + ((10<percent)?"tdGreenLight":((5<percent)?"tdOrangeLight":"tdRedLight")) + "\\">" + (Math.round(percent*100)/100).toLocaleString() + "%</td>";\
            str += "<td style=\\"width:50px;\\" class=\\"tdRight\\">" + values[i] + "</td>";\
            str += "</tr>"; };\
        str += "</tbody>\
            </table>";\
        widget.insertAdjacentHTML("afterbegin", str);\
      }',
      sortBy: "key",
      order: "ASC",
      field: "context",
      filter: { component: ["IN (Eina ext LTI)"] },
    },
    {
      width: "1000",
      height: "300",
      title: "Components",
      srcJS: "https://cdn.jsdelivr.net/npm/chart.js@2.8.0",
      srcCSS: "",
      mode: WIDGET_CODE_SNIPPET,
      snippet:
        "var canvas = document.createElement('canvas');\
            canvas.id = 'canvas_%ID%';\
            canvas.width = '%WIDTH%';\
            canvas.style.width = '%WIDTH%';canvas.height = '%HEIGHT%'-70;canvas.style.height = '%HEIGHT%'-70;document.getElementById('content_%ID%').appendChild(canvas);new Chart(document.getElementById('canvas_%ID%').getContext('2d'), {type: 'pie',options:{tooltips: {bodyFontColor:'#000000',bodyFontSize:14,bodyFontStyle:'bold',caretSize:0,xPadding:0,yPadding:0},responsive: false,maintainAspectRatio:false,legend:{position:'left'}},data: {labels: %LABELS%,datasets: [{data: %VALUES%,backgroundColor:['rgb(255, 99, 132)','rgb(54, 162, 235)','rgb(255, 205, 86)','rgb(255, 0, 0)','rgb(0, 255, 0)','rgb(0, 0, 255)']}]}});",
      field: "component",
    },
  ];

  widgets = widgets.concat(widgetsTemplate);

  /* SEMANA VISTA */
  /*
    for (let i = 0; i < 7; i++)
    {
      var dateOffset = (24*60*60*1000) * i; // i days
      var d = new Date();
      d.setTime(d.getTime() - dateOffset);

      let title = [{
        html:'<div style="flex-basis: 100%;">\
        <h1>Dashboard ' + d.toLocaleString() + '</h1>\
        </div>'
        ,mode:DASHBOARD_WIDGET_TEXT
      }];
      widgets = widgets.concat(title);

      // source: https://github.com/jashkenas/underscore/blob/master/underscore.js#L1320
      function isObject(obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
      };
      function iterationCopy(src) {
        let target = {};
        for (let prop in src) {
          if (src.hasOwnProperty(prop)) {
            // if the value is a nested object, recursively copy all it's properties
            if (isObject(src[prop])) {
              target[prop] = iterationCopy(src[prop]);
            } else {
              target[prop] = src[prop];
            }
          }
        }
        return target;
      }


      let wtDates = [];
      for (let j = 1; j < widgetsTemplate.length; j++)
      {
        wtDates[j-1] = iterationCopy(widgetsTemplate[j]);
      }

      let filterDateFromTo = d.getFullYear()+''+((d.getMonth()+1<10)?('0'+(d.getMonth()+1)):(d.getMonth()+1))+''+((d.getDate()<10)?'0'+d.getDate():d.getDate());
      for (let k = 0; k < wtDates.length; k++)
      {
        wtDates[k].filter = {yearMonthDay:['>= ('+filterDateFromTo+') && <= ('+filterDateFromTo+')']};
      }
      
      widgets = widgets.concat(wtDates);
    }*/

  createWidgets(widgets);

  renderDashboard(widgets);
}

function checkRender() {
  let notLoaded = false;
  let numWidgetsLoaded = 0;
  let dashLoaderN = document.getElementById("loading-resources-n");

  dashb.widgets.forEach((widget) => {
    if (
      WIDGET_JS_CSS_LOADING === widget.loaded ||
      WIDGET_JS_LOADED !== (widget.loaded & WIDGET_JS_LOADED) ||
      WIDGET_CSS_LOADED !== (widget.loaded & WIDGET_CSS_LOADED)
    ) {
      notLoaded = true;
    } else {
      numWidgetsLoaded++;
    }
  });
  dashLoaderN.innerHTML = numWidgetsLoaded;
  if (notLoaded) {
    setTimeout(checkRender, 500);
  } else {
    let dashLoaderMsg = document.getElementById("loading-resources-msg");
    let dashLoaderTotal = document.getElementById("loading-resources-total");

    dashLoaderMsg.innerHTML = "Rendering charts";
    dashLoaderTotal.innerHTML = dashb.widgets.length;
    dashLoaderN.innerHTML = "0";

    let renderPromise = new Promise((resolve, reject) => {
      setTimeout(function () {
        resolve();
      }, 250);
    });

    renderPromise.then(() => {
      render();
    });
  }
}

function render() {
  let dashLoaderN = document.getElementById("loading-resources-n");
  let dashLoaderTotal = document.getElementById("loading-resources-total");
  let dashLoader = document.getElementById("loading-resources");

  dashb.widgets.forEach((widget) => {
    let renderPromise = new Promise((resolve, reject) => {
      setTimeout(function () {
        resolve();
      }, 250);
    });

    renderPromise.then(() => {
      dashb.renderWidget(widget, renderJSWidget, renderTextWidget);
      dashLoaderN.innerHTML = parseInt(dashLoaderN.innerHTML) + 1;
      if (dashLoaderTotal.innerHTML == dashLoaderN.innerHTML) {
        dashLoader.style.display = "none";
        navigatorInit("Show all students", "fullName");
        navigatorInit("Show all resources", "context");
        document.getElementById("widgets").style.opacity = 1;
      }
    });
  });
}

function navigatorInit(text, field) {
  if (null == document.getElementById("nav_" + field)) {
    let dataNavObj = {},
      dataNav = [];
    let navigator = document.getElementById("menu-navigator");
    dashb.msldb.logs.forEach((item) => {
      dataNavObj[item[field]] = 0;
    });

    for (let prop in dataNavObj) {
      dataNav.push(prop);
    }

    dataNav.sort();

    let stStr =
      '\
    <form id="nav_' +
      field +
      '" onsubmit="return false;">\
    <button class="btn small" onclick="let sel = this.form.elements[1]; if (sel.selectedIndex>0) {sel.selectedIndex-=1;sel.onchange();}"><i class="fas fa-chevron-left"></i></button>\
    <select style="max-width:250px" onchange="navigatorFilter(this.selectedIndex,this.options[this.selectedIndex].text,\'' +
      field +
      "');\">";
    stStr += "<option>" + text + "</option>";
    dataNav.forEach((item) => {
      stStr += "<option>" + item + "</option>";
    });
    stStr +=
      '</select><button class="btn small" onclick="let sel = this.form.elements[1]; if (sel.selectedIndex<sel.options.length-1) {sel.selectedIndex+=1;sel.onchange();}"><i class="fas fa-chevron-right"></i></button>\
    </form>';
    //if (null != document.getElementById("nav_" + field))
    //  document.getElementById("nav_" + field).remove();
    navigator.insertAdjacentHTML("beforeend", stStr);
  }
}

function renderJSWidget(widget) {
  if (widget.visible) {
    document
      .getElementById("widgets")
      .insertAdjacentHTML("beforeend", widget.evaluatedCSSHTML);
  }

  widget.evalAndExecuteSnippet();
}

function editJSWidget(widget) {
  if (widget.visible) {
    document.getElementById(widget.id).outerHTML = widget.evaluatedCSSHTML;
    //var replacement = document.createElement('lmn');
    //replacement.innerHTML = widget.evaluatedCSSHTML;
    //document.getElementById(widget.id).parentNode.replaceChild(replacement, document.getElementById(widget.id));
    //document.getElementById(widget.id).insertAdjacentHTML('beforeend', widget.evaluatedCSSHTML);
  }

  widget.evalAndExecuteSnippet();
}

function renderTextWidget(widget) {
  if (widget.visible) {
    document
      .getElementById("widgets")
      .insertAdjacentHTML("beforeend", widget.evaluatedCSSHTML);
  }
}

function displayFileContents(contents, visible = true) {
  var element = document.getElementById("file-content");
  element.style.display = visible ? "block" : "none";
  if (undefined !== contents) {
    element.innerHTML = contents;
  }
}

function globalFilter() {
  let fieldsList = [];
  for (let prop in dashb.msldb.logs[0]) {
    fieldsList[fieldsList.length] = prop;
  }

  let filterList = [
    "IN",
    "CONTAINS",
    "BEGIN WITH",
    "END WITH",
    "BETWEEN",
    "BETWEENEQ",
    "EQUAL TO",
    "NOTEQUAL TO",
    "LESS THAN",
    "LESSEQ TAHN",
    "GREATER THAN",
    "GREATEREQ THAN",
  ];

  let typeList = ["string", "number", "date"];

  dashb.modal.headerContent = '<i class="fas fa-filter"></i>Global filter';

  dashb.modal.content =
    '\
    <form onsubmit="return false;">\
      <!--<div>\
        <input type="checkbox" >\
        <label for="meeting-time" style="display:inline-block;width:200px">From date & time:</label>\
        <input type="datetime-local" id="meeting-time"\
           name="meeting-time" value="2018-06-12T19:30"></input>\
      </div>\
      <div>\
        <input type="checkbox" >\
        <label for="meeting-time" style="display:inline-block;width:200px">To date & time:</label>\
        <input type="datetime-local" id="meeting-time"\
           name="meeting-time" value="2018-06-12T19:30"></input>\
      </div>-->\
      <div>\
        <select>' +
    fieldsList.map((field) => {
      return "<option>" + field + "</option>";
    }) +
    "</select>\
        &nbsp;\
        <select>" +
    filterList.map((filter) => {
      return "<option>" + filter + "</option>";
    }) +
    "</select>\
        &nbsp;\
        <select>" +
    typeList.map((type) => {
      return "<option>" + type + "</option>";
    }) +
    '</select>\
      </div>\
      <div>\
        <button onclick="updateGlobalFilter(this.form);">Update global filter</button>\
      </div>\
    </form>';

  dashb.modal.show();
}

function newWidget() {
  let fieldsList = [];
  for (let prop in dashb.msldb.logs[0]) {
    fieldsList[fieldsList.length] = prop;
  }

  dashb.modal.headerContent = '<i class="fas fa-plus"></i>New widget';

  dashb.modal.content =
    '\
  <form onsubmit="return false;">\
    <div>\
      <select>' +
    fieldsList.map((field) => {
      return "<option>" + field + "</option>";
    }) +
    '</select>\
    </div>\
    <div>\
      <button onclick="updateGlobalFilter(this.form);">Add chart</button>\
    </div>\
  </form>';

  dashb.modal.show();
}

function dateFilter() {
  let dates = getDateFilter();

  dashb.modal.headerContent =
    '<i class="fas fa-calendar-alt"></i>&nbsp;Date filter';

  dashb.modal.content =
    '\
  <form onsubmit="return false;">\
    <div>\
      <label for="dateWidgetFrom" style="display:inline-block;width:200px">From date:</label>\
      <input type="date" id="dateWidgetFrom"\
        name="dateWidgetFrom" value="' +
    dates[0] +
    '"></input>\
    </div>\
    <div>&nbsp;</div>\
    <div>\
      <label for="dateWidgetTo" style="display:inline-block;width:200px">To date:</label>\
      <input type="date" id="dateWidgetTo"\
        name="dateWidgetTo" value="' +
    dates[1] +
    '"></input>\
    </div>\
    <div>&nbsp;</div>\
    <div>\
      <button class="btn" onclick="updateDateFilter(this.form.dateWidgetFrom.value, this.form.dateWidgetTo.value);">Update dates</button>\
    </div>\
  </form>';

  dashb.modal.show();
}

function editWidget(id) {
  let widget = dashb.getWidgetById(id);
  dashb.modal.headerContent = widget.title;

  dashb.modal.content =
    '\
    <form onsubmit="return false;">\
      <p>Title</p>\
      <div>\
        <input name="title" type="text" value="' +
    widget._title +
    '">\
      </div>\
      <p>Size</p>\
      <div>\
        <input name="size" type="number" value="' +
    widget._size +
    '">\
      </div>\
      <p>Template</p>\
      <div id="editor-template" class="codemirror-editor">\
        <textarea name="codeditor-template" id="codeditor-template" style="display: none;">' +
    widget._html +
    '</textarea>\
      </div>\
      <p>JavaScript Snippet</p>\
      <div id="editor-js" class="codemirror-editor">\
        <textarea name="codeditor-js" id="codeditor-js" style="display: none;">' +
    widget._snippet +
    "</textarea>\
      </div>\
      <div>\
        <button onclick=\"updateWidget('" +
    id +
    "', this.form);\">Update widget</button>\
        <button onclick=\"deleteWidget('" +
    id +
    "');\">Delete widget</button>\
      </div>\
    </form>";

  dashb.modal.show();

  // Initialize mirror code editor
  let editorTemplate = CodeMirror.fromTextArea(
    document.getElementById("codeditor-template"),
    {
      lineNumbers: true,
      mode: "htmlmixed",
    }
  );

  // Initialize mirror code editor
  let editorJS = CodeMirror.fromTextArea(
    document.getElementById("codeditor-js"),
    {
      lineNumbers: true,
      mode: "htmlmixed",
    }
  );

  // Try to format
  //var totalLines = editor.lineCount();
  //editor.autoFormatRange({line:0, ch:0}, {line:totalLines});
}

function deleteWidget(id) {
  let widget = dashb.getWidgetById(id);
  dashb.widgets.splice(widget._index, 1);

  document.getElementById(widget.id).outerHTML = "";

  dashb.modal.close();
}

function updateWidget(id, form) {
  let widget = dashb.getWidgetById(id);
  widget._size = form.elements["size"].value;
  widget._title = form.elements["title"].value;
  widget._html = form.elements["codeditor-template"].value;
  widget._snippet = form.elements["codeditor-js"].value;

  dashb.modal.close();

  dashb.renderWidget(widget, editJSWidget, function () {});
}

function schema(item) {
  // if first day of month is < 10 then add 0
  if ("/" === item[0].substr(1, 1)) {
    item[0] = "0" + item[0];
  }
  let fields = {
    fullDate: item[0],
    yearMonthDay:
      item[0].substr(6, 4) +
      "" +
      item[0].substr(3, 2) +
      "" +
      item[0].substr(0, 2),
    yearMonthDayHourMinute:
      item[0].substr(6, 4) +
      "" +
      item[0].substr(3, 2) +
      "" +
      item[0].substr(0, 2) +
      "" +
      item[0].substr(11, 2) +
      "" +
      item[0].substr(14, 2),
    timestamp:
      Date.parse(
        item[0].substr(6, 4) +
          "-" +
          item[0].substr(3, 2) +
          "-" +
          item[0].substr(0, 2) +
          "T" +
          item[0].substr(11, 2) +
          ":" +
          item[0].substr(14, 2) +
          ":00"
      ) / 1000,
    user: item[1],
    name: item[1].split(" ")[0],
    middleName: item[1].split(" ")[item[1].split(" ").length - 2],
    lastName: item[1].split(" ")[item[1].split(" ").length - 1],
    affectedUser: item[2],
    context: item[3],
    component: item[4],
    event: item[5],
    description: item[6],
    origin: item[7],
    ip: item[8],
  };

  fields.fullName =
    fields.middleName + " " + fields.lastName + ", " + fields.name;
  fields.fullNameDePersonalized = fields.fullName.dePersonalize();

  return fields;
}

function filters() {
  return {
    IN: {
      regex: /^IN [(](.*)[)]/gm,
      fn: (r, v) => {
        return r.toLowerCase() == v.toLowerCase();
      },
    },
    CONTAINS: {
      regex: /CONTAINS [(](.*)[)]/gm,
      fn: (r, v) => {
        return -1 < r.toLowerCase().indexOf(v.toLowerCase());
      },
    },
    BEGIN: {
      regex: /BEGIN [(](.*)[)]/gm,
      fn: (r, v) => {
        return 0 == r.toLowerCase().indexOf(v.toLowerCase());
      },
    },
    END: {
      regex: /END [(](.*)[)]/gm,
      fn: (r, v) => {
        return r.length - v.length == r.toLowerCase().indexOf(v.toLowerCase());
      },
    },
    BETWEEN: {
      regex: /BETWEEN [(](.*)[)]/gm,
      fn: (r, v1, v2) => {
        return r > v1 && r < v2;
      },
    },
    BETWEENEQ: {
      regex: /BETWEENEQ [(](.*)[)]/gm,
      fn: (r, v1, v2) => {
        return r >= v1 && r <= v2;
      },
    },
    EQUAL: {
      regex: /== [(](.*)[)]/gm,
      fn: (r, v) => {
        return r == v;
      },
    },
    NOTEQUAL: {
      regex: /!= [(](.*)[)]/gm,
      fn: (r, v) => {
        return r != v;
      },
    },
    LESS: {
      regex: /< [(](.*)[)]/gm,
      fn: (r, v) => {
        return r < v;
      },
    },
    LESSEQ: {
      regex: /<= [(](.*)[)]/gm,
      fn: (r, v) => {
        return r <= v;
      },
    },
    GREATER: {
      regex: /> [(](.*)[)]/gm,
      fn: (r, v) => {
        return r > v;
      },
    },
    GREATEREQ: {
      regex: /> [(](.*)[)]/gm,
      fn: (r, v) => {
        return r >= v;
      },
    },
  };
}

function loadDashboard() {
  // File handling
  /** @type {FileHandler} */
  let fileHandler = new FileHandler({
    callback: fillDashboard,
    fileInput: document.getElementById("load-file-input"),
  });
  fileHandler.setHandlers();
  document.getElementById("load-file-input").click();
}

function saveDashboard() {
  let fileName = "dashboard";
  dashb.download(fileName);
}

function loadApp() {
  // File handling
  /** @type {FileHandler} */
  let fileHandler = new FileHandler({
    callback: changeInputFile,
    dropArea: document.getElementById("drop-area"),
    fileInput: document.getElementById("file-input"),
    classHighlight: "highlight",
  });
  fileHandler.setHandlers();

  // dashboard initialization
  dashb.init();

  // date filter
  renderDateFilter();
}

function renderDateFilter() {
  let dateFilter = document.getElementById("date-filter");
  let regex = /BETWEENEQ [(](.*)[)]/gm;
  if ((m = regex.exec(dashb.msldb.widgetFilter.yearMonthDay)) !== null) {
    let values = m[1].split(",");
    dateFilter.innerHTML =
      YMDToDate(values[0]).toLocaleDateString() +
      " - " +
      YMDToDate(values[1]).toLocaleDateString();
  }
}

function getDateFilter() {
  let regex = /BETWEENEQ [(](.*)[)]/gm;
  if ((m = regex.exec(dashb.msldb.widgetFilter.yearMonthDay)) !== null) {
    let values = m[1].split(",");
    values[0] =
      values[0].substr(0, 4) +
      "-" +
      values[0].substr(4, 2) +
      "-" +
      values[0].substr(6, 2);
    values[1] =
      values[1].substr(0, 4) +
      "-" +
      values[1].substr(4, 2) +
      "-" +
      values[1].substr(6, 2);
    return values;
  }
  return [];
}

function updateDateFilter(from, to) {
  dashb.msldb.widgetFilter.yearMonthDay = [
    "BETWEENEQ (" + from.replace(/-/g, "") + "," + to.replace(/-/g, "") + ")",
  ];
  renderDateFilter();
  dashb.modal.close();
  reRenderDashboard();
}

window[addEventListener ? "addEventListener" : "attachEvent"](
  addEventListener ? "load" : "onload",
  loadApp
);
