odoo.define('viin_web_gantt.ViinGanttView', function(require) {
    "use strict";

    var AbstractView = require('web.AbstractView');
    var core = require('web.core');
    var session = require('web.session');
    var ViinGanttModel = require('viin_web_gantt.ViinGanttModel');
    var ViinGanttRenderer = require('viin_web_gantt.ViinGanttRenderer');
    var ViinGanttController = require('viin_web_gantt.ViinGanttController');
    var view_registry = require('web.view_registry');

    var _t = core._t;
    var _lt = core._lt;

    // gather the fields to get
    var fields_to_gather = [
        "date_start",
        "date_delay", // duration
        "date_stop",
        "consolidation",
        "progress",
        "field_status",
        "depends",
        "manager",
        "members",
        "status",
        "default_group_by",
        "task_alert",
        "child_ids",
        "parent_id",
    ];

    var scales = [
        'day',
        'week',
        'month',
        'year'
    ];

    // determine locale file to load
    var locales_mapping = {
        'ar_SY': 'ar', 'ca_ES': 'ca', 'zh_CN': 'cn', 'cs_CZ': 'cs', 'da_DK': 'da',
        'de_DE': 'de', 'el_GR': 'el', 'es_ES': 'es', 'fi_FI': 'fi', 'fr_FR': 'fr',
        'he_IL': 'he', 'hu_HU': 'hu', 'id_ID': 'id', 'it_IT': 'it', 'ja_JP': 'jp',
        'ko_KR': 'kr', 'nl_NL': 'nl', 'nb_NO': 'no', 'pl_PL': 'pl', 'pt_PT': 'pt',
        'ro_RO': 'ro', 'ru_RU': 'ru', 'sl_SI': 'si', 'sk_SK': 'sk', 'sv_SE': 'sv',
        'tr_TR': 'tr', 'uk_UA': 'ua', 'vi_VN': 'vi',
        'ar': 'ar', 'ca': 'ca', 'zh': 'cn', 'cs': 'cs', 'da': 'da', 'de': 'de',
        'el': 'el', 'es': 'es', 'fi': 'fi', 'fr': 'fr', 'he': 'he', 'hu': 'hu',
        'id': 'id', 'it': 'it', 'ja': 'jp', 'ko': 'kr', 'nl': 'nl', 'nb': 'no',
        'pl': 'pl', 'pt': 'pt', 'ro': 'ro', 'ru': 'ru', 'sl': 'si', 'sk': 'sk',
        'sv': 'sv', 'tr': 'tr', 'uk': 'ua', 'vi': 'vi',
    };
    var current_locale = session.user_context.lang || 'en_US';
    var current_short_locale = current_locale.split('_')[0];
    var locale_code = locales_mapping[current_locale] || locales_mapping[current_short_locale];
    var locale_suffix = locale_code !== undefined ? '_' + locale_code : '';

    var ViinGanttView = AbstractView.extend({
        display_name: _lt('Viin Gantt'),
        icon: 'fa-tasks',
        config: _.extend({}, AbstractView.prototype.config, {
            Model: ViinGanttModel,
            Controller: ViinGanttController,
            Renderer: ViinGanttRenderer,
        }),
        viewType: 'viin_gantt',
        cssLibs: [
/*          '/viin_web_gantt/static/lib/tw-gantt-2/ganttPrint.css',*/
            '/viin_web_gantt/static/lib/tw-gantt/libs/jquery/dateField/jquery.dateField.css',
            '/viin_web_gantt/static/lib/tw-gantt/gantt.css',
        ],
        assetLibs: ['viin_web_gantt.compiled_assets_gantt'],
        jsLibs: [
            '/viin_web_gantt/static/lib/tw-gantt/libs/jquery/jquery.livequery.1.1.1.min.js',
            // '/viin_web_gantt/static/lib/jquery.ui/jquery-ui.min.js',
            
            '/viin_web_gantt/static/lib/tw-gantt/libs/jquery/jquery.timers.js',
            '/viin_web_gantt/static/lib/tw-gantt/libs/utilities.js',
            '/viin_web_gantt/static/lib/tw-gantt/libs/forms.js',
            '/viin_web_gantt/static/lib/tw-gantt/libs/date.js',
            '/viin_web_gantt/static/lib/tw-gantt/libs/dialogs.js',
            '/viin_web_gantt/static/lib/tw-gantt/libs/layout.js',
            '/viin_web_gantt/static/lib/tw-gantt/libs/i18nJs.js',
            '/viin_web_gantt/static/lib/tw-gantt/libs/jquery/dateField/jquery.dateField.js',
            '/viin_web_gantt/static/lib/tw-gantt/libs/jquery/JST/jquery.JST.js',
            '/viin_web_gantt/static/lib/tw-gantt/libs/jquery/valueSlider/jquery.mb.slider.js',
            '/viin_web_gantt/static/lib/tw-gantt/libs/jquery/svg/jquery.svg.min.js',
            '/viin_web_gantt/static/lib/tw-gantt/libs/jquery/svg/jquery.svgdom.1.8.js',
            '/viin_web_gantt/static/lib/tw-gantt/ganttUtilities.js',
            '/viin_web_gantt/static/lib/tw-gantt/ganttTask.js',
            '/viin_web_gantt/static/lib/tw-gantt/ganttDrawerSVG.js',
            '/viin_web_gantt/static/lib/tw-gantt/ganttZoom.js',
            '/viin_web_gantt/static/lib/tw-gantt/ganttGridEditor.js',
            '/viin_web_gantt/static/lib/tw-gantt/ganttMaster.js',
            
            '/viin_web_gantt/static/lib/gantt_ext/date_ext.js?v=1.0.0',
            '/viin_web_gantt/static/lib/gantt_ext/gantt_utilities_ext.js?v=1.0.0',
            '/viin_web_gantt/static/lib/gantt_ext/gantt_task_ext.js?v=1.0.0',
            '/viin_web_gantt/static/lib/gantt_ext/gantt_drawer_svg_ext.js?v=1.0.0',
            '/viin_web_gantt/static/lib/gantt_ext/gantt_zoom_ext.js?v=1.0.0',
            '/viin_web_gantt/static/lib/gantt_ext/gantt_grid_editor_ext.js?v=1.0.0',
            '/viin_web_gantt/static/lib/gantt_ext/gantt_master_ext.js?v=1.0.0',

            '/viin_web_gantt/static/lib/jspdf.js',
            '/viin_web_gantt/static/src/js/OpenSans-Regular-normal.js',
            '/viin_web_gantt/static/lib/html2canvas.js',
            '/viin_web_gantt/static/lib/png.js',
            '/viin_web_gantt/static/lib/zlib.js',
            '/viin_web_gantt/static/lib/ui/ui.js?v=1.0.0'
        ],
        /**
         * @override
         */
        init: function(viewInfo, params) {            
            this._super.apply(this, arguments);
            // Check require attr
            var requiredAttr = ['date_start', 'date_stop', 'default_group_by'];
            var requireAttrForStage = ['field_status'];
            var missingAttr;
            for ( var i = 0; i < requiredAttr.length; i++) {
                var attr = requiredAttr[i];
                if(!this.arch.attrs[attr]) {
                    missingAttr = attr;
                }
            }
            if(this.arch.attrs.status == 'stage') {
                for ( var i = 0; i < requireAttrForStage.length; i++) {
                    var attr = requireAttrForStage[i];
                    if(!this.arch.attrs[attr]) {
                        missingAttr = attr;
                    }
                }
            }
            if(missingAttr) {
                console.error('Missing attribute ' + missingAttr);
            }

            var arch = this.arch;
            var fields = viewInfo.fields;
            var mapping = {
                name: 'name',
                user: 'user_id',
                create_date: 'create_date'
            };
            var defaultOrderStr = arch.attrs.default_order_by || '';
            // gather the fields to get
            _.each(fields_to_gather, function(field) {
                if (arch.attrs[field]) {
                    mapping[field] = arch.attrs[field];
                }
            });
            // consolidation exclude, get the related fields
            if (arch.attrs.consolidation_exclude) {
                _.each(arch.attrs.consolidation_exclude, function(field_name) {
                    mapping.consolidation_exclude = field_name;
                });
            }
            var scale = arch.attrs.scale_zoom;
            if (!_.contains(scales, scale)) {
                scale = "month";
            }
            this.controllerParams.context = params.context || {};
            this.controllerParams.title = params.action ? params.action.name : _t("Viin Gantt");
            this.loadParams.fields = fields;
            this.loadParams.mapping = mapping;
            this.loadParams.scale = scale;
            this.loadParams.initialDate = moment(params.initialDate || new Date());
            this.loadParams.defaultOrderBy = this.parseStringToOrderBy(defaultOrderStr);
        },

        start: function() {
            var stop = '';
            return this._super();
        },

        parseStringToOrderBy: function(str) {
            var orderbys = [];
            var s = str.split(',');
            for (var i = 0; i < s.length; i++) {
                if(!s[i]) continue;
                var s1 = s[i].split(' ');
                var orderByVal = {};
                for (var j = 0; j < s1.length; j++) {
                    var w = s1[j];
                    if(!w) continue;
                    orderByVal.asc = true;
                    if(!/^\s*$/.test(w) && ['asc', 'desc'].indexOf(w) >= 0) {
                        orderByVal.asc = w == 'asc' ? true : false;
                    } else if(!/^\s*$/.test(w)) {
                        orderByVal.name = w;
                    }
                }
                orderbys.push(orderByVal);
                
            }
            return orderbys;
        }
    });
    
    view_registry.add('viin_gantt', ViinGanttView);

    return ViinGanttView;

});
