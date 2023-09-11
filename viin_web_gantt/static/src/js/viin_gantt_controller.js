odoo.define('viin_web_gantt.ViinGanttController', function(require) {
	"use strict";

	var AbstractController = require('web.AbstractController');
	var core = require('web.core');
	var config = require('web.config');
	var Dialog = require('web.Dialog');
	var form_common = require('web.view_dialogs');
	var time = require('web.time');
	var session = require('web.session');
	var gantt_common = require('viin_web_gantt.common');
	var Pager = require('web.Pager');

	var _lt = core._lt;
	var gantt;

	var _t = core._t;
	var qweb = core.qweb;
	var default_colors = ['#FBB11E', '#3BBF67', '#0099FF', '#660066', '#d8d8d8', '#e5d8e3', '#ece9c2', '#dee180',
        '#abd4cc'];

	var rpc = require('web.rpc')

	var ViinGanttController = AbstractController.extend({
		custom_events: _.extend({}, AbstractController.prototype.custom_events, {
            'pager_changed': '_onPagerChanged',
			'gantt_create_task': '_onCreateTask',
			'gantt_resize': '_onGanttResizeTask',
			'gantt_print': '_onGanttPrintTask',
			'open_task_editor': '_onTaskDisplay',
			'save_multiple_task': '_onSaveMultipleTask',
			'delete_task': '_onDeleteTask',
			'create_task': '_onCreateFlyTask',
		}),

        /**
        * @override
        */
		init: function(parent, model, renderer, params) {
			var self = this;
			self._super.apply(self, arguments);
			var fetchColorFunc = self.renderer.arch.attrs.fetch_color;
			if (!fetchColorFunc) {
				self.fetchColors([]);
				this.renderer.status_colors = default_colors;
				self.renderer.color_loaded.resolve();
			} else {
				self._rpc({
					model: this.modelName,
					method: fetchColorFunc,
					fields: [],
					domain: [],
				}).then(function(result) {
					self.fetchColors(result);
					self.renderer.color_loaded.resolve();
				});
			}
			gantt = self;
            this.renderer.state.modelName = this.modelName;
			self.set('title', params.title);
			self.context = params.context;
		},
		/**
		* Get project task type and map it with colors
		* and call function to load data and gantt
		 */
		fetchColors: function(data) {
			var self = this;
            this.renderer.status_colors = [];
            if (data.length == 0) {
                self.renderer.fields_data._stages = false;
            } else {
                var default_sequence = Infinity;
                var default_stage = {};
                var group_stages = this._groupStageByDefaultGroupBy(data);
                _.each(group_stages, function(group) {
                    _.each(group, function(stg, i) {
                        var index = i;
                        stg.color = default_colors[index % default_colors.length];
                        stg.short_status = 'STATUS_SUSPENDED';
                        stg.index = index;
                        if (index < default_sequence) {
                            default_sequence = index;
                            default_stage = stg;
                        }
                    })
                });
                self.renderer.fields_data._stages = group_stages;
                self.renderer.fields_data.default_stage = default_stage;

            }
        },
        _groupStageByDefaultGroupBy: function(stages) {
            var filterStageCondition = eval(this.renderer.arch.attrs.filter_stage_condition);
            var stageField = filterStageCondition[2];
            var operator = filterStageCondition[1];
            var group_stages = {un_known: [], all: stages};
            _.each(stages, function(d) {
				var stg_val = Object.assign({}, d);
                var field_values = stg_val[stageField];
                if(_.isEmpty(field_values)) {
                    group_stages.un_known.push(stg_val);
                    return;
                }
                if(operator == 'IN') {
                    _.each(field_values, function(val) {
                        if(!group_stages[val]) group_stages[val] = [];
                        group_stages[val].push(stg_val);
                    });
                } else {
                    if(!group_stages[field_values[0]]) group_stages[field_values[0]] = [];
                    group_stages[val].push(stg_val);
                }
            });
            return group_stages;
        },
		/**
		* Passing param to update in the controller
		*/
		updateGantt: function(params) {
			var prevParam = this._getPrevParam();
			if (typeof params['scale'] != 'undefined') {
				this.scale_btn = params['scale'];
			}
			if (typeof params['limit'] != 'undefined') {
				prevParam['limit'] = params['limit'];
			}
			if (typeof params['offset'] != 'undefined') {
				prevParam['offset'] = params['offset'];
			} else {
				prevParam['offset'] = 0;
			}
			gantt_common.busy(true);
			this.reload(prevParam);

		},
		/**
		* @Overwrite
		*/
		update: function(params, options) {
			var self = this;
			// Save the previous search to combine to newly param
			this.prevParam = params;
			var shouldReload = (options && 'reload' in options) ? options.reload : true;
			var def = shouldReload ? this.model.reload(this.handle, params) : $.when();
			return this.dp.add(def).then(function(handle) {
				self.handle = handle || self.handle; // update handle if we reloaded
				var state = self.model.get(self.handle);
				var localState = self.renderer.getLocalState();
				return self.dp.add(self.renderer.updateState(state, params)).then(function() {
					self.renderer.setLocalState(localState);
					self._update(state, params);
					self.renderer._updateDataGantt().then(function () {
						// Focus on task
						var currentTask = self.renderer.my_page.ge.currentTask;
						if (currentTask) {
							self.setFocusTask(currentTask.res_id);
						}
					});
				});
			});
		},
		/**
		* @Overwrite
		*/
		reload: function(params) {
			this.model.scale_domain = [];
			if (this.scale_btn && this.scale_btn != 'all') {
				var scale = this.renderer._getScale();
				var fromDate = this.renderer.state.focus_date.clone().subtract(1, scale).startOf(scale);
				var toDate = this.renderer.state.focus_date.clone().add(3, scale).endOf(scale);
				var fieldStart = this.renderer.fields_data.start;
				this.model.scale_domain = this.model.scale_domain.concat([[fieldStart, '<', toDate.locale('en').format("YYYY-MM-DD")]]);
				this.model.scale_domain = this.model.scale_domain.concat(['|',
					[this.renderer.fields_data.end, ">", fromDate.locale('en').format("YYYY-MM-DD")],
					[this.renderer.fields_data.end, '=', false]]);
			}
			return this.update(params || {});
		},

		/**
		* @Overwrite
		*/
		on_attach_callback: function() {
			var self = this;
			this._super.apply(this, arguments);
			// set record limit to renderer
			this.renderer.state.record_per_page = this.record_limit;
		},
		/**
		* @Overwrite
		*/
		on_detach_callback: function() {
			this._super.apply(this, arguments);
			// Reset check loaded
			this.renderer.domAttached = false;
			this.renderer.dataLoaded = false;
		},
		/**
		* @Overwrite
		*/
		renderButtons: function($node) {
			var self = this;
            var $buttons = $(qweb.render("GanttView.buttons", {
                'widget': this.render
            }));

            $buttons.find('.o_gantt_button_scale').each(function() {
                var $target = $(this);
                if ($target.attr('value') == self.renderer.scale) {
                    $target.addClass('active');
                }
                $target.bind('click', function(event) {
                    return self.change_scale_button(event);
                });
            });
            $buttons.find('.o_gantt_button_left').bind('click', function() {
                return self.changeFocusDateLeft();
            });
            $buttons.find('.o_gantt_button_right').bind('click', function() {
                return self.changeFocusDateRight();
            });
            $buttons.find('.o_gantt_button_today').bind('click', function() {
                gantt_common.busy(true)
                return self.focusDateToday()
            });
            this.$buttons = $buttons;
			if ($node) {
				$buttons.appendTo($node);
			}
		},
		changeFocusDateLeft: function() {
			this.renderer.state.last_focus_date = this.renderer.cloneObj(this.renderer.state.focus_date, true);
			this.renderer.state.focus_date = this.renderer.state.focus_date.subtract(1, this.renderer._getScale());
			this.updateGantt({ scale: this.renderer.scale });

		},
		changeFocusDateRight: function() {
			this.renderer.state.last_focus_date = this.renderer.cloneObj(this.renderer.state.focus_date, true);
			this.renderer.state.focus_date = this.renderer.state.focus_date.add(1, this.renderer._getScale());
			this.updateGantt({ scale: this.renderer.scale });
		},
		focusDateToday: function() {
			var today = moment(new Date());
			Object.assign(this.renderer.state.focus_date, today);
			this.updateGantt({ scale: this.renderer.scale });
		},

		/**
		 * Handler used when clicking on an empty cell. The behaviour is to
		 * create a new task and apply some default values.
		 */
		createOnClick: function(startMillis) {
			var self = this;
			var startDate;
			if (!startMillis || startMillis <= 0) {
				startDate = moment(new Date());
			} else {
				startDate = moment(new Date(startMillis));
			}

			if (startDate < this.renderer.state.focus_date) {
				startDate = this.renderer.state.focus_date;
			}
			startDate = startDate.utc();

			var endDate;
			switch (self.renderer.scale) {
				case "all":
					endDate = startDate.clone().add(4, "day");
					break;
				case "day":
					endDate = startDate.clone().add(4, "hour");
					break;
				case "week":
					endDate = startDate.clone().add(2, "day");
					break;
				case "month":
					endDate = startDate.clone().add(4, "day");
					break;
				case "year":
					endDate = startDate.clone().add(2, "month");
					break;
			}
            let create = {}
            create["default_" + self.renderer.fields_data.start] = startDate.format("YYYY-MM-DD HH:mm:ss");
            create["default_" + self.renderer.fields_data.end] = endDate.format("YYYY-MM-DD HH:mm:ss");
			self.openTaskCreate(Object.assign(create, this.context));
		},

		openTaskCreate: function(context) {
			gantt_common.busy(true);
			var self = this;
			var pop = new form_common.FormViewDialog(this, {
				res_model: self.modelName,
				// res_id: resID,
				context: context,
				title: _lt("New"),
				on_saved: function(data) {
					var data_input = data.data;
					var fields = _.values(self.model.mapping).concat(self.model.gantt.to_grouped_by);
					fields = self.model.filterFieldSearchable(fields);
					self._rpc({
						model: self.modelName,
						method: 'search_read',
						context: self.model.gantt.context,
						fields: fields,
						domain: [['id', '=', data_input.id]]
					}).then(function(task_data) {
						gantt_common.busy(true);
						// Copy history
						var redoStack = self.renderer.cloneObj(self.renderer.my_page.ge.__redoStack, true);
						var undoStack = self.renderer.cloneObj(self.renderer.my_page.ge.__undoStack, true);

						self.mergeDataFromServerToGanttData(task_data[0], 'create');
						self.renderer._updateDataGantt();
						self.setFocusTask(task_data[0].id);

						// restore history
						self.renderer.my_page.ge.__redoStack = Object.values(redoStack).concat(self.renderer.my_page.ge.__redoStack);
						self.renderer.my_page.ge.__undoStack = Object.values(undoStack).concat(self.renderer.my_page.ge.__undoStack);

					});
					pop.close();
				}
			}).open();
			pop.opened().then(function() {
				// reset body to position relative to use datetime picker
				$('body').css({ position: 'relative' });
				gantt_common.busy(false);
			});
			pop.on('closed', pop, function() {
				gantt_common.busy(false);
				$('body').removeAttr('style')
			});
		},
		_onSaveMultipleTask: function(e) {
			var self = this;
			var vals = e.data.tasks;
			var updateSequence = e.data.updateSequence;
			if (updateSequence && self.renderer.state.fields.sequence) {
				var resIds = [];
				vals.sort(function(a, b) {
					if (a.sequence > b.sequence) return 1;
					if (a.sequence < b.sequence) return -1;
					return 0;
				});
				for (var i = 0; i < vals.length; i++) {
					resIds.push(vals[i].id);
					delete vals[i].sequence;
				}
				self._rpc({
                    route: '/web/dataset/resequence',
                    params: {
                        model: self.modelName,
                        ids: resIds,
                    },
				}).then({}, function() {
					Dialog.alert(null, _t('Update sequence failed!'));
					self.updateGantt({});
				});
			}
			this._rpc({
				model: this.modelName,
				method: 'write_from_gantt',
				args: [vals],
			}).then(function(records) {
				// re-update data in state
				var dateStartField = self.getFieldMapping('date_start');
				var dateEndField = self.getFieldMapping('date_stop');
				var tasksData = [];
				for (var i = 0; i < records.length; i++) {
					var rec = records[i];
					var d;
					for (var j = 0; j < self.renderer.state.data.length; j++) {
						d = self.renderer.state.data[j];
						// find match
						if (d.id == rec.id) {
							// Update each field respectively
							var f;
							for (f in d) {
								self.renderer.state.data[j][f] = rec[f];
							}
							break;
						}
					}
					var start = moment(rec[dateStartField]).toDate();
					var startInLocal = self.renderer.convertUTCDateToLocalDate(start);
					var end = moment(start).clone().add(1, 'day').toDate();
					end = rec[dateEndField] ? moment(rec[dateEndField]).toDate() : end;
					var endInLocal = self.renderer.convertUTCDateToLocalDate(end);
					tasksData.push({
						id: rec.id,
						start: startInLocal,
						end: endInLocal,
						data: d,
					});
				}
				// Sometimes server compute start date and end date is different from sent
				self.savedMultipleTaskToGantt(tasksData);
			}, function() {
                Dialog.alert(null, _t('Saving failed!'));
                self.updateGantt({});
                setTimeout(function() {
                    gantt_common.busy(false);
                }, 2000)
            });
		},

		_onDeleteTask: function(e) {
			var id = e.data.id;
			var self = this;
			this._rpc({
				model: this.modelName,
				method: 'unlink',
				args: [id],
			}).then(function() {
				for (var j = 0; j < self.renderer.state.data.length; j++) {
					var d = self.renderer.state.data[j];
					if (d.id == id) {
						self.renderer.state.data.splice(j, 1);
					}
				}
			}, function() {
				Dialog.alert(null, _t('Deleting failed!'));
				self.updateGantt({});
				setTimeout(function() {
					gantt_common.busy(false);
				}, 2000)
			});
		},

		_onCreateFlyTask: function(e) {
			var val = e.data.task;
			var task_id = e.data.task_id;
			var self = this;
			this._rpc({
				model: this.modelName,
				method: 'create',
				args: [val],
                context: this.context
			}).then(function(recordId) {
				var fields = _.values(self.model.mapping).concat(self.model.gantt.to_grouped_by);
				fields = self.model.filterFieldSearchable(fields);
				// re-update data in state
				self._rpc({
					model: self.modelName,
					method: 'search_read',
					context: self.model.gantt.context,
					fields: fields,
					domain: [['id', '=', recordId]]
				}).then(function(records) {
					// Only get field exist in model
					var dateStartField = self.getFieldMapping('date_start');
					var dateEndField = self.getFieldMapping('date_stop');
					var tasksData = [];
					for (var i = 0; i < records.length; i++) {
						var rec = records[i];
						var d = { id: rec.id };
						for (var j = 0; j < fields.length; j++) {
							var f = fields[j];
							d[f] = rec[f]
						}
						self.renderer.state.data.push(d);
						// Get created task id in gantt and map it to created task
						var task = self.renderer.my_page.ge.getTask(task_id);
						task.data = d;
						task.res_id = rec.id
						var start = moment(rec[dateStartField]).toDate();
						var startInLocal = self.renderer.convertUTCDateToLocalDate(start);
						var end = moment(start).clone().add(1, 'day').toDate();
						end = rec[dateEndField] ? moment(rec[dateEndField]).toDate() : end;
						var endInLocal = self.renderer.convertUTCDateToLocalDate(end);
						tasksData.push({
							id: rec.id,
							start: startInLocal,
							end: endInLocal,
							data: d
						});
					}
					// Sometimes server compute start date and end date is different from sent
					self.savedMultipleTaskToGantt(tasksData);
				});
			}, function() {
				Dialog.alert(null, _t('Creating failed!'));
				gantt_common.busy(true);
				self.renderer._processData();
				var row = e.data.row;
				// find closest task to focus
				var closestTaskRow = $('.gdfTable:not(.ganttFixHead) .taskEditRow').eq(row - 2);
				var closestTaskId = closestTaskRow.attr('taskid');
				var closestTask = self.renderer.my_page.ge.getTask(closestTaskId);
				if (closestTask && !closestTask.hasChild) {
					self.setFocusTask(closestTask.res_id);
				}
			});
		},

		/**
		 * Dialog to edit/display a task.
		*/
		_onTaskDisplay: function(e) {
			gantt_common.busy(true);
			var task = e.data;
			var self = this;
			var task_id = parseInt(task.res_id);
			self.open_task_id = task_id;
			if (!self.activeActions.create && !self.activeActions.edit && !self.activeActions.delete) {
				if (task.hasChild) {
					var action = {
						name: task.string + ': ' + task.name,
						type: 'ir.actions.act_window',
						res_model: task.res_model,
						res_id: task_id,
						context: this.initialState.context,
						views: [[false, 'form']],
						target: 'new',
						flags: {
							'initial_mode': 'view'
						}
					};
					self.do_action(action);
				} else {
					var action = {
						name: task.name,
						type: 'ir.actions.act_window',
						res_model: self.modelName,
						res_id: task_id,
						views: [[false, 'form']],
						context: self.initialState.context,
						target: 'new',
						flags: {
							'initial_mode': 'view'
						}
					};
					self.do_action(action);
				}
			} else {
				if (task.hasChild) {
					var d = new form_common.FormViewDialog(this, {
						res_model: task.res_model,
						res_id: task_id,
						context: self.initialState.context,
						title: _lt("New"),
						buttons: [{
							text: _lt("Save"),
							classes: 'btn-primary',
							disabled: !self.activeActions.edit,
							click: function() {
								var d = this;
								this._save().then(function() {
									var def = $.Deferred();
									self._rpc({
										model: task.res_model,
										method: 'search_read',
										context: self.model.gantt.context,
										fields: ['name'],
										domain: [['id', '=', task_id]]
									}).then(function(data) {
										var name = data[0].name;
										if (name != task.name) {
											def.resolve(task, name)
										}

									});
									def.then(function(task, name) {
										self.savedTask({
											id: task.id,
											data: {
												name: name
											}
										});
									});
									d.close();
								});
							}
						}, {
							text: _lt("Close"),
							classes: 'btn-default',
							close: true
						}]
					}).open();
					d.opened().then(function() {
						// reset body to position relative to use datetime picker
						$('body').css({ position: 'relative' });
						gantt_common.busy(false);
					});
					d.on('closed', d, function() {
						gantt_common.busy(false);
						// Reset position to initial to use gantt
						$('body').removeAttr('style');
					});
				} else {
					var d = new form_common.FormViewDialog(this, {
						res_model: self.modelName,
						res_id: task_id,
						context: self.initialState.context,
						title: task.name,
						buttons: [
							{
								text: _lt("Save"),
								classes: 'btn-primary',
								disabled: !self.activeActions.edit,
								click: function() {
									var d = this;
									var state = this.form_view.renderer.state;
									// Validate date start and date end
									var date_start = false;
									if (state.data.date_start) {
										date_start = state.data.date_start.format('X');
									}
									var date_end = false;
									if (state.data.date_end) {
										date_end = state.data.date_end.format('X');
									}
									if (date_start && date_end && date_start > date_end) {
										Dialog.alert(null, _t('Error ! Task starting date must be lower than its ending date.'));
										return;
									}
									this._save().then(
										function() {
											var fields = _.values(self.model.mapping).concat(self.model.gantt.to_grouped_by);
											fields = self.model.filterFieldSearchable(fields);
											self._rpc({
												model: self.modelName,
												method: 'search_read',
												context: self.model.gantt.context,
												fields: fields,
												domain: [['id', '=', task_id]],
											}).then(function(data) {
												gantt_common.busy(true);
												// Copy history
												var redoStack = self.renderer.cloneObj(self.renderer.my_page.ge.__redoStack, true);
												var undoStack = self.renderer.cloneObj(self.renderer.my_page.ge.__undoStack, true);

												self.mergeDataFromServerToGanttData(data[0], 'update');
												self.updateGantt({});
												self.setFocusTask(data[0].id);

												// restore history
												self.renderer.my_page.ge.__redoStack = Object.values(redoStack).concat(self.renderer.my_page.ge.__redoStack);
												self.renderer.my_page.ge.__undoStack = Object.values(undoStack).concat(self.renderer.my_page.ge.__undoStack);
											});
											d.close();
										});
								}
							}, {
								text: _lt("Delete"),
								classes: 'btn-danger',
								close: false,
								disabled: !self.activeActions.delete,
								click: function() {
									var dlg = this;
									Dialog.confirm(self, _lt("Delete") + " " + task.name + "?", {
										title: _lt("Delete"),
										confirm_callback: function() {
											self._rpc({
												model: self.modelName,
												method: 'unlink',
												args: [parseInt(task_id)]
											}).then(function() {
												self.open_task_id = false;
												self.deletedTask({
													id: task.id
												});
												// Delete task record in state data
												for (var i = 0; i < self.renderer.state.data.length; i++) {
													var d = self.renderer.state.data[i];
													if (d.id == task_id) {
														self.renderer.state.data.splice(i, 1);
													}
												}
												dlg.close();
											});

										}
									});
								}
							}, {
								text: _lt("Close"),
								classes: 'btn-default',
								close: true
							}]
					}).open();
					d.opened().then(function() {
						gantt_common.busy(false);
						// reset body to position relative to use datetime picker
						$('body').css({ position: 'relative' });
					});
					d.on('closed', d, function() {
						gantt_common.busy(false);
						// Reset position to initial to use gantt
						$('body').removeAttr('style');
					});
				}
			}
		},

		change_scale_button: function(e) {
			/*busy(true)*/
			var $target = $(e.target);
			$target.parent().find('.active').removeClass('active');
			$target.addClass('active');
			this.renderer.scale = e.target.value;
			this.updateGantt({ scale: e.target.value });
		},
		_onCreateTask: function(event) {
			var startMillis = event.data.startMillis;
			this.createOnClick(startMillis);

		},
		_onGanttPrintTask: function() {
			this.renderer.my_page.ge.ganttPDF.exportPDF();
		},

		savedTask: function(params) {
			var task = this.renderer.my_page.ge.getTask(params.id);
			var t = params.data;
			task.master.beginTransaction();
			task.depends = t.depends;
			t = this.renderer.mapDependToSpecificTask(t);
			if (t.hasOwnProperty('progress')) {
				task.progress = t.progress
			}
			if (t.end && t.start) {
				task.master.changeTaskDates(task, t.start, t.end);
			}
			$.extend(task, t);
			task.master.updateLinks(task);
			task.master.endTransaction();
		},


		/*
		* Update multiple task date
		*/
		savedMultipleTaskToGantt: function(params) {
			var ge = this.renderer.my_page.ge;
			var tasksData = [];
			for (var i = 0; i < params.length; i++) {
				var param = params[i];
				var task;
				for (var j = 0; j < ge.tasks.length; j++) {
					var t = ge.tasks[j];
					if (!t.auto_resize && t.res_id == param.id) {
						task = t;
                        break;
					}
				}
                for (var k = 0; k < ge.tasks.length; k++) {
                    var ta = ge.tasks[k];
                    if(ta.hasChild) {
                        continue
                    }
                    if(param['data'].bad_resource_allocation_task_ids && param['data'].bad_resource_allocation_task_ids.indexOf(ta.res_id) >= 0) {
                        ta.rowElement.find('.alert-col i').addClass('fa fa-exclamation-triangle text-danger task-alert');
                        if(ta.data.bad_resource_allocation_task_ids.indexOf(param.id) < 0) {
                            ta.data.bad_resource_allocation_task_ids.push(param.id);
                        }
                        // The following code is kind of strange, but that is short way to update warning message to
                        // task
                        var warning_message = param['data'].bad_resource_allocation_task_alert;
                        if(ta.data && ta.data.bad_resource_allocation_task_count > 0) {
                            warning_message = warning_message.replace(/\d+/g, ta.data.bad_resource_allocation_task_count);
                            ta.data.bad_resource_allocation_task_alert = warning_message;
                        }
                    } else {
                        if(ta.data && ta.data.bad_resource_allocation_task_ids) {
                            ta.data.bad_resource_allocation_task_ids = ta.data.bad_resource_allocation_task_ids.filter(item => item != param.id)
                        }
                        if (ta.data && ta.data.bad_resource_allocation_task_count == 0) {
                            ta.rowElement.find('.alert-col i').removeClass('fa fa-exclamation-triangle text-danger task-alert');
                        }
                    }
                }
				task.depends = param.depends;
				param = this.renderer.mapDependToSpecificTask(param);
				var depend_field = this.renderer.arch.attrs.depends;
				if (depend_field) {
					var gantt_dep = this.renderer.mapDependToSpecificTask({depends: param.data[depend_field]});
					task.depends = gantt_dep.depends;
				}
				this.mergeDataFromServerToGanttData(param.data, 'update');
				if (param.start && param.end) {
					task.data = param.data;
					var status = this.renderer.getStatusObj(null, param.data);
					task.status = status ? status.short_status : 'STATUS_SUSPENDED';
					task.status_obj = status;
					tasksData.push({
						task: task,
						start: param.start,
						end: param.end,
					});
                    // Update alert
                    if (param['data'].bad_resource_allocation_task_count && param['data'].bad_resource_allocation_task_count > 0) {
                        task.rowElement.find('.alert-col i').addClass('fa fa-exclamation-triangle text-danger task-alert');
                    } else {
                        task.rowElement.find('.alert-col i').removeClass('fa fa-exclamation-triangle text-danger task-alert');
                    }
				}
				$.extend(task, t);
			}
			if (tasksData.length > 0) {
				ge.changeMultipleTask(tasksData);
			}
		},

		/*
		* get real field in model from field in viin gantt
		*/
		getFieldMapping: function(fieldname) {
			if (this.model.mapping[fieldname]) {
				return this.model.mapping[fieldname];
			}
			return false;
		},

		deletedTask: function(params) {
			$('#workSpace').trigger('deleteFocused.gantt');
		},

		/**
		* merge data when add or edit to gantt data
		*/
		mergeDataFromServerToGanttData: function(data, operation) {
			var self = this;
			var fields = _.values(self.model.mapping).concat(self.model.gantt.to_grouped_by);
			fields = self.model.filterFieldSearchable(fields);
			if (operation == 'update') {
				var ganttData = this.renderer.state.data;
				// merge data from self.renderer.state.data to gantt data (gantt data contain depend, name , start that is not saved )
				for (var j = 0; j < ganttData.length; j++) {
					if (ganttData[j].id == data.id) {
						ganttData[j] = data;
					}
				}
				self.renderer.state.data = ganttData;
			} else if (operation == 'create') {
				var ganttData = this.renderer.state.data;
				// merge data from self.renderer.state.data to gantt data (gantt data contain depend, name , start that is not saved )
				ganttData.push(data);
				self.renderer.state.data = ganttData;
			}

		},

		/**
		* Set current for created task
		*/
		setFocusTask: function(res_id) {
			var self = this;
			var tasks = self.renderer.my_page.ge.tasks;
			for (var i = 0; i < tasks.length; i++) {
				var task = tasks[i];
				if (!task.hasChild) {
					if (task.res_id == res_id) {
						task.rowElement.click();
						// Handle scroll to focus task
						var interval = setInterval(function() {
							var begin = !self.renderer.my_page.ge.__currentTransaction;
							if (begin) {
								clearInterval(interval);
								var visibleRowNum = self.renderer.my_page.ge.numOfVisibleRows;
								var rowHeight = self.renderer.my_page.ge.rowHeight;
								var index = self.renderer.my_page.ge.currentTask?.rowElement.index();
								var minRowInEditor = self.renderer.my_page.ge.minRowsInEditor;
								// always keep focus task in the middle of gantt workspace
								var invisibleRow = index > minRowInEditor ? index - minRowInEditor : 0;
								var scrollToMiddle = 0;
								if (invisibleRow > 0) {
									scrollToMiddle = visibleRowNum / 2;
								} else if (index <= visibleRowNum / 2) {
									scrollToMiddle = 0;
								} else if (index > visibleRowNum / 2) {
									scrollToMiddle = index - visibleRowNum / 2;
								}
								var top = Math.floor((scrollToMiddle + invisibleRow) * rowHeight);
								$('.splitBox2').scrollTop(top);
							}
						}, 200)
					}
				}
			}
		},

		/**
	     * Return the params (current_min, limit and size) to pass to the pager,
	     * according to the current state.
	     */
		_getPagerParams: function() {
			var self = this;
			return {
				current_min: (self.model.gantt.offset ? self.model.gantt.offset : 0) + 1,
				limit: self.model.gantt.limit,
				size: self.model.total_records,
			};
		},

        /**
         * Return the params (currentMinimum, limit and size) to pass to the pager,
         * according to the current state.
         *
         * @override
         * @returns {Object}
         */
        _getPagingInfo: function (state) {
            var params = this._getPagerParams();
            return {
                currentMinimum: params.current_min,
                limit: params.limit,
                size: params.size,
            };
        },
		/**
		* Build param for reload
		* */
        _getPrevParam: function () {
            var prevParam = this.prevParam;
            if (typeof prevParam == 'undefined') {
                prevParam = {};
                prevParam['context'] = this.initialState.context;
                prevParam['domain'] = this.initialState.domain;
                prevParam['groupBy'] = this.model.gantt.to_grouped_by;
                prevParam['modelName'] = this.modelName;
                prevParam['offset'] = 0;
            }
            return prevParam;
        },
        _onPagerChanged: async function (ev) {
            ev.stopPropagation();
            const { currentMinimum, limit } = ev.data;
            var prevParam = this._getPrevParam();
            var data = this.model.get(this.handle, { raw: true });
            var limitChanged = (data.limit !== limit);
            var reloadParams;
            var self = this;
            if (data.groupedBy && data.groupedBy.length) {
                reloadParams = Object.assign({}, prevParam, { groupsLimit: limit, groupsOffset: currentMinimum - 1 })
            } else {
                reloadParams = Object.assign({}, prevParam, { limit: limit, offset: currentMinimum - 1 });
            }
            gantt_common.busy(true);
            this.reload(reloadParams).then(function() {
                // reset the scroll position to the top on page changed only
                if (!limitChanged) {
                    self.trigger_up('scrollTo', { top: 0 });
                }
            });
        }

	});

	return ViinGanttController;
})
