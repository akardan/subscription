odoo.define('viin_web_gantt.ViinGanttModel', function(require) {
    "use strict";

    var AbstractModel = require('web.AbstractModel');

    var ViinGanttModel = AbstractModel.extend({
        /**
         * @override
         */
        init: function() {
            this._super.apply(this, arguments);
            this.gantt = null;
			this.task_count = 0;
			// Log scrollbar scrolling time to loading data, if go up -1, if go down +1
			this.record_limit = 50;
        },

        start: function() {
            var stop = '';
            return this._super();
        },

        /**
         * @override
         * @returns {Object}
         */
        get: function() {
            var res = _.extend({}, this.gantt);
            return res;
        },

        /**
         * Called by the View's _loadData() to load gantt data
         *
         * @param {Object} params
         * @returns {Deferred<any>}
         */
        load: function(params) {
			var fields = params.fields;
			if(fields.sequence) {
				params.mapping['sequence'] = 'sequence';
			}
            this.modelName = params.modelName;
            this.mapping = params.mapping;
            this.fields = params.fields;
            this.gantt = {
                fields: this.fields,
                mapping: this.mapping,
                to_grouped_by: params.groupedBy,
                domain: params.domain || [],
                context: params.context || {},
				ordered_by: params.orderedBy || params.defaultOrderBy,
                modelName: params.modelName
            };
            this._setFocusDate(params.initialDate, params.scale);
            return this._loadGantt();
        },

        /**
         * Same as 'load'
         *
         * @returns {Deferred<any>}
         */
        reload: function(handle, params) {
            if (params.domain) {
                this.gantt.domain = params.domain;
            }
			this.gantt.domain = this.gantt.domain.concat(this.scale_domain)
            if (params.context) {
                this.gantt.context = params.context;
            }
            if (params.groupBy) {
                this.gantt.to_grouped_by = params.groupBy;
            }
			if (params.limit >= 0) {
                this.gantt.limit = params.limit;
            }
			if (params.offset >= 0) {
                this.gantt.offset = params.offset;
            }
            return this._loadGantt();
        },
        /**
         * @param {Moment} focusDate
         */
        setFocusDate: function(focusDate) {
            this._setFocusDate(focusDate, this.gantt.scale);
        },
        /**
         * @param {string} scale
         */
        setScale: function(scale) {
            this._setFocusDate(this.gantt.focus_date, scale);
        },

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         * @private
         * @returns [any[]]
         */
        _focusDomain: function() {
            var domain = [[this.gantt.mapping.date_start, '<', this.gantt.to_date.locale('en').format("YYYY-MM-DD")]];
            if (this.fields[this.gantt.mapping.date_stop]) {
                domain = domain.concat([
                    '|',
                    [this.gantt.mapping.date_stop, ">", this.gantt.start_date.locale('en').format("YYYY-MM-DD")],
                    [this.gantt.mapping.date_stop, '=', false]
                ]);
            }
            return domain;
        },
        /**
         * @private
         * @param {any} date
         * @param {any} scale
         * @returns {string}
         */
        _formatDate: function(date, scale) {
            // range date
            // Format to display it
            switch (scale) {
                case "day":
                    return date.format("D MMM");
                case "week":
                    var dateStart = date.clone().startOf("week").format("D MMM");
                    var dateEnd = date.clone().endOf("week").format("D MMM");
                    return dateStart + " - " + dateEnd;
                case "month":
                    return date.format("MMMM YYYY");
                case "year":
                    return date.format("YYYY");
            }
        },

        /**
         * @private
         * @returns {Deferred<any>}
         */
        _loadGantt: function() {
            var self = this;
            var fields = _.values(this.mapping).concat(this.gantt.to_grouped_by);
            fields.push('display_name');
			// Only get field exist in model
			fields = self.filterFieldSearchable(fields);
			this._rpc({
                model: this.modelName,
                method: 'search_count',
                context: this.gantt.context,
                args: [this.gantt.domain],
                fields: ['id'],
				groupby: this.gantt.to_grouped_by,
            })
            .then(function(records) {
                self.total_records = records;
            });
			if(!this.gantt.limit) {
				this.gantt.limit = this.record_limit;
			}
            return this._rpc({
                model: this.modelName,
                method: 'search_read',
                context: this.gantt.context,
                domain: this.gantt.domain,
                fields: _.uniq(fields),
				limit: this.gantt.limit || 0,
				groupby: this.gantt.to_grouped_by,
				offset: this.gantt.offset || 0,
				orderBy: this.gantt.ordered_by
            })
            .then(function(records) {
                self.gantt.data = records;
            })
        },
        /**
         * @private
         * @param {any} focusDate
         * @param {string} scale
         */
        _setFocusDate: function(focusDate, scale) {
			this.gantt.scale = scale;
            this.gantt.focus_date = focusDate;
            this.gantt.start_date = focusDate.clone().subtract(1, scale).startOf(scale);
            this.gantt.to_date = focusDate.clone().add(3, scale).endOf(scale);
            this.gantt.end_date = this.gantt.to_date.add(1, scale);
            this.gantt.date_display = this._formatDate(focusDate, scale);
        },
        /**
		* Only filter fields that exist
		*/
		filterFieldSearchable: function(fields) {
			var self = this;
			var readableField = [];
			// Only get field exist in model
			for (var i = 0; i < fields.length; i++) {
				var f = fields[i].split(':')[0];
				if(self.fields[f]) {
					readableField.push(f);
				}
			}
            if(self.mapping.task_alert == '1') {
                readableField.push('bad_resource_allocation_task_ids')
                readableField.push('bad_resource_allocation_task_alert')
                readableField.push('bad_resource_allocation_task_count')
            }
			return readableField;
		}
    });

    return ViinGanttModel;

});
