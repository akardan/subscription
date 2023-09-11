odoo.define('viin_web_gantt.ViinGanttRenderer', function(require) {
    "use strict";

    var AbstractRenderer = require('web.AbstractRenderer');
    var core = require('web.core');
    var time = require('web.time');
    var rpc = require('web.rpc');
    var gantt_common = require('viin_web_gantt.common');
    var session = require('web.session');

    var _t = core._t;
    var _lt = core._lt;
    var QWeb = core.qweb;
    var gantt_pdf = require('viin_web_gantt.gantt_pdf');
    var Dialog = require('web.Dialog');
    var default_closed = ['done', 'cancel', 'cancelled', 'close', 'closed'];
    var default_colors = ['#FBB11E', '#3BBF67', '#0099FF', '#660066', '#d8d8d8', '#e5d8e3', '#ece9c2', '#dee180',
        '#abd4cc'];
    /**
    * This is here just for reference and should be commented upon development completion
    * See: https://roberto.twproject.com/2012/08/24/jquery-gantt-editor/
    */
    var taskTemplate = {
        "id": -1,
        "name": "Gantt editor",
        "code": "",
        "level": 0,
        "status": "STATUS_ACTIVE",
        "canWrite": true,
        "start": 1396994400000,
        "duration": 21,
        "end": 1399672799999,
        "startIsMilestone": true,
        "endIsMilestone": false,
        "collapsed": false,
        "assigs": [],
        "hasChild": true
    };


    var ViinGanttRenderer = AbstractRenderer.extend({
        display_name: _lt('Gantt'),
        icon: 'fa-tasks',
        require_fields: true,
        template: 'GanttView',
        className: "o_gantt_view",

        /**
        * @overrie
        */
        init: function(parent, state, params) {
            var self = this;
            this._super.apply(this, arguments);
            this.date_field_sql_format = '';
            this.date_field_format = '';
            this.scale = this.arch.attrs.scale_zoom;
            this.state.focus_date = moment(new Date()); // main
            if (!_.contains(['all', 'day', 'week', 'month', 'year'], this.scale)) {
                this.scale = "all";
            }
            // gather the fields to get
            var fields = {
                'name': 'name',
                /*              'color' : 'color',*/
                'active': 'active',
                'start': this.arch.attrs.date_start,
                'end': this.arch.attrs.date_stop,
                'manager': this.arch.attrs.manager,
                'members': this.arch.attrs.members,
                'progress': this.arch.attrs.progress,
                'depends': this.arch.attrs.depends,
                'string': this.arch.attrs.string || 'RECORD'
            };
            if (self.state.fields.sequence) {
                fields.sequence = 'sequence';
            }
            this.my_page = {
                events: []
            }
            _.map(["members", "manager", "progress", "depends", "stage_by"], function(key) {
                var val = self.arch.attrs[key];
                if (val) {
                    fields[key] = val;
                }
            });
            this.date_type = this.state.fields[fields.start].type
            sessionStorage.setItem('gantt_date_type', this.date_type)
            this.fields_data = fields;
            this.data_for_gantt = {};
            this.attach_click = false;
            this.selectedRow = 1;
            this.state.gantt_state_data = this.cloneObj(this.state.data, true);
            self.dom_loaded = $.Deferred();
            self.color_loaded = $.Deferred();
            var defs = self._prepareX2ManyRelation();
            defs = defs.concat([self.dom_loaded, self.color_loaded]);
            $.when(...defs).done(function() {
                self._processData();
                // Lazy load user info for showing tooltip in member and managers of task
                self._rpc({
                    model: 'res.users',
                    method: 'search_read',
                    context: session.user_context,
                    fields: ['name'],
                    domain: [['id', 'in', self.member_ids]]
                }).then(function(res) {
                    // Delete member_ids for reducing the heavy of self
                    delete self.member_ids;
                    self.members = res;
                    self._updateTooltipMember();
                });
                self.displayFocusDate();
                self.reloadGantt(self.data_for_gantt);
                self.gantt_loaded = true;
            });
        },
        willStart: function() {
            var self = this;
            var defs = [];
            self.fields_to_fetch = [];
            defs.push(this._super());
            self._willStart(this.state.fields);
            return $.when.apply($, defs);
        },
        _willStart: function(fields) {
            var self = this;
            self.fields = fields;
            var status = self.arch.attrs.status;
            if (!status) {
                if (fields['stage_id']) {
                    status = self.arch.attrs.status = 'stage';
                } else if (fields['state']) {
                    status = self.arch.attrs.status = 'state';
                }
            }
            if (status == 'state') {
                self.fields_data['state'] = 'state';
            } else if (status == 'stage') {
                self.fields_data['stage'] = 'stage_id';
            }
            _.map(self.fields_data, function(val, key) {
                var field = self.fields[val];
                self.fields_data['_' + key] = field;
                if (field) {
                    self.fields_to_fetch.push(val);
                }
            });
            if (!self.fields_data._start) {
                console.error(' missing field '
                    + ' of gantt chart');
            }
            if (!self.fields_data._end) {
                console.error(' missing field '
                    + ' of gantt chart');
            }
            if (self.fields_data._state) {
                self._pyeval('colors');
                self._pyeval('closed_state');
                if (!self.fields_data._closed_state) {
                    self.fields_data._closed_state = default_closed;
                }
                if (!self.fields_data._colors) {
                    self.fields_data._colors = this.status_colors;
                }
            } else if (self.fields_data._stage) {
                self._getStageDomain();
            }
            if (self.fields_data._depends && self.fields_data._depends.type != 'many2many') {
                console
                    .error(' invalid depends of gantt chart, this field type must be many2many');
                self.fields_data._depends = false;
            }
            self._pyeval('holiday');
            self._pyeval('status_readonly');
            self._getDateFormat(self.fields_data._start);
            self._getDateFormat(self.fields_data._end);
        },

        _pyeval: function(key) {
            key = this.arch.attrs[key];
            if (key != null) {
                this.fields_data['_' + key] = pyeval.py_eval(key);
            }
        },


        _getStageDomain: function() {
            var self = this;
            var stageDomain;
            if (self.fields_data._stage) {
                stageDomain = self.arch.attrs.stage_domain;
                if (!stageDomain) {
                    stageDomain = self.fields_data._stage.domain;
                }
                if (stageDomain) {
                    self.fields_to_stage = [];
                    stageDomain.replace(/([a-zA-z_0-9]+)\)/g, function(a, b, i) {
                        if (isNaN(b)) {
                            self.fields_to_stage.push(b);
                            if (!_.contains(self.fields_to_fetch, b)) {
                                self.fields_to_fetch.push(b);
                            }
                        }
                    });
                }
            }
            self.fields_data._stage_domain = stageDomain;
        },
        _getDateFormat: function(field) {
            if (field) {
                var datePattern = time.strftime_to_moment_format(_t.database.parameters.date_format);
                datePattern = datePattern.replace(/Y/g, 'y').replace(/D/g, 'd');

                if (field.type == 'date') {
                    this.date_field_sql_format = 'YYYY-MM-DD';
                } else {
                    this.date_field_sql_format = 'YYYY-MM-DD HH:mm:ss';
                    // field.format = date_pattern + ' ' +
                    // time_pattern.replace(':ss', '');
                }
                this.date_field_format = datePattern;
            }
        },
        start: function() {
            this.$el.addClass(this.arch.attrs.class);
            return this._super();
        },
        on_attach_callback: function() {
            gantt_common.busy(true);
            var $root = this.$el.closest('.o_view_controller').addClass('has_gantt');
            this.data_for_gantt.width = $root.width();
            this.data_for_gantt.height = $root.height();
            $('.o_cp_switch_viin_gantt').addClass('active');
            /*this.loadTemplate();*/
            this.dom_loaded.resolve();
        },
        /**
         *
         * @override
         */
        on_detach_callback: function() {
            this.$el.closest('.o_view_controller').removeClass('has_gantt');
            // This is for when open input date field, calculate the top of calBox in nearBestPosition function
            $('body').removeClass('gantt-view');
            $('html').css({ position: '' })

            this._super.apply(this, arguments);
        },
        /**
        * When filter action, group action, create task action... happend need to 
        * update gantt
        * @private
        */
        _updateDataGantt: function() {
            var self = this;
            var defs = self._prepareX2ManyRelation();
            return $.when(...defs).done(function() {
                self._processData();
            })
        },
        /**
        * @private
        * Prepare data in case group field is many2many, one2many ...
        */
        _prepareX2ManyRelation: function() {
            var self = this;
            var x2many_group_fields = [];
            var x2many_group_ids = {};
            var defs = [];
            self.x2many_relation_data = {};
            var groupBys = this.state.to_grouped_by.length > 0 ? this.state.to_grouped_by : [this.arch.attrs.default_group_by];
            _.forEach(groupBys, function(group) {
                var model = self.state.fields[group.split(':')[0]];
                if (model.type == 'many2many' || model.type == 'one2many') {
                    x2many_group_fields.push(model.name);
                    x2many_group_ids[model.name] = [];
                }
            });
            _.forEach(x2many_group_fields, function(field) {
                _.forEach(self.state.data, function(task) {
                    x2many_group_ids[field] = x2many_group_ids[field].concat(task[field]);
                });
                var deferred = $.Deferred();
                defs.push(deferred);
                self._rpc({
                    model: self.state.fields[field].relation,
                    method: 'search_read',
                    context: session.user_context,
                    fields: ['name'],
                    domain: [['id', 'in', x2many_group_ids[field]]]
                }).then(function(res) {
                    self.x2many_relation_data[field] = res;
                    deferred.resolve();
                });
            });
            return defs;
        },
        _processData: async function() {
            var models = { groups: {} };
            var undefTasks = [];
            var self = this;
            self.member_ids = [];
            var groupBys = this.state.to_grouped_by.length > 0 ? this.state.to_grouped_by : [this.arch.attrs.default_group_by];
            this.current_group_bys = groupBys;
            self.reorderStateDataInPage();
            _.each(this.state.data, function(task) {
                var start_date_field = self.arch.attrs.date_start;
                // when task has start date
                if (!task[start_date_field]) {
                    // set it to created date
                    task[start_date_field] = task.create_date;
                    task.hidden_visibility = true;
                }

                var groups = models.groups;
                var first_groups = false;
                var last_group_contain_task;
                for (var i = 0; i < groupBys.length; i++) {
                    var group = groupBys[i];
                    var model = self.state.fields[group.split(':')[0]];
                    var id = task[group.split(':')[0]];
                    var name_ids = [];
                    if ((!id || _.isEmpty(id)) && model.type != 'boolean') {
                        break;
                    }
                    last_group_contain_task = i;
                    var name = id;
                    if (model.type == 'many2one') {
                        name = id[1];
                        id = id[0];
                        name_ids.push({ id: id, name: name });
                    } else if (model.type == 'selection') {
                        for (var j = 0; j < model.selection.length; j++) {
                            var sel = model.selection[j];
                            if (sel[0] == id) {
                                name = sel[1];
                                break;
                            }
                        }
                        name_ids.push({ id: id, name: name });
                    } else if (model.type == 'datetime') {
                        // group by date is like 'create_date:month' in format
                        var formatUnit = group.split(':')[1];
                        // get value datetime
                        var name = self.getDatetimeByFormatUnit(id, formatUnit);
                        var id = name;
                        name_ids.push({ id: id, name: name });
                    } else if (model.type == 'boolean') {
                        name = id.toString();
                        id = name;
                        name_ids.push({ id: id, name: name });
                    } else if (model.type == 'many2many' || model.type == 'one2many') {
                        self.x2many_relation_data[model.name].map(function(val) {
                            if (id.indexOf(val.id) >= 0) {
                                name_ids.push(val)
                            }
                            return val;
                        });
                    } else {
                        name = id;
                        id = name;
                        name_ids.push({ id: id, name: name });
                    }

                    var my = {};
                    _.forEach(name_ids, function(elem) {
                        var id = elem.id;
                        // Add new loop 1st
                        if (i == 0) {
                            my[id] = groups[id] = {
                                id: id,
                                name: elem.name,
                                model: model.relation,
                                string: model.string,
                                group: group,
                                level: i,
                                groups: groups[id] ? groups[id].groups : {},
                                tasks: groups[id] ? groups[id].tasks : []
                            }
                            return;
                        }
                        _.forEach(groups, function(gr) {
                            if (!gr.groups) {
                                gr.groups = {};
                            }
                            my[id] = gr.groups[id];
                            if (!my[id]) {
                                my[id] = gr.groups[id] = {
                                    id: id,
                                    name: elem.name,
                                    model: model.relation,
                                    string: model.string,
                                    group: group,
                                    level: i,
                                    groups: {},
                                }
                            }
                        });
                    });
                    groups = my;
                    if (i == 0) {
                        first_groups = my;
                    }
                }
                // some task go to some group level dont have value for that field of group, it doesnt mean
                // it is undefined task
                if (last_group_contain_task >= 0) {
                    _.forEach(first_groups, function(g) {
                        g.active = true;
                    });
                    groups = _.forEach(groups, function(g) {
                        if (!g.tasks) {
                            g.tasks = [];
                        }
                        g.tasks.push(task);
                        g.last = true;
                    });
                } else {
                    undefTasks.push(task);
                }
            });
            var data = [];
            if (models.groups) {
                _.map(models.groups, function(model) {
                    if (model.active) {
                        self.format_groups(data, model);
                    }
                });
            }
            if (undefTasks.length > 0) {
                self.format_groups(data, {
                    id: undefined,
                    name: _t('Unknown'),
                    level: 0,
                    last: true,
                    tasks: undefTasks
                });
            }
            return self.onDataLoaded(data, groupBys);
        },
        reorderStateDataInPage: function() {
            var self = this;
            if (!this.state.fields.sequence) {
                return;
            }
            // re-order by sequence and by group
            this.state.data.sort(function(a, b) {
                if (a.sequence > b.sequence) return 1;
                if (a.sequence < b.sequence) return -1;
                return 0;
            });
        },
        getDatetimeByFormatUnit: function(datetimeVal, formatUnit) {
            if (!datetimeVal) {
                return _t('Unknown');
            }
            var d = moment(datetimeVal).toDate();
            var d = this.convertUTCDateToLocalDate(d);
            var m = moment(d);
            if (formatUnit == 'day') {
                return m.format('DD MM YYYY');
            } else if (formatUnit == 'week') {
                return 'W' + m.format('WW YYYY');
            } else if (formatUnit == 'month') {
                return m.format('MM YYYY');
            } else if (formatUnit == 'quarter') {
                return 'Q' + m.format('Q YYYY');
            } else if (formatUnit == 'year') {
                return m.format('YYYY');
            } else {
                return _t('Unknown');
            }
        },
        format_groups: function(data, model, cls) {
            var groupTask = {
                "id": data.length,
                "name": model.name,
                "progress": 0,
                "progressByWorklog": false,
                "relevance": 0,
                "type": "",
                "typeId": "",
                "description": "",
                "code": "G_" + model.id,
                "level": model.level,
                "status": "STATUS_ACTIVE",
                "depends": "",
                "canWrite": true,
                "start": 0,
                "duration": 0,
                "end": 0,
                "startIsMilestone": false,
                "endIsMilestone": false,
                "collapsed": false,
                "assigs": [],
                "managers": [],
                "res_id": model.id,
                "res_model": model.model,
                "hasChild": true,
                "group": true,
                "string": model.string,
                "count": 0,
                "class": cls ? cls : '',
                "auto_resize": true
            };
            data.push(groupTask);
            cls = groupTask['class'] + ' g' + groupTask.id;
            if (model.last) {
                this.formatTask(model.tasks, data, model.level + 1, groupTask, cls);
                // If parent task has all children task has no planned start date => hide it
                var hiddenVisibility = true;
                for (var i = 0; i < model.tasks.length; i++) {
                    if (!model.tasks[i].hidden_visibility) {
                        hiddenVisibility = false;
                    }
                }
                if (hiddenVisibility) {
                    groupTask.hidden_visibility = true;
                }
            } else {
                var self = this;
                _.map(model.groups, function(model) {
                    self.format_groups(data, model, cls);
                });
            }
        },
        formatTask: function(tasks, data, level, group_task, cls) {
            var self = this;
            var start_date_field = self.arch.attrs.date_start;
            var stop_date_field = self.arch.attrs.date_stop;
            var task_alert = self.arch.attrs.task_alert;
            if (data == null) {
                data = [];
            }
            // log all id of task
            var taskIds = [];
            for (var i = 0; i < self.state.data.length; i++) {
                var task_json = self.state.data[i];
                if (taskIds.indexOf(task_json.id) == -1) {
                    taskIds.push(task_json.id);
                }
            }
            this.task_ids = taskIds;

            // Set all tasks with current levels
            for (let i = 0; i < tasks.length; i++) {
                tasks[i].level = level;
            }

            // Sort tasks with child task
            tasks = self._sortTasks(tasks);

            for (var i = 0; i < tasks.length; i++) {
                var task = tasks[i];
                if (group_task && self.limit && i == self.limit) {
                    break;
                }
                var taskStart = moment(task[start_date_field]).toDate();
                taskStart = self.convertUTCDateToLocalDate(taskStart);

                if (!taskStart) {
                    continue;
                }

                var percent;
                var taskStop = moment(task[stop_date_field]).toDate();
                if (!taskStop) {
                    taskStop = moment(taskStart).clone().add(1, 'hours').toDate();
                }
                taskStop = self.convertUTCDateToLocalDate(taskStop);

                var percent = task['progress'];
                if (_.isNumber(percent)) {
                    percent = Math.round(percent) || 0;
                } else {
                    percent = 0;
                }
                if (percent > 100) {
                    percent = 100;
                }

                /*if (self.min_date && task_stop < new Date(self.min_date)) {
                    continue;
                }*/
                var status = self.getStatusObj(null, task);
                var managers = self.getUsers('manager', task);
                var assigs = self.getUsers('members', task);
                var depends = [];
                if (self.fields_data._depends) {
                    depends = task[self.fields_data.depends];
                    // Check if depend is not in task list remove id to avoid error when filter
                    for (var j = 0; j < depends.length; j++) {
                        var dep = depends[j];
                        if (taskIds.indexOf(dep) == -1) {
                            depends.splice(j, 1);
                        }
                    }
                }

                let hasChild = false;
                if ('child_ids' in task && task.child_ids.length != 0) {
                    hasChild = true;
                }
                var taskGantt = {
                    "id": data.length,
                    "res_id": task.id,
                    "name": task.name,
                    "progress": percent,
                    "progressByWorklog": false,
                    "relevance": 0,
                    "type": "",
                    "typeId": "",
                    "description": '',
                    "code": this.fields_data.string + '_' + task.id,
                    "level": task.level,
                    "status": status ? status.short_status : 'STATUS_SUSPENDED',
                    "status_obj": status,
                    "depends": depends,
                    "canWrite": true,
                    "start": taskStart.getTime(),
                    "duration": getDurationInUnits(new Date(taskStart.getTime()), new Date(taskStop.getTime())),
                    "end": taskStop.getTime(),
                    "startIsMilestone": false,
                    "endIsMilestone": false,
                    "collapsed": false,
                    "assigs": assigs,
                    "managers": managers,
                    "hasChild": hasChild,
                    "data": task,
                    "class": cls ? cls : '',
                    "sequence": task.sequence || 0,
                    "hidden_visibility": task.hidden_visibility, // The task has no start time
                    "res_model": this.state.modelName,
                };
                if (task_alert && task['bad_resource_allocation_task_alert']) {
                    taskGantt.alert_content = task['bad_resource_allocation_task_alert'];
                }
                if (group_task) {
                    self._syncTask(taskGantt, data, group_task.id);
                }
                data.push(taskGantt);
            }

            return data;
        },

        _sortTasks: function(tasks) {
            let sorted_tasks = tasks.filter(task => task.parent_id === false);
            let child_tasks = _.difference(tasks, sorted_tasks);
            let pos = 0;
            while (child_tasks.length != 0) {
                if (!sorted_tasks[pos]) {
                    sorted_tasks = sorted_tasks.concat(child_tasks);
                    break;
                }
                if (sorted_tasks[pos].child_ids.length != 0) {
                    let child_ids = sorted_tasks[pos].child_ids;
                    let childs = child_tasks.filter(item => child_ids.includes(item.id));
                    if (childs.length != 0) {
                        childs.forEach(c => {
                            c.level = sorted_tasks[pos].level + 1;
                            sorted_tasks.splice(pos+1, 0, c);
                            child_tasks.splice(child_tasks.indexOf(c), 1);
                        })
                    }
                }
                pos++;
            }
            return sorted_tasks
        },

        getStatusObj: function(status, task) {
            if (this.fields_data._state) {
                if (task) {
                    status = task[this.fields_data.state];
                }
                var selection = this.fields_data._state.selection;
                for (var i = 0; i < selection.length; i++) {
                    var color = this._getStateStatusColor(i);
                    var val = selection[i];
                    if (val[0] == status) {
                        return {
                            index: i,
                            value: val[0],
                            name: val[1],
                            color: color
                        }
                    }
                }
            } else if (this.fields_data._stage) {
                if (task) {
                    status = task[this.fields_data.stage];
                }
                // If status dont belong to any project set it as new stage (smallest sequence)
                if (!status || !this.fields_data._stages) {
                    return this.fields_data.default_stage;
                }
                var filterStageCondition = eval(this.arch.attrs.filter_stage_condition);
                var dataField = filterStageCondition[0];
                var dataFieldVal = task[dataField];
                // in case dataFieldVal is false
                var stages = [];
                if(!dataFieldVal) {
                    stages = this.fields_data._stages.all;
                } else {
                    stages = this.fields_data._stages[dataFieldVal[0]];
                }
                for (var i = 0; i < stages.length; i++) {
                    var val = stages[i];
                    if (val.id == status[0]) {
                        return val;
                    }
                }
            }
            return false;
        },

        _getStateStatusColor: function(i) {
            var color = this.status_colors[i];
            return color;
        },

        _getScale: function() {
            return this.scale == 'all' ? 'month' : this.scale;
        },

        convertUTCDateToLocalDate: function(date) {
            var newDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
            return newDate;
        },

        onDataLoaded: function(tasks, group_bys) {
            var self = this;
            this.dataLoaded = true;
            this.data_for_gantt.scale = self._getScale();
            this.data_for_gantt.creatable = true;
            this.data_for_gantt.fields = self.fields_data;
            this.data_for_gantt.tasks = tasks;
            this.data_for_gantt.task_count = self.state.data.length || 0;
            this.data_for_gantt.group_bys = group_bys;
            window._holiday = self.fields_data._holiday;
            if (self.gantt_loaded) {
                this.displayFocusDate();
                this.reloadGantt(this.data_for_gantt);
            }
        },

        _syncTask: function(task, data, index) {
            if (index >= 0) {
                var parent = data[index];
                if (parent.level < task.level) {
                    parent.count += 1;
                    if (parent.start == 0 || parent.start > task.start) {
                        parent.start = task.start;
                    }
                    if (parent.end == 0 || parent.end < task.end) {
                        parent.end = task.end;
                    }
                    if (task.status_obj) {
                        if (!parent.status_obj || parent.status_obj.index > task.status_obj.index) {
                            parent.status = task.status;
                            parent.status_obj = task.status_obj;
                        }
                    }
                    this._syncTask(parent, data, index - 1);
                }
            }
        },
        getUsers: function(name, task) {
            var field = this.fields_data['_' + name];
            if (!field) {
                return [];
            }
            var self = this;
            var users = [];
            var ids = task[this.fields_data[name]];
            if (ids) {
                if (field.type == 'many2one') {
                    users.push({
                        id: ids[0],
                        name: ids[1],
                        model: field.relation
                    });
                } else if (field.type == 'many2many' || field.type == 'one2many') {
                    _.forEach(ids, function(id) {
                        self.member_ids.push(id);
                        users.push({
                            id: id,
                            name: '',
                            model: field.relation
                        });
                    });
                } else if (self.fields_data._users) {
                    _.each(ids, function(id) {
                        _.each(self.fields_data._users, function(user) {
                            if (user.id == id) {
                                users.push(user);
                                return false;
                            }
                        });
                    });
                }
            }
            return users;
        },
        /**
        * @private
        * In case there are many members assign to task, tooltip is prefered solution
        * to display members
        */
        _updateTooltipMember: function() {
            var self = this;
            $('.member').each(function() {
                var user_id = $(this).data('id');
                var elem = $(this);
                _.each(self.members, function(member) {
                    if (member.id == user_id) {
                        elem.attr('title', member.name);
                    }
                });
            });
            $('.taskAssigs a[data-toggle="tooltip"]').each(function() {
                var a = $(this);
                // Check tooltip member is loaded 
                if (a.hasClass('memebred-loaded')) {
                    return;
                }
                var user_ids = a.attr('user_ids').split(',');
                var tooltip = '<ul class="member-list-tooltip">';
                _.forEach(user_ids, function(uid) {
                    _.each(self.members, function(member) {
                        if (member.id == uid) {
                            tooltip += '<li>' + member.name + '</li>';
                        }
                    });
                });
                tooltip += '</ul>';
                a.addClass('memebred-loaded');
                a.attr('title', tooltip);
            });
            $('.taskAssigs a[data-toggle="tooltip"]').tooltip();
        },
        displayFocusDate: function() {
            // range date
            // Format to display it
            var dateDisplay;
            switch (this.scale) {
                case "all":
                    dateDisplay = _t('All');
                    break;
                case "day":
                    dateDisplay = this.state.focus_date.format("D MMM");
                    break;
                case "week":
                    var date_start = this.state.focus_date.clone().startOf("week").format("D MMM");
                    var date_end = this.state.focus_date.clone().endOf("week").format("D MMM");
                    dateDisplay = date_start + " - " + date_end;
                    break;
                case "month":
                    dateDisplay = this.state.focus_date.format("MMMM YYYY");
                    break;
                case "year":
                    dateDisplay = this.state.focus_date.format("YYYY");
                    break;
            }
            var breadcrumb = $('.o_view_controller .o_control_panel .breadcrumb .active');
            if ($('.o_view_controller .o_control_panel .breadcrumb .breadcrumb-item.active .focus-date-breadcrumb').length > 0) {
                $('.o_view_controller .o_control_panel .breadcrumb .breadcrumb-item.active.active .focus-date-breadcrumb').text(' (' + dateDisplay + ')')
            } else {
                var focus_date_breadcrumb = $('<span />').addClass('focus-date-breadcrumb').text(' (' + dateDisplay + ')');
                focus_date_breadcrumb.appendTo(breadcrumb)
            }

        },

        reloadGantt: function(params) {
            var self = this;
            try {
                $('body').css({ position: 'initial' });
                this.task_datas = params.tasks;
                this.mapDependToTaskId(this.task_datas);
                this.loadTemplate();
                gantt_pdf.init(this.my_page.ge)
                this.my_page.ge.ganttPDF = gantt_pdf;
                this.onLoadedGantt();
            } finally {
                setTimeout(function() {
                    $('body').css({ position: 'relative' });
                    gantt_common.busy(false)
                    self._updateTooltipMember();
                }, 1500)
            }
        },

        /*
        * Map depend to task id respectively 
        */
        mapDependToTaskId: function(tasks) {
            var newTasks = [];
            for (var i = 0; i < tasks.length; i++) {
                var depends = tasks[i].depends;
                var depends_str = '';
                for (var j = 0; j < tasks.length; j++) {
                    var res_id = tasks[j].res_id;
                    var task_id = tasks[j].id;
                    if (Array.isArray(depends) && depends.indexOf(res_id) >= 0 && tasks[j].res_model == tasks[i].res_model) {
                        // Point to row
                        task_id += 1;
                        depends_str = depends_str + ',' + task_id;
                    }
                }
                depends_str = depends_str.slice(1);
                var updatedTask = this.cloneObj(tasks[i], true);
                updatedTask.depends = depends_str;
                newTasks.push(updatedTask);
            }
            this.task_datas = newTasks;
        },

        mapDependToSpecificTask: function(task) {
            var dependsStr = '';
            for (var i = 0; i < this.my_page.ge.tasks.length; i++) {
                var res_id = this.my_page.ge.tasks[i].res_id;
                if (Array.isArray(task.depends) && task.depends.indexOf(res_id) >= 0) {
                    dependsStr = dependsStr + ',' + (this.my_page.ge.tasks[i].getRow() + 1);
                }
            }
            dependsStr = dependsStr.slice(1);
            task.depends = dependsStr;
            return task;
        },

        /* After gantt is loaded attach event to it*/
        onLoadedGantt: function() {
            var self = this;
            if (this.attach_click) {
                return;
            }
            this.attach_click = true;
            $(document).on('dblclick', '.taskBoxSVG', function(e) {
                var el = $(this);
                var task = self.my_page.ge.getTask(el.attr('taskid'));
                $('.modalPopup').remove();
                if (!task) {
                    return;
                }
                if (task.group && !task.res_model) {
                    return false;
                }
                self.trigger_up('open_task_editor', {
                    'id': task.id,
                    'name': task.name,
                    'res_id': task.res_id,
                    'res_model': task.res_model,
                    'string': task.string,
                    'data': task.data,
                    'hasChild': task.hasChild
                });
            });

            $(document).on('dblclick', '.taskEditRow', function(e) {
                var el = $(this);
                var task = self.my_page.ge.getTask(el.attr('taskid'));
                $('.modalPopup').remove();
                if (!task) {
                    return;
                }
                if (task.group && !task.res_model) {
                    return false;
                }
                self.trigger_up('open_task_editor', {
                    'id': task.id,
                    'name': task.name,
                    'res_id': task.res_id,
                    'res_model': task.res_model,
                    'string': task.string,
                    'data': task.data,
                    'hasChild': task.hasChild
                });
            });

            $(document).on('click', '.taskEditRow .edit', function(e) {
                var el = $(this);
                var task = self.my_page.ge.getTask(el.parent().attr('taskid'));
                $('.modalPopup').remove();
                if (!task) {
                    return;
                }
                if (task.group && !task.res_model) {
                    return false;
                }
                self.trigger_up('open_task_editor', {
                    'id': task.id,
                    'name': task.name,
                    'res_id': task.res_id,
                    'res_model': task.res_model,
                    'string': task.string,
                    'data': task.data,
                    'hasChild': task.hasChild
                });
            })

        },
        cloneObj: function(obj, deep = false) {
            var self = this
            var result = {};
            for (var key in obj) {
                if (deep && obj[key] instanceof Object) {
                    if (obj[key] instanceof Array) {
                        result[key] = [];
                        obj[key].forEach(function(item) {
                            if (item instanceof Object) {
                                result[key].push(self.cloneObj(item, true));
                            } else {
                                result[key].push(item);
                            }
                        });
                    } else {
                        result[key] = self.cloneObj(obj[key]);
                    }
                } else {
                    result[key] = obj[key];
                }
            }
            return result
        },

        loadStage: function() {
            var dataStage = [];
            var self = this;
            if (this.arch.attrs.filter_stage_condition) {
                var currentTask = this.my_page.ge.currentTask;
                if (!currentTask || !currentTask.data) {
                    return [];
                }
                var taskData = currentTask.data;
                var filterStageCondition = eval(this.arch.attrs.filter_stage_condition);
                if (!Array.isArray(filterStageCondition) && filterStageCondition.length < 3) {
                    return [];
                }
                var dataField = filterStageCondition[0];
                var operator = filterStageCondition[1];
                var stageField = filterStageCondition[2];
                if (operator == 'IN') {
                    // get field info => format data of field and loop through stages to check for matching to data field 
                    var dataFieldInfo = this.fields[dataField];
                    var dataFieldVal = [];
                    // convert field data to array
                    if (dataFieldInfo && dataFieldInfo.type == 'many2one') {
                        if(!taskData[dataField]) {
                            return [];
                        }
                        dataFieldVal = taskData[dataField][0];
                        // convert to array
                        dataFieldVal = [dataFieldVal];
                    } else if (dataFieldInfo && (dataFieldInfo.type == 'many2many' || dataFieldInfo.type == 'one2many')) {
                        dataFieldVal = taskData[dataField];
                    }
                    _.each(dataFieldVal, function(gid) {
                        if(self.fields_data._stages[gid]) {
                            dataStage = dataStage.concat(self.fields_data._stages[gid]);
                        }
                    });
                } else {
                    var dataFieldVal = taskData[dataField];
                    _.each(this.fields_data._stages, function(group) {
                        _.each(group, function(stag) {
                            var stageFieldVal = stag[stageField];
                            if (eval(dataFieldVal + ' ' + operator + ' ' + stageFieldVal)) {
                                dataStage.push(stag);
                            }
                        });
                    });
                }
                return dataStage;
            }
            return this.fields_data._stages;
        },

        changedStatus: function(task, newStatus) {
            var begin = !task.master.__currentTransaction;
            if (begin) {
                task.master.beginTransaction();
            }
            if (this.fields_data._state) {
                var selection = this.fields_data._state.selection;
                var status_obj = {};
                for (var i = 0; i < selection.length; i++) {
                    var color = this._getStateStatusColor(i);
                    var val = selection[i];
                    if (val[0] == newStatus) {
                        var status_obj = {
                            index: i,
                            value: val[0],
                            name: val[1],
                            color: color,
                            short_status: 'STATUS_SUSPENDED'
                        }
                        task.status = status_obj.short_status;
                        task.status_obj = status_obj;
                    }

                }
            } else if (this.fields_data._stage) {
                var status_obj = this.getStage(newStatus, task);
                task.status = status_obj.short_status;
                task.status_obj = status_obj;
            }

            this.changedStatusParent(task.getParent());
            if (begin) {
                task.master.endTransaction();
            }
            this.savingCurrentTask();
        },

        changedStatusParent: function(task) {
            if (task) {
                task.status = false;
                task.status_obj = false;
                var tasks = task.getChildren();
                var changed = false;
                for (var i = 0; i < tasks.length; i++) {
                    var t = tasks[i];
                    if (t.status_obj) {
                        if (!task.status_obj || task.status_obj.index > t.status_obj.index) {
                            task.status_obj = t.status_obj;
                            task.status = t.status_obj.short_status;
                            changed = true;
                        }
                    }
                }
                if (changed) {
                    this.changedStatusParent(task.getParent());
                }
            }
        },
        getStage: function(status_id, task) {
            var filterStageCondition = eval(this.arch.attrs.filter_stage_condition);
            var dataField = filterStageCondition[0];
            var dataFieldVal = task.data[dataField];
            var stages_by_condition = this.fields_data._stages[dataFieldVal[0]];
            for (var i = 0; i < stages_by_condition.length; i++) {
                var stag = stages_by_condition[i]
                if (stag.id == parseInt(status_id)) {
                    return stag;
                }
            }
        },

        loadTemplate: function() {
            var ganttButtons = $(QWeb.templates['GanttView.gantt_buttons']).html()
            ganttButtons = '<!--' + ganttButtons + '-->';
            $('.__template__[type=GANTBUTTONS]').html(ganttButtons);

            var taskEditHead = $(QWeb.templates['GanttView.task_edit_head']).html();
            taskEditHead = '<!--' + taskEditHead + '-->';
            $('.__template__[type=TASKSEDITHEAD]').html(taskEditHead);

            var taskRow = $(QWeb.templates['GanttView.task_row']).html();
            taskRow = '<!--' + taskRow + '-->';
            $('.__template__[type=TASKROW]').html(taskRow);

            var taskEmptyRow = $(QWeb.templates['GanttView.task_empty_row']).html()
            taskEmptyRow = '<!--' + taskEmptyRow + '-->';
            $('.__template__[type=TASKEMPTYROW]').html(taskEmptyRow);

            var taskBar = $(QWeb.templates['GanttView.task_bar']).html();
            taskBar = '<!--' + taskBar + '-->';
            $('.__template__[type=TASKBAR]').html(taskBar);

            this.showListStatus();

            var taskEditor = $(QWeb.templates['GanttView.task_editor']).html()
            taskEditor = '<!--' + taskEditor + '-->';
            $('.__template__[type=TASK_EDITOR]').html(taskEditor);

            var assignmentRow = $(QWeb.templates['GanttView.assignment_row']).html();
            assignmentRow = '<!--' + assignmentRow + '-->';
            $('.__template__[type=ASSIGNMENT_ROW]').html(assignmentRow);

            var resourceEditor = $(QWeb.templates['GanttView.resource_editor']).html();
            resourceEditor = '<!--' + resourceEditor + '-->';
            $('.__template__[type=RESOURCE_EDITOR]').html(resourceEditor);

            var resourceRow = $(QWeb.templates['GanttView.resource_row']).html();
            resourceRow = '<!--' + resourceRow + '-->';
            $('.__template__[type=RESOURCE_ROW]').html(resourceRow);

            var ge;
            // here starts gantt initialization
            if (!this.my_page.ge) {
                ge = new GanttMaster();
                ge.task_model = this.state.modelName;
                ge.resourceUrl = 'viin_web_gantt/static/lib/tw-gantt/res/';
                this.my_page.ge = ge;
                ge.odoo_dialog = Dialog;
                ge.init($("#workSpace"));
                this.filterStatusToSelectInTask();
            }

            this.my_page.ge.task_ids = this.task_ids;
            this.my_page.ge.set100OnClose = true;

            this.my_page.ge.shrinkParent = true;

            this.loadI18n(); //overwrite with localized ones

            //in order to force compute the best-fitting zoom level
            delete this.my_page.ge.gantt.zoom;

            var project = this.getProject();

            if (!project.canWrite)
                $(".ganttButtonBar button.requireWrite").attr("disabled", "true");
            this.my_page.ge.loadProject(project);

            // reload view after loading project
            this.my_page.ge.gantt.gridChanged = true;
            this.my_page.ge.redraw();

            this.my_page.ge.checkpoint(); //empty the undo stack

            this.ganttAttachingEvent();

            /*this.initializeHistoryManagement(ge.tasks[0].id);*/
            $.JST.loadDecorator("RESOURCE_ROW", function(resTr, res) {
                resTr.find(".delRes").click(function() { $(this).closest("tr").remove() });
            });

            $.JST.loadDecorator("ASSIGNMENT_ROW", function(assigTr, taskAssig) {
                var resEl = assigTr.find("[name=resourceId]");
                var opt = $("<option>");
                resEl.append(opt);
                for (var i = 0; i < taskAssig.task.master.resources.length; i++) {
                    var res = taskAssig.task.master.resources[i];
                    opt = $("<option>");
                    opt.val(res.id).html(res.name);
                    if (taskAssig.assig.resourceId == res.id)
                        opt.attr("selected", "true");
                    resEl.append(opt);
                }
                var roleEl = assigTr.find("[name=roleId]");
                for (var i = 0; i < taskAssig.task.master.roles.length; i++) {
                    var role = taskAssig.task.master.roles[i];
                    var optr = $("<option>");
                    optr.val(role.id).html(role.name);
                    if (taskAssig.assig.roleId == role.id)
                        optr.attr("selected", "true");
                    roleEl.append(optr);
                }

                if (taskAssig.task.master.permissions.canWrite && taskAssig.task.canWrite) {
                    assigTr.find(".delAssig").click(function() {
                        var tr = $(this).closest("[assId]").fadeOut(200, function() { $(this).remove() });
                    });
                }

            });
            reloadGridState();
            translateGanttDateHeadText(session.user_context.lang);
            // this.filterStatusToSelectInTask();
        },
        loadI18n: function() {
            GanttMaster.messages = {
                "CANNOT_WRITE": _lt("No permission to change the following task:"),
                "CHANGE_OUT_OF_SCOPE": _lt("Project update not possible as you lack rights for updating a parent project."),
                "START_IS_MILESTONE": _lt("Start date is a milestone."),
                "END_IS_MILESTONE": _lt("End date is a milestone."),
                "TASK_HAS_CONSTRAINTS": _lt("Task has constraints."),
                "GANTT_ERROR_DEPENDS_ON_OPEN_TASK": _lt("Error: there is a dependency on an open task."),
                "GANTT_ERROR_DESCENDANT_OF_CLOSED_TASK": _lt("Error: due to a descendant of a closed task."),
                "TASK_HAS_EXTERNAL_DEPS": _lt("This task has external dependencies."),
                "GANNT_ERROR_LOADING_DATA_TASK_REMOVED": _lt("GANNT_ERROR_LOADING_DATA_TASK_REMOVED"),
                "CIRCULAR_REFERENCE": _lt("Circular reference."),
                "CANNOT_DEPENDS_ON_ANCESTORS": _lt("Cannot depend on ancestors."),
                "INVALID_DATE_FORMAT": _lt("The data inserted are invalid for the field format."),
                "GANTT_ERROR_LOADING_DATA_TASK_REMOVED": _lt("An error has occurred while loading the data. A task has been trashed."),
                "CANNOT_CLOSE_TASK_IF_OPEN_ISSUE": _lt("Cannot close a task with open issues"),
                "TASK_MOVE_INCONSISTENT_LEVEL": _lt("You cannot exchange tasks of different depth."),
                "CANNOT_MOVE_TASK": _lt("CANNOT_MOVE_TASK"),
                "PLEASE_SAVE_PROJECT": _lt("PLEASE_SAVE_PROJECT"),
                "GANTT_SEMESTER": _lt("Semester"),
                "GANTT_SEMESTER_SHORT": _lt("s."),
                "GANTT_QUARTER": _lt("Quarter"),
                "GANTT_QUARTER_SHORT": _lt("q."),
                "GANTT_WEEK": _lt("Week"),
                "GANTT_WEEK_SHORT": _lt("w.")
            };
        },

        getProject: function() {
            var self = this;
            //console.debug("getDemoProject")
            var ret = {
                "tasks": self.task_datas, "selectedRow": self.selectedRow, "deletedTaskIds": [],
                "resources": [],
                "roles": [], "canWrite": true, "canDelete": true, "canWriteOnParent": true, canAdd: true
            }

            //actualize data
            return ret;
        },

        showListStatus: function() {
            var statuses = {};
            var key = this._getStatusKey();
            var changeStatus = '<!--<div class="taskStatusBox">';
            if (this.fields_data._state) {
                var selection = this.fields_data._state.selection;
                for (var i = 0; i < selection.length; i++) {
                    var color = this._getStateStatusColor(i);
                    var val = selection[i];
                    var status = {
                        index: i,
                        value: val[0],
                        name: val[1],
                        color: color,
                        short_status: 'STATUS_SUSPENDED'
                    }
                    changeStatus += '<div class="taskStatus cvcColorSquare" status="'
                    + status.short_status + '" title="' + status.name
                    + '" status_id="' + status[key] + '" style="background-color:' + status.color + '"></div>';
                }
            } else if (this.fields_data._stage) {
                _.each(this.fields_data._stages, function(group, group_key) {
                    _.each(group, function(stg) {
                        changeStatus += '<div class="taskStatus cvcColorSquare" status="'
                        + stg.short_status + '" title="' + stg.name
                        + '" status_id="' + stg[key] + '" style="background-color:' + stg.color + '" group_key="'+ group_key +'"></div>';
                    });
                });
            }
            changeStatus += '</div>-->';

            $('.__template__[type=CHANGE_STATUS]').html(changeStatus);

        },

        filterStatusToSelectInTask: function() {
            var self = this;
            var dataField;
            if(this.arch.attrs.filter_stage_condition) {
                var filterStageCondition = eval(this.arch.attrs.filter_stage_condition);
                dataField = filterStageCondition[0];
            }
            $('.splitElement.splitBox1').on('click', '.taskEditRow', function(e) {
                var statuses = [];
                var key = self._getStatusKey();
                var current_task = self.my_page.ge.currentTask;
                if ((self.fields_data._stage)) {
                    var taskRow = $(this);
                    statuses = self.loadStage();
                } else if (self.fields_data._state) {
                    var taskRow = $(this);
                    var selection = self.fields_data._state.selection;
                    for (var i = 0; i < selection.length; i++) {
                        var color = self._getStateStatusColor(i);
                        var val = selection[i];
                        var status = {
                            index: i,
                            value: val[0],
                            name: val[1],
                            color: color,
                            short_status: 'STATUS_SUSPENDED'
                        }
                        statuses.push(status);
                    }
                }
                $('.taskStatusBox .taskStatus.cvcColorSquare', $(this)).each(function(i, elem) {
                    var elem = $(elem);
                    var group_key = _.contains(['all', 'un_known'], elem.attr('group_key')) ? 0 : elem.attr('group_key');
                    var elemStatusId = elem.attr('status_id');
                    var isValidStatus = false;
                    for (var i = 0; i < statuses.length; i++) {
                        var sts = statuses[i];
                        if (elemStatusId == sts[key]) {
                            isValidStatus = true;
                        }
                        // for example stage can be in many project ... so we need to filter out these stage too
                        if(!current_task.data[dataField]) {
                            continue;
                        }
                        if(dataField && current_task && current_task.data[dataField].indexOf(parseInt(group_key)) < 0) {
                            isValidStatus = false;
                        }
                    }
                    if (!isValidStatus) {
                        elem.remove();
                    }

                    elem.click(function(e) {
                        var statusElem = $(this);
                        // var newStatus = $(this).attr("status_id");
                        // wait until transaction is finish
                        var time_interval = setInterval(function() {
                            var taskid = taskRow.attr('taskid');
                            var task = self.my_page.ge.getTask(taskid);
                            var begin = !task.master.__currentTransaction;
                            if (begin) {
                                clearInterval(time_interval);
                                task.master.beginTransaction();
                                var newStatus = $(statusElem).attr("status");
                                var newStatusId = $(statusElem).attr('status_id');
                                task.changeStatus(newStatus);
                                task.master.endTransaction();

                                self.changedStatus(task, newStatusId);
                            }

                        }, 200);
                    })
                });
            })
        },

        ganttAttachingEvent: function() {
            var self = this;
            if (self.gantt_event_attached) {
                return
            }
            self.gantt_event_attached = true;
            this.watchEventWorkingOnGantt();
            $('.add-task-btn').click(function(e) {
                var startMillis = self.my_page.ge.gantt.startMillis;
                self.trigger_up('gantt_create_task', { startMillis: startMillis });
            });

            $('.button.requireCanSeeCriticalPath').click(function() {
                self.my_page.ge.gantt.showCriticalPath = !self.my_page.ge.gantt.showCriticalPath;
                self.my_page.ge.redraw();
                return false;
            });

            // Translate date header
            var zoomTimeout;
            $('.zoom-btn').click(function() {
                clearTimeout(zoomTimeout);
                zoomTimeout = setTimeout(function() {
                    translateDateFunc();
                }, 1000)
            });

            $('.resize1').click(function(e) {
                self.my_page.ge.splitter.resize(.1);
                return false;
            });

            $('.resize2').click(function(e) {
                self.my_page.ge.splitter.resize(50);
                return false;
            });

            $('.resize3').click(function(e) {
                self.my_page.ge.splitter.resize(100);
                return false;
            });

            $('.delete-task-btn').click(function(e) {
                var currentTask = self.my_page.ge.currentTask;
                if (!currentTask || currentTask.hasChild) {
                    return;
                }
                var res_id = currentTask.res_id;
                var def = new Promise(function(resolve, reject) {
                    var message = _lt("Delete") + " " + currentTask.name + "?";
                    var dialog = Dialog.confirm(self, message, {
                        title: _t("Delete"),
                        confirm_callback: resolve.bind(self, true),
                        cancel_callback: reject,
                    });
                    dialog.on('closed', self, reject);
                });
                def.then(function(confirm) {
                    if (confirm) {
                        $('#workSpace').trigger('deleteFocused.gantt');
                        self.saveGanttOnServer([res_id], ['delete'], false);
                    }
                });
                return false;

            });

            $('.moveup-task-btn').click(function(e) {
                $('#workSpace').trigger('moveUpCurrentTask.gantt');
                self.savingCurrentTask(true);
                return false;
            });
            $('.movedown-task-btn').click(function(e) {
                $('#workSpace').trigger('moveDownCurrentTask.gantt');
                self.savingCurrentTask(true);
                return false;
            });

            $('.print-gantt-btn').click(function(e) {
                // Reset width of assignment column
                $('.gdfWrapper .gdfTable.ganttFixHead .gdfColHeader').each(function(col) {
                    var cell = $(this);
                    if (col == 11) {
                        cell.width(150);
                    }

                });
                $('.gdfWrapper .gdfTable:not(.ganttFixHead) .gdfColHeader').each(function(col) {
                    var cell = $(this);
                    if (col == 11) {
                        cell.width(150);
                    }
                });
                self.my_page.ge.ganttPDF.exportPDF();
                reloadGridState()
            });

            // watch when user edit data in task row => save task
            $(document).on('change', '.taskEditRow input', function(e) {
                var taskRow = $(e.target).closest('.taskEditRow');
                var taskId = taskRow.attr('taskid');
                var task = self.my_page.ge.getTask(taskId);
                if (task && task.res_id && !task.hasChild) {
                    self.savingCurrentTask();
                } else if (task && !task.res_id && !task.hasChild) {
                    self.createCurrentTask(task);
                }
            });

            // Show menu option of right click for link group
            $("#TWGanttArea").contextmenu(function(e) {
                var focusedSVGElement = self.my_page.ge.gantt.element.find(".focused.focused");
                if (focusedSVGElement.is(".linkGroup")) {
                    e.preventDefault();
                    var client_x = e.clientX;
                    var client_y = e.clientY;
                    $('.menu-delete-link-group').removeClass('off');
                    // get postion of parent

                    $('.menu-delete-link-group').offset({ left: client_x, top: client_y });
                    $('.gantt-dialog-warning').remove();
                }
            });

            // Hide menu option of right click
            $('body').click(function(e) {
                $('.menu-delete-link-group').addClass('off');
                $('.gantt-dialog-warning').remove();
            });

            // trigger update when delete links by click delete link menu option of right click
            $('.menu-delete-link-group #delete-link-group-item').click(function(e) {
                var focusedSVGElement = self.my_page.ge.gantt.element.find(".focused.focused");
                var taskFrom = focusedSVGElement.data("from");
                var targetTask = focusedSVGElement.data("to");
                var superiorTasks = taskFrom.getSuperiorTasks();
                var inferiorTasks = taskFrom.getInferiorTasks();
                var taskToUpdate = superiorTasks.concat(inferiorTasks);
                taskToUpdate.push(taskFrom);
                self.my_page.ge.removeLink(focusedSVGElement.data("from"), focusedSVGElement.data("to"));
                // there may be another task with the sane res_id because we now can
                // group by many2many or one2many field
                var res_id_from = focusedSVGElement.data("from").res_id;
                var target_task_depends = focusedSVGElement.data("to").depends.split(',');
                var filtered_depdends = _.filter(target_task_depends, function(row_id) {
                    if (!row_id) return false;
                    var task_id = parseInt(row_id) - 1;
                    var task = self.my_page.ge.getTask(task_id);
                    return task.res_id != res_id_from && !task.hasChild
                });
                filtered_depdends = filtered_depdends.join(',');
                targetTask.depends = filtered_depdends;

                $('.menu-delete-link-group').addClass('off');
                self.savingTaskDrawOrDeleteLink(taskToUpdate);
            });
            $('.move-depend-task').click(function(e) {
                var elem = $(e.target);
                var direct = elem.closest('.menu-item').data('direction');
                var focusedSVGElement = self.my_page.ge.gantt.element.find(".focused.focused");
                var taskFrom = focusedSVGElement.data("from");
                var taskTo = focusedSVGElement.data("to");
                var start_date_field = self.arch.attrs.date_start;
                var stop_date_field = self.arch.attrs.date_stop;
                if (direct == -1 && taskFrom && taskTo) {
                    var distanceTime = taskFrom.end - taskFrom.start;
                    var end = taskTo.start;
                    var start = end - distanceTime;
                    var end_datetime = moment.utc(end).format(self.date_field_sql_format);
                    var start_datetime = moment.utc(start).format(self.date_field_sql_format);
                    var val_to_update = {
                        id: taskFrom.res_id,
                    }
                    val_to_update[start_date_field] = start_datetime;
                    val_to_update[stop_date_field] = end_datetime;
                    self.trigger_up('save_multiple_task', {
                        tasks: [val_to_update],
                        updateSequence: false
                    });
                } else if (direct == 1 && taskFrom && taskTo) {
                    var distanceTime = taskTo.end - taskTo.start;
                    var start = taskFrom.end;
                    var end = start + distanceTime;
                    var start_datetime = moment.utc(start).format(self.date_field_sql_format);
                    var end_datetime = moment.utc(end).format(self.date_field_sql_format);
                    var val_to_update = {
                        id: taskTo.res_id,
                    }
                    val_to_update[start_date_field] = start_datetime;
                    val_to_update[stop_date_field] = end_datetime;
                    self.trigger_up('save_multiple_task', {
                        tasks: [val_to_update],
                        updateSequence: false
                    });
                }
            });

            // When user draw link
            var saving_link_timeout;
            $(document).on('mouseover', '.taskBoxSVG', function(e) {
                var taskbox = $(e.target).parent();
                $(taskbox.find("[class*=linkHandleSVG]")).one('mousedown', function(e) {
                    $("body").one('mouseup', function(e) {
                        var targetBox = $(e.target).closest(".taskBoxSVG");
                        if (targetBox.length > 0) {
                            clearTimeout(saving_link_timeout);
                            saving_link_timeout = setTimeout(function() {
                                var taskId = targetBox.attr('taskid');
                                var task = self.my_page.ge.getTask(taskId);
                                var superiorTasks = task.getSuperiorTasks();
                                var inferiorTasks = task.getInferiorTasks();
                                var taskToUpdate = superiorTasks.concat(inferiorTasks);
                                taskToUpdate.push(task);
                                self.savingTaskDrawOrDeleteLink(taskToUpdate, ['update'], false);
                            }, 10)

                        }
                    });
                });
            });


            var inWorkSpace;
            var focusedSVGElement;
            var selectedTask;
            $('body').click(function(e) {
                // We must do this because there is an keydown handler happen in the lib, so we need to get data 
                // before that handler run
                setTimeout(function() {
                    focusedSVGElement = self.my_page.ge.gantt.element.find(".focused.focused");
                    selectedTask = self.my_page.ge.currentTask;
                }, 200);
            })
            // watch key press on work space
            $("body").bind("keydown.body", function(e) {
                var eventManaged = true;
                var isCtrl = e.ctrlKey || e.metaKey;
                // click event dont trigger when click on link
                if (self.my_page.ge.gantt.element.find(".focused.focused").length > 0) {
                    focusedSVGElement = self.my_page.ge.gantt.element.find(".focused.focused");
                }
                inWorkSpace = $(e.target).closest("#TWGanttArea").length > 0;
                if (inWorkSpace && isCtrl && e.keyCode == 38) { // CTRL+UP   on the grid
                    // move up current task
                    self.saveGanttOnServer([], ['update'], true);

                } else if (inWorkSpace && isCtrl && e.keyCode == 40) { //CTRL+DOWN   on the grid
                    // move down current task
                    self.saveGanttOnServer([], ['update'], true);
                } else if ((isCtrl && inWorkSpace) && (e.keyCode == 8 || e.keyCode == 46)) { //CTRL+DEL CTRL+BACKSPACE  on grid
                    // delete current task
                    var res_id = selectedTask.res_id;
                    if (!selectedTask || selectedTask.hasChild) {
                        var time_interval = setInterval(function() {
                            var begin = !self.my_page.ge.__currentTransaction;
                            if (begin) {
                                clearInterval(time_interval);
                                $('#workSpace').trigger('undo.gantt');
                            }
                        }, 200);
                    }
                    var def = new Promise(function(resolve, reject) {
                        var message = _lt("Delete") + " " + selectedTask.name + "?";
                        var dialog = Dialog.confirm(self, message, {
                            title: _t("Delete"),
                            confirm_callback: resolve.bind(self, true),
                            cancel_callback: reject,
                        });
                        dialog.on('closed', self, reject);
                    });
                    def.then(function(confirm) {
                        if (confirm) {
                            self.saveGanttOnServer([res_id], ['delete'], false);
                        }
                    });
                    def.catch(function() {
                        var time_interval = setInterval(function() {
                            var begin = !self.my_page.ge.__currentTransaction;
                            if (begin) {
                                clearInterval(time_interval);
                                $('#workSpace').trigger('undo.gantt');
                            }
                        }, 200);
                    });

                } else if (focusedSVGElement && focusedSVGElement.is(".taskBox") && (e.keyCode == 8 || e.keyCode == 46)) { //DEL BACKSPACE  svg task
                    // delete current task
                    var res_id = selectedTask.res_id;
                    if (!selectedTask || selectedTask.hasChild) {
                        var time_interval = setInterval(function() {
                            var begin = !self.my_page.ge.__currentTransaction;
                            if (begin) {
                                clearInterval(time_interval);
                                $('#workSpace').trigger('undo.gantt');
                            }
                        }, 200);
                    }
                    var def = new Promise(function(resolve, reject) {
                        var message = _lt("Delete") + " " + selectedTask.name + "?";
                        var dialog = Dialog.confirm(self, message, {
                            title: _t("Delete"),
                            confirm_callback: resolve.bind(self, true),
                            cancel_callback: reject,
                        });
                        dialog.on('closed', self, reject);
                    });
                    def.then(function(confirm) {
                        if (confirm) {
                            self.saveGanttOnServer([res_id], ['delete'], false);
                        }
                    });
                    def.catch(function() {
                        var time_interval = setInterval(function() {
                            var begin = !self.my_page.ge.__currentTransaction;
                            if (begin) {
                                clearInterval(time_interval);
                                $('#workSpace').trigger('undo.gantt');
                            }
                        }, 200);
                    });
                } else if (focusedSVGElement && focusedSVGElement.is(".linkGroup") && (e.keyCode == 8 || e.keyCode == 46)) {
                    //DEL BACKSPACE  svg link
                    // delete link
                    var targetTask = focusedSVGElement.data("to");
                    var superiorTasks = targetTask.getSuperiorTasks();
                    var inferiorTasks = targetTask.getInferiorTasks();
                    var taskToUpdate = superiorTasks.concat(inferiorTasks);
                    taskToUpdate.push(targetTask);
                    self.my_page.ge.removeLink(focusedSVGElement.data("from"), focusedSVGElement.data("to"));
                    // there may be another task with the sane res_id because we now can
                    // group by many2many or one2many field
                    var res_id_from = focusedSVGElement.data("from").res_id;
                    var target_task_depends = focusedSVGElement.data("to").depends.split(',');
                    var filtered_depdends = _.filter(target_task_depends, function(row_id) {
                        if (!row_id) return false;
                        var task_id = parseInt(row_id) - 1;
                        var task = self.my_page.ge.getTask(task_id);
                        return task.res_id != res_id_from && !task.hasChild
                    });
                    filtered_depdends = filtered_depdends.join(',');
                    targetTask.depends = filtered_depdends;
                    self.savingTaskDrawOrDeleteLink(taskToUpdate);
                } else {
                    eventManaged = false;
                }
                if (eventManaged) {
                    e.preventDefault();
                    e.stopPropagation();
                }

            });

            // fix bug autocomplete-ui dont show below the input in relational field
            $(document).on('click', '.ui-autocomplete-input', function(e) {
                var offset = $(e.target).offset();
                var position = {
                    top: offset.top - jQuery.css($(e.target)[0], "marginTop", true) + $(this).height(),
                    left: offset.left - jQuery.css($(e.target)[0], "marginLeft", true)
                }
                $('.ui-widget.ui-widget-content').css({ visibility: 'hidden' });
                var interval = setInterval(function() {
                    $('.ui-widget.ui-widget-content').each(function(i, elem) {
                        if ($.css($(elem)[0], 'display') != 'none') {
                            $(this).css(position);
                            $('.ui-widget.ui-widget-content').css({ visibility: '' });
                            clearInterval(interval);
                        }
                    });
                }, 80);

            });
        },
        /**
        * When user edit on gantt
        */
        watchEventWorkingOnGantt: function() {
            var self = this;
            // watch when user drag and resze task box => save task
            $('#TWGanttArea').one('mousedown', '.taskBoxSVG', function(e) {
                $('.ganttSVGBox').one('mousemove.deSVG', function() {
                    $(document).one("mouseup.deSVG", dragAndResizeTask);
                })
                self.watchEventWorkingOnGantt();
            });

            function dragAndResizeTask(e) {
                self.savingCurrentTask();
            }
            /*
            * show warning popup for task that has same user and start add the same datetime
            * only show for project task
            */
            $('#TWGanttArea').on('mouseover', '.task-alert', _.debounce(function(e) {
                if ($(e.target).closest('.taskEditRow').length > 0) {
                    var taskid = $(e.target).closest('.taskEditRow').attr('taskid');
                    var task = self.my_page.ge.getTask(taskid);
                    var task_data = task.data;
                    var task_alert = task_data['bad_resource_allocation_task_alert'];
                    task_alert = task_alert ? task_alert : '';
                    if (!task || !task_alert) {
                        return;
                    }
                    // Remove old warning
                    $('.gantt-dialog-warning').remove();
                    var client_x = e.clientX;
                    var client_y = e.clientY;
                    // List all tasks in gantt overlapping with current task
                    var overlapping_tasks = [];
                    for (var i = 0; i < task.data.bad_resource_allocation_task_ids.length; i++) {
                        var task_id = task.data.bad_resource_allocation_task_ids[i];
                        for (var j = 0; j < self.my_page.ge.tasks.length; j++) {
                            var t = self.my_page.ge.tasks[j];
                            if (t.res_id == task_id) {
                                overlapping_tasks.push(t.name);
                            }
                        }
                    }
                    var warning = $(QWeb.render('GanttView.inlogical_task_warning',
                        {
                            task_alert: task_alert,
                            overlapping_tasks: overlapping_tasks
                        }
                    ));
                    $('body').append(warning)
                    $('.gantt-dialog-warning').offset({ left: client_x, top: client_y });
                }
            }, 100))
        },

        savingCurrentTask: function(updateSequence = false) {
            var self = this;
            var time_interval = setInterval(function() {
                var begin = !self.my_page.ge.__currentTransaction;
                if (begin) {
                    clearInterval(time_interval);
                    var taskRow = $('.taskEditRow.rowSelected');
                    var taskId = taskRow.attr('taskid');
                    var current_task = self.my_page.ge.getTask(taskId);
                    if (updateSequence) {
                        var parent = current_task.getParent();
                        if(!parent) return;
                        var childrens = parent.getChildren();
                        var updateId = [];
                        for (var i = 0; i < childrens.length; i++) {
                            updateId.push(childrens[i].id);
                        }
                        self.saveGanttOnServer(updateId, ['update'], true);
                        return;
                    }
                    if (!current_task) return;
                    // Update task
                    var updateId = [current_task.id];
                    self.saveGanttOnServer(updateId, ['update'], false);
                }
            }, 200);
        },
        createCurrentTask: function(task) {
            var self = this;
            var time_interval = setInterval(function() {
                var current_task = task ? task : self.my_page.ge.currentTask;
                var begin = !self.my_page.ge.__currentTransaction;
                if (begin) {
                    clearInterval(time_interval);
                    // Update task
                    var createId = [current_task.id];
                    self.saveGanttOnServer(createId, ['create'], false);
                }
            }, 200);
        },

        savingTaskDrawOrDeleteLink: function(taskToUpdate) {
            var self = this;
            var time_interval = setInterval(function(targetTask) {
                var begin = !self.my_page.ge.__currentTransaction;
                if (begin) {
                    clearInterval(time_interval);
                    if (!targetTask) return;
                    var taskUpdateId = [];
                    for (var i = 0; i < taskToUpdate.length; i++) {
                        taskUpdateId.push(taskToUpdate[i].id);
                    }
                    // Update task
                    self.saveGanttOnServer(taskUpdateId, ['update'], false);
                }
            }.bind(self, taskToUpdate), 200);
        },

        saveGanttOnServer: function(updateIds, operators = [], updateSequence = true) {
            var self = this;
            var vals_to_update = [];
            var vals_to_create = [];
            // Check which task is new, is needed to update, and needed to deleted
            $('.gdfTable:not(.ganttFixHead) .taskEditRow:not(.emptyRow)').each(function(i, elem) {
                var task_row = $(elem);
                var taskid = task_row.attr('taskid');
                var task = self.my_page.ge.getTask(taskid);
                if (!task || (updateIds.indexOf(task.id) < 0 && updateIds.length > 0)) {
                    return;
                }
                if (task && !task.auto_resize) {
                    if (!isNaN(task.res_id)) {
                        var val = self.getValueFromTaskRow(task_row, updateSequence);
                        if (val) {
                            // if update dont need task id in gantt => delete
                            vals_to_update.push(val);
                        }

                    } else {
                        var val = self.getValueFromTaskRow(task_row, updateSequence);
                        if (val) {
                            vals_to_create.push(val);
                        }
                    }
                }
            });
            if (operators.indexOf('update') >= 0) {
                self.trigger_up('save_multiple_task', {
                    tasks: vals_to_update,
                    updateSequence: updateSequence
                });
            }

            if (operators.indexOf('create') >= 0) {
                if (vals_to_create.length > 0) {
                    var row = self.my_page.ge.getTask(updateIds[0]).rowElement.index();
                    self.trigger_up('create_task', {
                        task: vals_to_create[0],
                        task_id: updateIds[0],
                        row: row,
                    });
                }
            }
            if (operators.indexOf('delete') >= 0) {
                self.trigger_up('delete_task', {
                    id: updateIds[0]
                });
            }

        },

        /**
        * Get task value from task row
        */
        getValueFromTaskRow: function(task_row, updateSequence) {
            var self = this;
            var taskid = task_row.attr('taskid');
            var task = self.my_page.ge.getTask(taskid);
            var start_date_field = self.arch.attrs.date_start;
            var stop_date_field = self.arch.attrs.date_stop;
            if (!task) {
                return;
            }
            // Get value name of task
            var name = $('input[name=name]', task_row).val();
            if (task.hasChild && task.auto_resize) {
                return;
            }
            var resId = task.res_id;
            var state_data_task;
            for (var i = 0; i < self.state.data.length; i++) {
                var d = self.state.data[i];
                if (d.id == resId) {
                    state_data_task = d;
                }
            }
            // var process = $('input[name=progress]', task_row).val();
            // Get datetime update
            var start = task.start;
            var start_datetime = new Date(start);
            var end = task.end;
            var end_datetime = new Date(end);

            var fieldStatus = self.arch.attrs.field_status || false;

            var task_depend_ids = self._processDependData(task_row);

            // re-update sequence
            var parent = task.getParent();
            var childrens = parent.getChildren();
            for (var i = 0; i < childrens.length; i++) {
                var ch = childrens[i];
                if (ch.id == task.id) {
                    var sequence = i;
                }
            }
            var data_task = {
                id: task.res_id,
            }
            if (!state_data_task || state_data_task.name != name) {
                data_task.name = name;
            }
            if (this.arch.attrs.depends && (!state_data_task || !_.isEqual(state_data_task[this.arch.attrs.depends], task_depend_ids))) {
                data_task[this.arch.attrs.depends] = [[6, 0, task_depend_ids]];
            }
            let new_start_date_val = self.date_type == 'datetime'?
                                    moment.utc(start_datetime.getTime()).format(self.date_field_sql_format):
                                    moment(start_datetime.getTime()).format(self.date_field_sql_format)
            if (!state_data_task || state_data_task[start_date_field] != new_start_date_val) {
                data_task[start_date_field] = new_start_date_val;
            }
            
            let new_end_date_val = self.date_type == 'datetime'?
                                    moment.utc(end_datetime.getTime()).format(self.date_field_sql_format):
                                    moment(end_datetime.getTime()).format(self.date_field_sql_format)
            if (!state_data_task || state_data_task[stop_date_field] != new_end_date_val) {
                data_task[stop_date_field] = new_end_date_val;
            }
            if (updateSequence && self.state.fields.sequence) {
                data_task.sequence = sequence;
            }
            if (this.fields_data._state) {
                if (task.status_obj) {
                    var key = self._getStatusKey();
                    var fieldStatus = self.arch.attrs.status;
                    data_task[fieldStatus] = task.status_obj[key];
                }
            } else {
                if (task.status_obj && !isNaN(task.status_obj.id) && parseInt(task.status_obj.id) > 0 && fieldStatus) {
                    var key = self._getStatusKey();
                    data_task[fieldStatus] = task.status_obj[key];
                }
            }
            if (updateSequence && self.fields.sequence) {
                data_task.sequence = sequence;
            }
            if (task.res_id) {
                return data_task;
            }
            var groupBys = this.state.to_grouped_by.length > 0 ? this.state.to_grouped_by : [this.arch.attrs.default_group_by];
            var parents = task.getParents();
            // Order parent by level to map to group, map field to parent task respectively
            parents.sort(function(a, b) {
                if (a.level > b.level) return 1;
                if (a.level < b.level) return -1;
                return 0;
            });
            for (var i = 0; i < groupBys.length; i++) {
                var f = groupBys[i].split(':')[0];
                var fInfo = self.state.fields[f];
                // Exclude case group by datetime
                if (fInfo.type == 'datetime' && groupBys[i].split(':')[1]) continue;
                var parentTask = parents[i];
                if (fInfo.type == 'boolean' && parentTask && parentTask.res_id && parentTask.res_id == 'false') {
                    data_task[f] = false;
                } else if (fInfo.type == 'boolean' && parentTask && parentTask.res_id && parentTask.res_id == 'true') {
                    data_task[f] = true;
                } else if (fInfo.type == 'many2many') {
                    // TODO personal_stage_type_ids is special field
                    if (f == 'personal_stage_type_ids') {
                        continue;
                    }
                    data_task[f] = [[4, 0, [parentTask.res_id]]];
                } else if (parentTask && parentTask.res_id) {
                    data_task[f] = parentTask.res_id;
                }
            }
            return data_task;
        },
        _getStatusKey: function() {
            var key = 'id';
            if (this.fields_data._state) {
                key = 'value';
            }
            return key;
        },

        /*
        * Convert depend in gantt to real depend in data
        */
        _processDependData: function(task_row) {
            var self = this;
            if (!this.fields_data.depends) {
                return;
            }
            var taskid = task_row.attr('taskid');
            var task = self.my_page.ge.getTask(taskid);
            var dependKey = this.arch.attrs.depends;
            var depends = $('input[name=depends]', task_row).val();
            var splited_depends = depends.split(',');
            // Id of task in odoo
            var task_depend_ids = [];
            for (var i = 0; i < splited_depends.length; i++) {
                var dep = splited_depends[i];
                // dep is row element => get row element
                $('.gdfTable:not(.ganttFixHead) .taskEditRow').each(function(i, elem) {
                    if (i == parseInt(dep) - 1) {
                        var tid = $(elem).attr('taskid');
                        var t = self.my_page.ge.getTask(tid);
                        if (t && t.res_id) {
                            task_depend_ids.push(t.res_id);
                        }
                    }

                });
            }
            var task_ids = [];
            var depend_ids = [];
            for (var i = 0; i < self.state.data.length; i++) {
                var task_json = self.state.data[i];
                if (task_ids.indexOf(task_json.id) == -1) {
                    task_ids.push(task_json.id);
                }
                if (task_json.id == task.res_id) {
                    depend_ids = task_json[dependKey];
                }
            }
            // If id is in depend ids but not in task_ids,  it can't be removed
            for (var i = 0; i < depend_ids.length; i++) {
                var dep = depend_ids[i];
                if (task_ids.indexOf(dep) == -1) {
                    task_depend_ids.push(dep);
                }
            }
            return task_depend_ids;
        }

    });



    return ViinGanttRenderer;
});
