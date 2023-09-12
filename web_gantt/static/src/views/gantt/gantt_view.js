odoo.define('web_gantt.GanttView', function(require) {
    "use strict";
    var AbstractView = require('web.AbstractView');
    var core = require('web.core');
    // var session = require('web.session');
    var view_registry = require('web.view_registry');

    // var _t = core._t;
    var _lt = core._lt;

    var WebGanttView = AbstractView.extend({
        display_name: _lt('Gantt Chart'),
        icon: 'fa-tasks',
        viewType: 'webgantt',
        cssLibs: [
            'web_gantt/static/lib/tw-gantt/libs/jquery/dateField/jquery.dateField.css',
            'web_gantt/static/lib/tw-gantt/gantt.css',
        ],
        jsLibs: [
            '/web_gantt/static/lib/tw-gantt/libs/jquery/jquery.livequery.1.1.1.min.js',
            
            '/web_gantt/static/lib/tw-gantt/libs/jquery/jquery.timers.js',
            '/web_gantt/static/lib/tw-gantt/libs/utilities.js',
            '/web_gantt/static/lib/tw-gantt/libs/forms.js',
            '/web_gantt/static/lib/tw-gantt/libs/date.js',
            '/web_gantt/static/lib/tw-gantt/libs/dialogs.js',
            '/web_gantt/static/lib/tw-gantt/libs/layout.js',
            '/web_gantt/static/lib/tw-gantt/libs/i18nJs.js',
            '/web_gantt/static/lib/tw-gantt/libs/jquery/dateField/jquery.dateField.js',
            '/web_gantt/static/lib/tw-gantt/libs/jquery/JST/jquery.JST.js',
            '/web_gantt/static/lib/tw-gantt/libs/jquery/valueSlider/jquery.mb.slider.js',
            '/web_gantt/static/lib/tw-gantt/libs/jquery/svg/jquery.svg.min.js',
            '/web_gantt/static/lib/tw-gantt/libs/jquery/svg/jquery.svgdom.1.8.js',
            '/web_gantt/static/lib/tw-gantt/ganttUtilities.js',
            '/web_gantt/static/lib/tw-gantt/ganttTask.js',
            '/web_gantt/static/lib/tw-gantt/ganttDrawerSVG.js',
            '/web_gantt/static/lib/tw-gantt/ganttZoom.js',
            '/web_gantt/static/lib/tw-gantt/ganttGridEditor.js',
            '/web_gantt/static/lib/tw-gantt/ganttMaster.js',
            
            '/web_gantt/static/lib/gantt_ext/date_ext.js?v=1.0.0',
            '/web_gantt/static/lib/gantt_ext/gantt_utilities_ext.js?v=1.0.0',
            '/web_gantt/static/lib/gantt_ext/gantt_task_ext.js?v=1.0.0',
            '/web_gantt/static/lib/gantt_ext/gantt_drawer_svg_ext.js?v=1.0.0',
            '/web_gantt/static/lib/gantt_ext/gantt_zoom_ext.js?v=1.0.0',
            '/web_gantt/static/lib/gantt_ext/gantt_grid_editor_ext.js?v=1.0.0',
            '/web_gantt/static/lib/gantt_ext/gantt_master_ext.js?v=1.0.0',

            '/web_gantt/static/lib/jspdf.js',
            '/web_gantt/static/src/js/OpenSans-Regular-normal.js',
            '/web_gantt/static/lib/html2canvas.js',
            '/web_gantt/static/lib/png.js',
            '/web_gantt/static/lib/zlib.js',
            '/web_gantt/static/lib/ui/ui.js?v=1.0.0'
        ],
    })

    view_registry.add('webgantt', WebGanttView);

    return WebGanttView;
})