odoo.define('viin_web_gantt.viin_gantt_test', function(require) {
	var ViinGanttView = require('viin_web_gantt.ViinGanttView');
	var testUtils = require('viin_web_gantt.test_utils');
	var session = require('web.session');
	
	var createViinGanttView = testUtils.createViinGanttView;
	
	var current_datetime = new Date;
	
	function _preventScroll(ev) {
	    ev.stopImmediatePropagation();
	}
	function offsetByDay(d, days = 0) {
		d.setDate(d.getDate() + days);
		var year = d.getFullYear();
		var month = ('0' + (d.getMonth() + 1)).substr(-2);
		var day = ('0' + d.getDate()).substr(-2);
		
		var hours = ('0' + d.getHours()).substr(-2);
		var minute = ('0' + d.getMinutes()).substr(-2);
		var second = ('0' + d.getSeconds()).substr(-2);
		
		return year + '-' + month + '-' + day + ' ' + hours + ':' + minute + ':' + second;
	}
	
	function offsetByMonth(d, months = 0) {
		d.setMonth(d.getMonth() + months);
		var year = d.getFullYear();
		var month = ('0' + (d.getMonth() + 1)).substr(-2);
		var day = ('0' + d.getDate()).substr(-2);
		
		var hours = ('0' + d.getHours()).substr(-2);
		var minute = ('0' + d.getMinutes()).substr(-2);
		var second = ('0' + d.getSeconds()).substr(-2);
		
		return year + '-' + month + '-' + day + ' ' + hours + ':' + minute + ':' + second;
	}
	
	function offsetByYear(d, years = 0) {
		d.setFullYear(d.getFullYear() + years);
		var year = d.getFullYear();
		var month = ('0' + (d.getMonth() + 1)).substr(-2);
		var day = ('0' + d.getDate()).substr(-2);
		
		var hours = ('0' + d.getHours()).substr(-2);
		var minute = ('0' + d.getMinutes()).substr(-2);
		var second = ('0' + d.getSeconds()).substr(-2);
		
		return year + '-' + month + '-' + day + ' ' + hours + ':' + minute + ':' + second;
	}
	
	function timeout(ms) {
	    return new Promise(resolve => setTimeout(resolve, ms));
	}
    
    function manuallySetZoom(id, zoom) {
        if(!localStorage) {
            return;
        }
        var savedZooms = {};
        savedZooms[id] = zoom;
        localStorage.setItem("TWPGanttSavedZooms", JSON.stringify(savedZooms));
    }
	
	QUnit.module('Views', {
		beforeEach: function() {
			window.addEventListener('scroll', _preventScroll, true);
			$('body').css({'overflow-y': 'hidden'});
			session.uid = -1; // TO CHECK
			this.data = {
				task: {
					fields: {
						id: {string: "ID", type: "integer"},
						user_ids: {string: "user", type: "many2many", relation: 'user', default: session.uid},
						manager_id: {string: "user", type: "many2one", relation: 'user', default: session.uid},
						name: {string: "name", type: "char"},
						planned_date_start: {string: 'Planned Start Date', type: 'datetime'},
						planned_date_end: {string: 'Planned End Date', type: 'datetime'},
						create_date: {string: 'Create Date', type: 'datetime'},
						sequence: {string: 'Sequence', type: 'integer'},
						depend_ids: {string: 'Depend Task', type: "many2many", relation: 'task'},
						stage_id: {string: 'Stage', type: "many2one", relation: 'stage'},
						project_id: {string: "Project", type: "many2one", relation: "project"},
						progress: {string: "Progress", type: "float", default: 0},
                        bad_resource_allocation_task_ids: {string: "bad rerource allocation task ids", type: "many2many"},
                        bad_resource_allocation_task_alert: {string: "bad resource allocation task alert", type: "char"}
					},
					records: [
						{
                            id: 1, manager_id: 4, name: 'Room 2: Decoration1', user_ids: [4,5],
                            planned_date_start: offsetByDay(new Date(),-5), planned_date_end: offsetByDay(new Date(), -3), 
                            create_date: '2021-08-06 06:18:25', sequence: 1, stage_id: 1, 
                            project_id: 1, progress: 0, bad_resource_allocation_task_ids: [],
                            bad_resource_allocation_task_alert: false
                        },
						{
                            id: 3, manager_id: 4, name: 'Decoration', user_ids: [session.uid],
                            planned_date_start: offsetByDay(new Date(), -15), planned_date_end: offsetByMonth(new Date(), -3), 
                            create_date: '2021-08-06 06:18:25', sequence: 1, stage_id: 1, 
                            project_id: 1, progress: 20, bad_resource_allocation_task_ids: [],
                            bad_resource_allocation_task_alert: false
                        },
						{
                            id: 4, manager_id: 4, name: 'Decoration 1', user_ids: [4,5],
                            planned_date_start:  offsetByDay(new Date(), -10), planned_date_end: offsetByDay(new Date(), -2), 
                            create_date: '2021-08-06 06:18:25', sequence: 1, stage_id: 1, 
                            project_id: 1, bad_resource_allocation_task_ids: [],
                            bad_resource_allocation_task_alert: false
                        },
						{
                            id: 5, manager_id: 4, name: 'Decoration 2', user_ids: [4,5],
                            planned_date_start: offsetByDay(new Date()), planned_date_end: offsetByDay(new Date(), 3), 
                            create_date: '2021-08-06 06:18:25', sequence: 1, stage_id: 2, 
                            project_id: 2, bad_resource_allocation_task_ids: [],
                            bad_resource_allocation_task_alert: false
                        },
						{
                            id: 6, manager_id: 4, name: 'Decoration 4', user_ids: [4,5],
                            planned_date_start: offsetByDay(new Date()), planned_date_end: offsetByDay(new Date(), 4), 
                            create_date: '2021-08-06 06:18:25', sequence: 1, stage_id: 2, 
                            project_id: 2, bad_resource_allocation_task_ids: [],
                            bad_resource_allocation_task_alert: false
                        }
					],
					check_access_rights: function () {
	                    return Promise.resolve(true);
	                },
				},
				order: {
					fields: {
						id: {string: "ID", type: "integer"},
						user_id: {string: "user", type: "many2one", relation: 'user', default: session.uid},
						name: {string: "name", type: "char"},
						planned_date_start: {string: 'Planned Start Date', type: 'datetime'},
						planned_date_end: {string: 'Planned End Date', type: 'datetime'},
						create_date: {string: 'Create Date', type: 'datetime'},
						product_id: {string: 'Product', type: 'many2one', relation: 'product'},
						state: {string: "State", type: "selection", selection: [
								['draft', 'Draft'], 
								['confirmed', 'Confirmed'],
								['planned', 'Planned'],
								['progress', 'In Progress'],
								['to_close', 'To Close'],
								['done', 'Done'],
								['cancel', 'Cancelled'],
							],
						},
						reference: { string: "Reference Field", type: 'reference', selection: [["product", "Product"], ["partner_type", "Partner Type"], ["partner", "Partner"]] },
					},
					records: [
						{id: 1, user_id: 4, name: 'WH/MO/00008', planned_date_start: offsetByDay(new Date(),-5), planned_date_end: offsetByDay(new Date(), -3), create_date: '2021-08-06 06:18:25', product_id: 37, state: 'draft'},
						{id: 3, user_id: session.uid, name: 'WH/MO/00007', planned_date_start: offsetByMonth(new Date(), -5), planned_date_end: offsetByMonth(new Date(), -3), create_date: '2021-08-06 06:18:25', product_id: 37, state: 'confirmed'},
						{id: 4, user_id: 4, name: 'WH/MO/00006', planned_date_start:  offsetByYear(new Date(), -2), planned_date_end: offsetByYear(new Date(), -2), create_date: '2021-08-06 06:18:25', product_id: 37, state: 'progress'},
						{id: 5, user_id: 4, name: 'WH/MO/00005', planned_date_start: offsetByDay(new Date()), planned_date_end: offsetByDay(new Date(), 3), create_date: '2021-08-06 06:18:25', product_id: 37, state: 'to_close'},
						{id: 6, user_id: 4, name: 'WH/MO/000021', planned_date_start: offsetByDay(new Date()), planned_date_end: offsetByDay(new Date(), 4), create_date: '2021-08-06 06:18:25', product_id: 37, state: 'to_close'},
						{id: 7, user_id: 4, name: 'WH/MO/00010', planned_date_start: offsetByDay(new Date()), planned_date_end: offsetByDay(new Date(), 4), create_date: '2021-08-06 06:18:25', product_id: 38, state: 'done'}
					]
				},
				stage: {
                    fields: {
                        id: {string: "ID", type: "integer"},
                        name: {string: "name", type: "char"},
                        display_name: {string: "Display Name", type: "char"},
                        color: {string: "Color", type: "integer"},
                        sequence: {string: "Sequence", type: "integer"},
                        project_ids: {string: "Project", type: "many2many", relation: "project"},
                    },
                    records: [
                        {id: 1, name: "New", display_name: "New", color: 1, sequence: 1, project_ids: [1, 2]},
                        {id: 2, name: "In progress", display_name: "In progress", color:2, sequence: 2, project_ids: [1, 2]},
                    ]
                },
				user: {
	                fields: {
	                    id: {string: "ID", type: "integer"},
	                    display_name: {string: "Displayed name", type: "char"},
	                    partner_id: {string: "partner", type: "many2one", relation: 'partner'},
	                    image: {string: "image", type: "integer"},
	                },
	                records: [
	                    {id: session.uid, display_name: "user 1", partner_id: 1},
	                    {id: 4, display_name: "user 4", partner_id: 4},
                        {id: 5, display_name: "user 5", partner_id: 5},
	                ]
	            },
				project: {
					fields: {
						id: {string: 'ID', type: 'integer'},
						name: {string: 'name', type: 'char'},
						stage_id: {string: 'Stage', type: "many2many", relation: 'stage'},
					},
					records: [
						{id: 1, name: "Office Design", stage_id: [1, 2]},
						{id: 2, display_name: "Research & Development", stage_id: [2]},
					]
				},
				product:  {
					fields: {
						id: {string: 'ID', type: 'integer'},
						name: {string: 'name', type: 'char'},
					},
					records: [
						{id: 37, name: "[FURN_9666] Table (MTO)"},
						{id: 38, name: "[FURN_8522] Table Top"},
					]
				},
                partner: {
                    fields: {
                        id: {string: 'ID', type: 'integer'},
                        name: {string: 'name', type: 'char'},
                    },
                    records: [
                        {id: 1, name: "My Company (Sanfransisco)"},
                        {id: 4, name: "Public user"},
                        {id: 5, name: "Public user 5"},
                    ]
                }
			};
		},
		afterEach: function () {
	        window.removeEventListener('scroll', _preventScroll, true);
			$('body').css({'overflow-y': 'auto'});
	    },
	}, function() {
		QUnit.module('ViinGanttView');
		
		var archs = {
	        "task,false,form":
	            '<form>'+
					'<field name="name"/>'+
	            '</form>',
	        "task,1,form":
	            '<form>' +
	            '</form>',
	    };

		odoo.session_info = {};
		odoo.session_info.user_context = {};
		
		QUnit.test('TC13: when move task box',  async function(assert) {
			assert.expect(1);
            manuallySetZoom(0, '1M');
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
				mockRPC: function (route, args) {
	                if (args.method == 'write_from_gantt') {
	                    var id = args.args[0] && args.args[0][0] ? args.args[0][0].id : 0;
	                    assert.deepEqual(id, 5, "should be id of 6 update when move the task");
                        return Promise.resolve([]);
	                }
	                return this._super.apply(this, arguments);
	            },
	            viewOptions: {
	               
	            },
	        }, {positionalClicks: true});
            await timeout(3000);
			var taskbox = $('.taskBoxSVG[taskid=6]');
			var taskboxOffset = taskbox.offset();
			var windowWidth = $(window).width();
			var taskboxWidth = parseInt(taskbox.attr('width'));
			var slpitBar = $('.vSplitBar');
			var splitBarOffset = slpitBar.offset();
			// if task box left + taskboxWidth > windowWidth it means user cant see the task box, so scroll to left to see it
			// Do the same with split bar
			if(taskboxOffset.left + taskboxWidth >= windowWidth) {
				var currentScrollVal = $('.splitBox2').scrollLeft();
				var deltaScroll = (taskboxOffset.left - windowWidth) + taskboxWidth;
				var currentScrollVal = currentScrollVal + deltaScroll;
				$('.splitBox2').scrollLeft(currentScrollVal);
			} else if(taskboxOffset.left < splitBarOffset.left) {
				var currentScrollVal = $('.splitBox2').scrollLeft();
				var deltaScroll = (Math.abs(taskboxOffset.left) - splitBarOffset.left) + taskboxWidth;
				var currentScrollVal = currentScrollVal + deltaScroll;
				$('.splitBox2').scrollRight(currentScrollVal);
			}
			// get offset again after scroll
			taskboxOffset = taskbox.offset();
			$('.o_technical_modal').remove();
			$('.modal-backdrop').remove();
			testUtils.dom.triggerPositionalMouseEvent(taskboxOffset.left + 15, taskboxOffset.top + 10, "mousedown");
			await timeout(100);
			testUtils.dom.triggerPositionalMouseEvent(taskboxOffset.left + 15, taskboxOffset.top + 10, "mousemove");
			await timeout(100);
			testUtils.dom.triggerPositionalMouseEvent(taskboxOffset.left + 60, taskboxOffset.top + 10, "mouseup");
			await timeout(3000);
			viin_gantt.destroy()
		});
		
	   QUnit.test('TC01: simple viin gantt rendering', async function (assert) {
	        assert.expect(7);
	        var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" task_alert="1" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
	            viewOptions: {
	               
	            },
	        });
			await timeout(1000);			
			
			assert.ok(viin_gantt.$('.o_gantt_button_dates').length,
	            "should have button date");
			assert.ok(viin_gantt.$('.o_cp_buttons').find('.btn-group').length,
	            "should have button scale");
			assert.ok(viin_gantt.$('.splitBox1').length,
	            "should have split box left to display task info");
			assert.ok(viin_gantt.$('.splitBox2').length,
	            "should have split box right to display task box");
			assert.containsN(viin_gantt, '.gdfTable:not(.ganttFixHead) .taskEditRow:not(.emptyRow)',8,
	            "should 8 row gantt");
			assert.ok(viin_gantt.$('#tasksGroup').length,
	            "should have task box group");
			assert.ok(viin_gantt.$('#tasksGroup').find('.taskBoxSVG').length,
	            "should have task box");
			viin_gantt.destroy()
	    });

		QUnit.test('TC02: test when click scale button', async function (assert) {
	        assert.expect(12);
            // alter planned_date_start of record 3, 4
            for(var i = 0; i< this.data.task.records.length; i++) {
                if(this.data.task.records[i].id == 3) {
                    this.data.task.records[i].planned_date_start = offsetByMonth(new Date(), -5);
                    this.data.task.records[i].planned_date_end = offsetByMonth(new Date(), -3);
                }
                if(this.data.task.records[i].id == 4) {
                    this.data.task.records[i].planned_date_start = offsetByYear(new Date(), -2);
                    this.data.task.records[i].planned_date_end = offsetByYear(new Date(), -2);
                }
            }            
	        var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
	            viewOptions: {
	               
	            },
	        });
			await timeout(1000);
            
			// Test when click scale button
			var focus_date;
			assert.ok(viin_gantt.$('.o_cp_buttons').find('.btn-group button[value=day]').length,
	            "should have day scale button");
			await testUtils.dom.click(viin_gantt.$('.o_cp_buttons').find('.btn-group button[value=day]').first());
			assert.containsN(viin_gantt, '.gdfTable:not(.ganttFixHead) .taskEditRow:not(.emptyRow)', 3,
	            "should 3 row gantt when scale is day");
			assert.ok(viin_gantt.$('.o_cp_buttons').find('.btn-group button.active[value=day]').length,
	            "when scale is day, active button is day");
			// breadcrumb must update with date
			focus_date = ' (' + current_datetime.getDate() + ' ' + current_datetime.toLocaleString('default', { month: 'short' }) +')';
			assert.strictEqual($('.focus-date-breadcrumb').text(),
            			focus_date, "should display the current date");

			await testUtils.dom.click(viin_gantt.$('.o_cp_buttons').find('.btn-group button[value=month]').first());
			assert.containsN(viin_gantt, '.gdfTable:not(.ganttFixHead) .taskEditRow:not(.emptyRow)', 6,
	            "should 6 row gantt when scale is month");
			assert.ok(viin_gantt.$('.o_cp_buttons').find('.btn-group button.active[value=month]').length,
	            "when scale is month, active button is month");
			focus_date = ' (' + current_datetime.toLocaleString('default', { month: 'long' }) + ' ' +  current_datetime.getFullYear() +')';
			assert.strictEqual($('.focus-date-breadcrumb').text(),
            			focus_date, "should display the current month");

			await testUtils.dom.click(viin_gantt.$('.o_cp_buttons').find('.btn-group button[value=year]').first());
			assert.containsN(viin_gantt, '.gdfTable:not(.ganttFixHead) .taskEditRow:not(.emptyRow)', 7,
	            "should 7 row gantt when scale is year");
			assert.ok(viin_gantt.$('.o_cp_buttons').find('.btn-group button.active[value=year]').length,
	            "when scale is year, active button is year");
			focus_date = ' (' + current_datetime.getFullYear() +')';
			assert.strictEqual($('.focus-date-breadcrumb').text(),
            			focus_date, "should display the current year");

			await testUtils.dom.click(viin_gantt.$('.o_cp_buttons').find('.btn-group button[value=all]').first());
			assert.containsN(viin_gantt, '.gdfTable:not(.ganttFixHead) .taskEditRow:not(.emptyRow)', 8,
	            "should 8 row gantt when scale is all");
			assert.strictEqual($('.focus-date-breadcrumb').text(),
            			' (All)', "should display the current year");
			viin_gantt.destroy()
	    });
		
		QUnit.test('TC03: when create task by add task button', async function(assert) {
			assert.expect(3);
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
				mockRPC: function (route, args) {
	                if (args.method === 'create') {
	                    assert.deepEqual(args.args[0], {name: 'task 4 created'}, "should create the record");
                        // Add sample record to data
                        this.data.task.records.push(
                            {id: 7, user_id: 4, manager_id: 4, name: 'task 4 created', planned_date_start: offsetByDay(new Date()), 
                            planned_date_end: offsetByDay(new Date(), 4), create_date: '2021-08-06 06:18:25', sequence: 1,
                            stage_id: 2, project_id: 2, depend_ids: []}
                        )
                        return Promise.resolve(7);
	                }
	                return this._super.apply(this, arguments);
	            },
	            viewOptions: {
	               
	            },
	        });
			
			await timeout(500);
            
			assert.ok(viin_gantt.$('.add-task-btn').length, "should display add button");
			await testUtils.dom.click(viin_gantt.$('.add-task-btn'));
			assert.ok($('.modal-body').length, "should open the form view in dialog when click on add button");
			await testUtils.fields.editInput($('.modal-body input:first'), 'task 4 created');
			await testUtils.dom.click($('.modal-footer button.btn:contains(Save & Close)'));
			await timeout(1000);
            // Remove sample data just newly added
            for(var i = 0; i< this.data.task.records.length; i++) {
                if(this.data.task.records[i].id == 7) {
                    this.data.task.records.splice(i,1);
                    break;
                }
            } 
			viin_gantt.destroy()
		});
		
		QUnit.test('TC04: create task by click empty row', async function(assert) {
			assert.expect(2);
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
				mockRPC: function (route, args) {
	                if (args.method === 'create') {
						var name = args.args[0] ? args.args[0].name : '';
                        this.data.task.records.push(
                            {id: 7, user_ids: [4], manager_id: 4, name: 'task 4 created', planned_date_start: offsetByDay(new Date()), 
                            planned_date_end: offsetByDay(new Date(), 4), create_date: '2021-08-06 06:18:25', sequence: 1, stage_id: 2, 
                            project_id: 2}
                        )
	                    assert.deepEqual(name, 'task 4 created by gantt', "should create the record: task 4 created by gantt");
                        return Promise.resolve({data: {}});
	                }
	                return this._super.apply(this, arguments);
	            },
	            viewOptions: {
	               
	            },
	        });
			await timeout(1000);	
			assert.ok(viin_gantt.$('.taskEditRow.emptyRow:first').length, "should have empty row");
			await testUtils.dom.click(viin_gantt.$('.taskEditRow.emptyRow:first'));
			await timeout(1000);
			await testUtils.fields.editInput(viin_gantt.$('.taskEditRow.rowSelected .gdfCell').find('input[name=name]'), 'task 4 created by gantt');
			await timeout(500);
			viin_gantt.$('.taskEditRow.rowSelected .gdfCell').find('input[name=name]').change();
			await timeout(3000);
            // Remove sample data just newly added
            for(var i = 0; i< this.data.task.records.length; i++) {
                if(this.data.task.records[i].id == 7) {
                    this.data.task.records.splice(i,1);
                    break;
                }
            }
			viin_gantt.destroy()
		});
		
		QUnit.test('TC05: when create task by insert bellow button', async function(assert) {
			assert.expect(1);
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
				mockRPC: function (route, args) {
	                if (args.method === 'create') {
						var name = args.args[0] ? args.args[0].name : '';
	                    assert.deepEqual(name, 'task 4 created add below', "should create the record: task 4 created add below");
                        return Promise.resolve({data: {}});
	                }
	                return this._super.apply(this, arguments);
	            },
	            viewOptions: {
	               
	            },
	        });
			await timeout(1000);
			
			// set current task
			await testUtils.dom.click(viin_gantt.$('#tid_5'));
			await testUtils.dom.click(viin_gantt.$('.requireCanAdd')[2]);
			await timeout(1000);
			await testUtils.fields.editInput(viin_gantt.$('#tid_5').next().find('input[name=name]'), 'task 4 created add below');
			await timeout(1500);
			await viin_gantt.$('#tid_5').next().find('input[name=name]').change();
			await timeout(3000);
			viin_gantt.destroy()
		});
		
		QUnit.test('TC05: when create task by insert above button', async function(assert) {
			assert.expect(1);
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
				mockRPC: function (route, args) {
	                if (args.method === 'create') {
						var name = args.args[0] ? args.args[0].name : '';
						
	                    assert.deepEqual(name, 'task 4 created add above', "should create the record: task 4 created add above");
                        return Promise.resolve({data: {}});
	                }
	                return this._super.apply(this, arguments);
	            },
	            viewOptions: {
	               
	            },
	        });
			await timeout(1000);
			
			// set current task
			await testUtils.dom.click(viin_gantt.$('#tid_6'));
			await testUtils.dom.click(viin_gantt.$('.requireCanAdd')[1]);
			await timeout(1000);
			await testUtils.fields.editInput(viin_gantt.$('#tid_6').prev().find('input[name=name]'), 'task 4 created add above');
            await timeout(1500);
			viin_gantt.$('#tid_6').prev().find('input[name=name]').change();
			await timeout(3000);
			viin_gantt.destroy()
		});

		QUnit.test('TC06: when edit task', async function(assert) {
			assert.expect(1);
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
				mockRPC: function (route, args) {
	                if (args.method == 'write_from_gantt') {
						var name = args.args[0] && args.args[0][0] ? args.args[0][0].name : '';
	                    assert.deepEqual(name, 'Decoration 2.1', "shold update record: Decoration 2.1");
                        return Promise.resolve([]);
	                }
	                return this._super.apply(this, arguments);
	            },
	            viewOptions: {
	               
	            },
	        });
			await timeout(500);			
			await testUtils.dom.click(viin_gantt.$('#tid_6'));
			await timeout(500);
			await testUtils.fields.editInput(viin_gantt.$('#tid_6').find('input[name=name]'), 'Decoration 2.1');
			viin_gantt.$('#tid_6').find('input[name=name]').change();
			await timeout(3000);
			viin_gantt.destroy()
		});
		
		QUnit.test('TC06: when edit task by form', async function(assert) {
			assert.expect(2);
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
				mockRPC: function (route, args) {
	                if (args.method == 'write') {
						var name = args.args[1] && args.args[1].name ? args.args[1].name : '';
	                    assert.deepEqual(name, 'Decoration 2.1', "should update record: Decoration 2.1");
	                }
	                return this._super.apply(this, arguments);
	            },
	            viewOptions: {
	               
	            },
	        }, {positionalClicks: true});
			await timeout(500);
			
			await testUtils.dom.triggerMouseEvent(viin_gantt.$('#tid_6'), 'dblclick');
			assert.ok($('.modal-body').length, "should open dialog form when double click to name of task: Decoration 2");
			await testUtils.fields.editInput($('.modal-body input:first'), 'Decoration 2.1');
			await testUtils.dom.click($('.modal-footer button.btn:contains(Save)'));
			await timeout(3000);
			viin_gantt.destroy()
		});
		
		QUnit.test('TC07: when open task', async function(assert) {
			assert.expect(1);
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
	            viewOptions: {
	               
	            },
	        }, {positionalClicks: true});
			await timeout(500);
			await testUtils.dom.triggerMouseEvent(viin_gantt.$('#tid_1'), 'dblclick');
			assert.ok($('.modal-body').length, "should open the form view in dialog when open a task: Room 2: Decoration1");
            // Close popup
            await testUtils.dom.triggerMouseEvent($('.modal-footer .btn-default:contains(Close)'), 'click');
			await timeout(1000);
			viin_gantt.destroy();
		});
		
		QUnit.test('TC08: when confirm delete task', async function(assert) {
			assert.expect(4);
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
				mockRPC: function (route, args) {
	                if (args.method == 'unlink') {
						var id = args.args[0];
	                    assert.deepEqual(id, 3, "Show delete task 'Decoration'");
                        return Promise.resolve();
	                }
	                return this._super.apply(this, arguments);
	            },
	            viewOptions: {
	               
	            },
	        }, {positionalClicks: true});
			await timeout(500);
			await testUtils.dom.click(viin_gantt.$('#tid_2'));
			var oldTaskRow = viin_gantt.$('#tid_2');
			var oldTaskName = oldTaskRow.find("[name=name]").val();
			assert.ok(viin_gantt.$('.delete-task-btn').length, "delete task btn should exist");
			await testUtils.dom.click(viin_gantt.$('.delete-task-btn'));
			assert.ok($('.modal-body').length, "should open the form confirm in dialog when delete a task: Decoration");
			await testUtils.dom.click($('.modal-footer button.btn:contains(Ok)'));
			await timeout(500);
			var newTaskRow = viin_gantt.$('#tid_2');
			var assertnewTaskName = newTaskRow.find("[name=name]").val();
			assert.notEqual(oldTaskName, assertnewTaskName, "task 'Decoration' should be deleted");
			viin_gantt.destroy()
		});
		
		QUnit.test('TC09: when cancel delete task', async function(assert) {
			assert.expect(3);
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
				mockRPC: function (route, args) {
	                if (args.method == 'unlink') {
						var id = args.args[0];
	                    assert.deepEqual(id, 3, "This output message means it didn't cancel deleting task: 'Decoration'");
                        return Promise.resolve();
	                }
	                return this._super.apply(this, arguments);
	            },
	            viewOptions: {
	               
	            },
	        }, {positionalClicks: true});
			await timeout(500);
			await testUtils.dom.click(viin_gantt.$('#tid_2'));
			var oldTaskRow = viin_gantt.$('#tid_2');
			var oldTaskName = oldTaskRow.find("[name=name]").val();
			assert.ok(viin_gantt.$('.delete-task-btn').length, "delete task btn should exist");
			await testUtils.dom.click(viin_gantt.$('.delete-task-btn'));
			assert.ok($('.modal-body').length, "should open the form confirm in dialog when delete a task: Decoration");
			await testUtils.dom.click($('.modal-footer button.btn:contains(Cancel)'));
			await timeout(500);
			var newTaskRow = viin_gantt.$('#tid_2');
			var assertnewTaskName = newTaskRow.find("[name=name]").val();
			assert.strictEqual(oldTaskName, assertnewTaskName, "task 'Decoration' should not be deleted");
			viin_gantt.destroy()
		});
		
		QUnit.test('TC10: when delete task by open form task', async function(assert) {
			assert.expect(4);
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
				mockRPC: function (route, args) {
	                if (args.method == 'unlink') {
						var id = args.args[0];
	                    assert.deepEqual(id, 5, "Should delete task 'Decoration'");
                        return Promise.resolve();
	                }
	                return this._super.apply(this, arguments);
	            },
	            viewOptions: {
	               
	            },
	        }, {positionalClicks: true});
			await timeout(500);
			await testUtils.dom.click(viin_gantt.$('#tid_6'));
			await testUtils.dom.triggerMouseEvent(viin_gantt.$('#tid_6').find("[name=name]"), 'dblclick');
            await timeout(1000);
			assert.ok($('.modal-body').length, "should open the form task in dialog double click task name: Decoration 4");
			await testUtils.dom.click($('.modal-footer button.btn:contains(Delete)'));
			assert.equal($('.modal-body').length, 2, 'when open popup confirm, there is only 2 dialog');
			await timeout(1000);
			await testUtils.dom.click($('.modal-body').last().parents('.o_technical_modal').find('.modal-footer button.btn:contains(Ok)'));
			assert.notOk(viin_gantt.$('#tid_6').length, "The task Decoration 4 should be delete");
			viin_gantt.destroy()
		});
				
		QUnit.test('TC11: when order by move up the task',  async function(assert) {
			assert.expect(2);
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
				mockRPC: function (route, args) {
	                if (args.method == 'write_from_gantt') {
	                    var updated_ids = args.args[0] && args.args[0][0] && args.args[0][1] ? [args.args[0][0].id, args.args[0][1].id] : []
	                    assert.deepEqual(updated_ids, [6, 5], "shold be [6, 5] update when move up the task");
                        return Promise.resolve([]);
	                }
                    if(route == '/web/dataset/resequence') {
                        return Promise.resolve({});
                    }
	                return this._super.apply(this, arguments);
	            },
	            viewOptions: {
	               
	            },
	        }, {positionalClicks: true});
			await timeout(1000);
			// set current task
			await testUtils.dom.click(viin_gantt.$('#tid_7'));
			// move up task
			assert.ok(viin_gantt.$('.moveup-task-btn').length, "move up button should exist.");
			await testUtils.dom.click(viin_gantt.$('.moveup-task-btn'));
			await timeout(1000);
			viin_gantt.destroy()
		});
		
		QUnit.test('TC11: when order move down the task',  async function(assert) {
			assert.expect(2);
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
				mockRPC: function (route, args) {
	                if (args.method == 'write_from_gantt') {
						var updated_ids = args.args[0] && args.args[0][0] && args.args[0][1] ? [args.args[0][0].id, args.args[0][1].id] : []
	                    assert.deepEqual(updated_ids, [6, 5], "shold be [6, 5] update when move down the task");
                        return Promise.resolve([]);
	                }
                    if(route == '/web/dataset/resequence') {
                        return Promise.resolve({});
                    }
	                return this._super.apply(this, arguments);
	            },
	            viewOptions: {
	               
	            },
	        }, {positionalClicks: true});
			await timeout(1000);
			// set current task
			await testUtils.dom.click(viin_gantt.$('#tid_5'));
			// move up task
			assert.ok(viin_gantt.$('.movedown-task-btn').length, "move up button should exist.");
			await testUtils.dom.click(viin_gantt.$('.movedown-task-btn'));
			await timeout(3000);
			viin_gantt.destroy()
		});
		
		QUnit.test('TC14: when filter task by assigning to current user',  async function(assert) {
			assert.expect(3);
			var archs = {
		        "task,false,form":
		            '<form>'+
						'<field name="name"/>'+
		            '</form>',
		        "task,1,form":
		            '<form>' +
		            '</form>',
				"task,false,search":
				'<search>'+
					'<filter name="my_tasks" string="My Tasks"  domain="[(\'user_id\', \'=\', '+ session.uid +')]"/>'
				+'</search>' 
				
		    };
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
	            viewOptions: {
	               
	            },
	        }, {positionalClicks: true});
			await timeout(3000);
			await testUtils.dom.click($('.btn-group.o-dropdown').first().find('.dropdown-toggle'));
			await testUtils.dom.click($('.o_filter_menu.show').find('.o_menu_item'));
			await timeout(1000);
			assert.equal($('.gdfTable:not(.ganttFixHead) .taskEditRow:not(.emptyRow)').length, 2, "should be only 2 tasks exist in gantt after filter");
			$('.gdfTable:not(.ganttFixHead) .taskEditRow:not(.emptyRow)').each(function(i, elem) {
				if(i == 0) {
					assert.equal($(elem).find("[name=name]").val(), 'Office Design', "after filter the first task should be: Office Design");
				} else if (i == 1) {
					assert.equal($(elem).find("[name=name]").val(), 'Decoration', "after filter the second task should be: Decoration");
				}
			})
			await timeout(2000);
			viin_gantt.destroy()
		});
		
		QUnit.test('T15: when group task by assignee',  async function(assert) {
			assert.expect(2);
			var archs = {
		        "task,false,form":
		            '<form>'+
						'<field name="name"/>'+
		            '</form>',
		        "task,1,form":
		            '<form>' +
		            '</form>',
				"task,false,search":
				'<search>'+
					'<filter name="my_tasks" string="My Tasks"  domain="[(\'user_id\', \'=\', '+ session.uid +')]"/>' + 
					'<group string="Group By User id">'+
                        '<filter name="user_ids" string="Assignee" context="{\'group_by\': \'user_ids\'}"/>' + 
                    '</group>'
				+'</search>' 
				
		    };
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'task',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="planned_date_start" '+
	                'date_stop="planned_date_end" progress="progress" string="Tasks" '+
	                'depends="depend_ids" manager="manager_id" members="user_ids" '+
	                'default_group_by="project_id" '+
	                'index_color_field="sequence" field_status="stage_id" '+
	                'filter_stage_condition="[\'project_id\', \'IN\', \'project_ids\']" />',
				archs: archs,
	            viewOptions: {
	               
	            },
	        }, {positionalClicks: true});
			await timeout(3000);
			await testUtils.dom.click($('.btn-group.o-dropdown').eq(1).find('.dropdown-toggle'));
			await testUtils.dom.click($('.o_group_by_menu.show .o-dropdown--menu').first().find('span.o_menu_item'));
            await timeout(2000);
			$('.gdfTable:not(.ganttFixHead) .taskEditRow:not(.emptyRow)').each(function(i, elem) {
				if(i == 0) {
					assert.equal($(elem).find("[name=name]").val(), 'user 4', "after group by the first task should be: user 4");
				} else if (i == 5) {
					assert.equal($(elem).find("[name=name]").val(), 'user 1', "after group by the 6th task should be: user 1");
				}
			});
			await timeout(2000);
			viin_gantt.destroy()
		});
		
		
		QUnit.test('gantt rendering with state', async function(assert) {
			assert.expect(7);
			var viin_gantt = await createViinGanttView({
	            View: ViinGanttView,
	            model: 'order',
	            data: this.data,
	            arch:
	            '<viin_gantt date_start="date_planned_start" ' +
					'date_stop="date_planned_finished" string="Mrp Production" status="state" ' +
					'default_group_by="product_id" default_order_by="product_id desc, id desc" />',
	            'order,false,search': '<search></search>',
				archs: archs,
	            viewOptions: {
	               
	            },
	        });
			await timeout(2000);
			assert.ok(viin_gantt.$('.o_gantt_button_dates').length,
	            "should have button date");
			assert.ok(viin_gantt.$('.o_cp_buttons').find('.btn-group').length,
	            "should have button scale");
			assert.ok(viin_gantt.$('.splitBox1').length,
	            "should have split box left to display task info");
			assert.ok(viin_gantt.$('.splitBox2').length,
	            "should have split box right to display task box");
			assert.containsN(viin_gantt, '.gdfTable:not(.ganttFixHead) .taskEditRow:not(.emptyRow)',8,
	            "should 8 row gantt");
			assert.ok(viin_gantt.$('#tasksGroup').length,
	            "should have task box group");
			assert.ok(viin_gantt.$('#tasksGroup').find('.taskBoxSVG').length,
	            "should have task box");
			viin_gantt.destroy();
		});
		
	});
})