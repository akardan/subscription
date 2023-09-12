/* Overwrite just to add self.__undoStack && self.__undoStack.length > 0 */
GanttMaster.prototype.manageSaveRequired=function(ev, showSave) {
  //console.debug("manageSaveRequired", showSave);
  var self=this;
  function checkChanges() {
    var changes = false;
    //there is somethin in the redo stack?
    if (self.__undoStack && self.__undoStack.length > 0) {
      var oldProject = JSON.parse(self.__undoStack[0]);
      //si looppano i "nuovi" task
      for (var i = 0; !changes && i < self.tasks.length; i++) {
        var newTask = self.tasks[i];
        //se è un task che c'erà già
        if (!(""+newTask.id).startsWith("tmp_")) {
          //si recupera il vecchio task
          var oldTask;
          for (var j = 0; j < oldProject.tasks.length; j++) {
            if (oldProject.tasks[j].id == newTask.id) {
              oldTask = oldProject.tasks[j];
              break;
            }
          }
          // chack only status or dateChanges
          if (oldTask && (oldTask.status != newTask.status || oldTask.start != newTask.start || oldTask.end != newTask.end)) {
            changes = true;
            break;
          }
        }
      }
    }
    $("#LOG_CHANGES_CONTAINER").css("display", changes ? "inline-block" : "none");
  }


  if (showSave) {
    $("body").stopTime("gantt.manageSaveRequired").oneTime(200, "gantt.manageSaveRequired", checkChanges);
  } else {
    $("#LOG_CHANGES_CONTAINER").hide();
  }

}

/**
* Overwrite to add status_obj
*/
GanttMaster.prototype.addBelowCurrentTask = function () {
  var self = this;
  if ((self.currentTask && self.currentTask.getParent() && !self.currentTask.getParent().canAdd) )
    return;
  var factory = new TaskFactory();
  var ch;
  var row = 0;
  if (self.currentTask && self.currentTask.name) {
    //add below add a brother if current task is not already a parent
    var addNewBrother = !(self.currentTask.isParent() || self.currentTask.level==0);

    var canAddChild=self.currentTask.canAdd;
    var canAddBrother=self.currentTask.getParent() && self.currentTask.getParent().canAdd;

    //if you cannot add a brother you will try to add a child
    addNewBrother=addNewBrother&&canAddBrother;

    if (!canAddBrother && !canAddChild)
        return;


    ch = factory.build("tmp_" + new Date().getTime(), "", "", self.currentTask.level+ (addNewBrother ?0:1), self.currentTask.start, 1);
    row = self.currentTask.getRow() + 1;
    if (row>0) {
      self.beginTransaction();
	  ch.status_obj = {};
      var task = self.addTask(ch, row);
      if (task) {
        task.rowElement.click();
        task.rowElement.find("[name=name]").focus();
      }
      self.endTransaction();
    }
  }
};

GanttMaster.prototype.addAboveCurrentTask = function () {
  var self = this;
  // console.debug("addAboveCurrentTask",self.currentTask)

  //check permissions
  if ((self.currentTask && self.currentTask.getParent() && !self.currentTask.getParent().canAdd) )
    return;

  var factory = new TaskFactory();

  var ch;
  var row = 0;
  if (self.currentTask  && self.currentTask.name) {
    //cannot add brothers to root
    if (self.currentTask.level <= 0)
      return;

    ch = factory.build("tmp_" + new Date().getTime(), "", "", self.currentTask.level, self.currentTask.start, 1);
    row = self.currentTask.getRow();

    if (row > 0) {
      self.beginTransaction();
	  ch.status_obj = {};
      var task = self.addTask(ch, row);
      if (task) {
        task.rowElement.click();
        task.rowElement.find("[name=name]").focus();
      }
      self.endTransaction();
    }
  }
};

Task.prototype.getAssigsString = function() {
	var member_limit_display = 2;
	var getImage = function(user, cls) {
        if(user.model == 'res.users')
    		return '<img data-id="'+user.id+'" src="/web/image/res.users/'+user.id+'/avatar_128" class="member' + cls
    				+ '" title=' + user.name + '/>';
        else
            return `<span class="member${cls}">${user.name}</span>`
	}
	var ret = "";
	if(this.managers) {
		for (var i = 0; i < this.managers.length; i++) {
			ret += getImage(this.managers[i], ' manager');
		}
	}
	if(this.assigs) {
		var member_count = 0;
        var multi_user = '';
		for (var i = 0; i < this.assigs.length; i++) {
			var ass = this.assigs[i];
			if(this.managers) {
				for (var j = 0; j < this.managers.length; j++) {
					var ass2 = this.managers[j];
					if (ass.id == ass2.id) {
						break;
					}
				}
			}
			if(member_count < member_limit_display) {
                ret += getImage(ass, '');
			}
			member_count+=1;
            if(member_count > member_limit_display) {
                multi_user += ass.id + ',';
            }
		}
		if(member_count > member_limit_display) {
			ret += '<a class="member-more-btn rounded-circle" href="#" user_ids="'+ multi_user
                   +'" data-toggle="tooltip" data-html="true" title="Waiting...">'+'+'+(member_count - member_limit_display)+'</a>';
		}
	}
	return ret;
};

function reloadGridState() {
	var gantt_workspace_width = $('#TWGanttArea').width();
	var header_width = 0;
    var min_col_width = 75;
    var assignee_width = 120;
	$('.gdfWrapper .gdfTable.ganttFixHead .gdfColHeader').each(function(i, elem) {
		if( i == $('.gdfWrapper .gdfTable.ganttFixHead .gdfColHeader').length - 1) {
			// Last will take the rest of the width
			$(elem).width(gantt_workspace_width - header_width);
		} else if(i == 11) {
            // Assignee column
            $(elem).width(assignee_width);
            header_width += $(elem).width();
        } else {
			// the numerical order must have width >= 51
			var elem_width = $(elem).width();
            if (elem_width > 150 && i>3) {
                $(elem).width(150)
            }
			if(i == 0 && elem_width < 41) {
				$(elem).width(41)
			}
            if (i > 1 && elem_width < min_col_width) {
                $(elem).width(min_col_width)
            }
			header_width += $(elem).width();
		}
		
	});
	header_width = 0;
	$('.gdfWrapper .gdfTable:not(.ganttFixHead) .gdfColHeader').each(function(i, elem) {
		if( i == $('.gdfWrapper .gdfTable.ganttFixHead .gdfColHeader').length - 1) {
			// Last will take the rest of the width
			$(elem).width(gantt_workspace_width - header_width);
		} else if(i == 11) {
            // Assignee column
            $(elem).width(assignee_width);
            header_width += $(elem).width();
        } else {
			// the numerical order must have width >= 51
			var elem_width = $(elem).width();
            if (elem_width > 150 && i>3) {
                $(elem).width(150)
            }
			if(i == 0 && elem_width < 41) {
				$(elem).width(41)
			}
            if (i > 1 && elem_width < 75) {
                $(elem).width(min_col_width)
            }
			header_width += $(elem).width();
		}
	});
    
}


function rgbContrast(rgb) {
  var ret={r:0,g:0,b:0};
  if(!rgb) {
      ret={r:255,g:255,b:255};
  }
  var tot = (rgb.r + rgb.g + rgb.b) / 3;
  if (tot < 170)
    ret={r:255,g:255,b:255};
  return ret;
}


function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function getRGB(str){
  var match = str.match(/rgba?\((\d{1,3}), ?(\d{1,3}), ?(\d{1,3})\)?(?:, ?(\d(?:\.\d?))\))?/);
  return match ? {
    r: parseInt(match[1]),
    g: parseInt(match[2]),
    b: parseInt(match[3])
  } : {};
}

jQuery.fn.extend({
	position: function() {
		if ( !this[ 0 ] ) {
			return;
		}
		var offsetParent, offset,
			elem = this[ 0 ],
			parentOffset = { top: 0, left: 0 };

			// Fixed elements are offset from window (parentOffset = {top:0, left: 0},
			// because it is its only offset parent
			if ( jQuery.css( elem, "position" ) === "fixed" ) {
	
				// Assume getBoundingClientRect is there when computed position is fixed
				offset = elem.getBoundingClientRect();
	
			} else {
	
				// Get *real* offsetParent
				offsetParent = this.offsetParent();
	
				// Get correct offsets
				offset = this.offset();
				if ( !jQuery.nodeName( offsetParent[ 0 ], "html" ) ) {
					parentOffset = offsetParent.offset();
				}
	
				// Add offsetParent borders
				parentOffset = {
					top: parentOffset.top + jQuery.css( offsetParent[ 0 ], "borderTopWidth", true ),
					left: parentOffset.left + jQuery.css( offsetParent[ 0 ], "borderLeftWidth", true )
				};
			}
	
			// Subtract parent offsets and element margins
			return {
				top: offset.top - parentOffset.top - jQuery.css( elem, "marginTop", true ),
				left: offset.left - parentOffset.left - jQuery.css( elem, "marginLeft", true )
			};
	
		
	},
});

/**
* @override
*/
Date.prototype.incrementDateByWorkingDays=function (days) {
  //console.debug("incrementDateByWorkingDays start ",d,days)
  var q = Math.abs(days);
  while (q > 0) {
    this.setDate(this.getDate() + (days > 0 ? 1 : -1));
    q--;
  }
  return this;
};

Ganttalendar.prototype.createGanttGrid = function () {
  //console.debug("Gantt.createGanttGrid zoom: "+this.zoom +"  " + new Date(this.originalStartMillis).format() + " - " + new Date(this.originalEndMillis).format());
  //var prof = new Profiler("ganttDrawer.createGanttGrid");
  var self = this;

  // get the zoomDrawer
  // if the desired level is not there uses the largest one (last one)
  var zoomDrawer=self.zoomDrawers[self.zoom] || self.zoomDrawers[self.zoomLevels[self.zoomLevels.length-1]];

  //get best dimension for gantt
  var adjustedStartDate= new Date(this.originalStartMillis);
  var adjustedEndDate=new Date(this.originalEndMillis);
  zoomDrawer.adjustDates(adjustedStartDate,adjustedEndDate);

  self.startMillis = adjustedStartDate.getTime(); //real dimension of gantt
  self.endMillis = adjustedEndDate.getTime();

    //this is computed by hand in order to optimize cell size
  var computedTableWidth= (self.endMillis - self.startMillis) * zoomDrawer.computedScaleX;
  // Make compute table width is full in gantt area
  var gantt_area_width = $('#TWGanttArea').width();
  if(computedTableWidth < gantt_area_width ) {
		self.endMillis = Math.floor((gantt_area_width/zoomDrawer.computedScaleX) + self.startMillis);
		computedTableWidth = (self.endMillis - self.startMillis) * zoomDrawer.computedScaleX;
  }
  //set a minimal width
  computedTableWidth = Math.max(computedTableWidth, self.minGanttSize);

    var table = $("<table cellspacing=0 cellpadding=0>");

  //loop for header1
  var start = new Date(self.startMillis);
  var tr1 = $("<tr>").addClass("ganttHead1");
  while (start.getTime() <= self.endMillis) {
    zoomDrawer.row1(start,tr1);
  }

    //loop for header2  e tbody
  start = new Date(self.startMillis);
    var tr2 = $("<tr>").addClass("ganttHead2");
    var trBody = $("<tr>").addClass("ganttBody");
  while (start.getTime() <= self.endMillis) {
    zoomDrawer.row2(start,tr2,trBody);
  }

  table.append(tr1).append(tr2);   // removed as on FF there are rounding issues  //.css({width:computedTableWidth});

  var head = table.clone().addClass("ganttFixHead");

  table.append(trBody).addClass("ganttTable");


  var height = self.master.editor.element.height();
  table.height(height);
  
  var box = $("<div>");
  box.addClass("gantt unselectable").attr("unselectable", "true").css({position:"relative", width:computedTableWidth});
  box.append(table);
  box.append(head);

  //create the svg
  box.svg({settings:{class:"ganttSVGBox"},
      onLoad:         function (svg) {
        //console.debug("svg loaded", svg);

        //creates gradient and definitions
        var defs = svg.defs('myDefs');

        //create backgound
        var extDep = svg.pattern(defs, "extDep", 0, 0, 10, 10, 0, 0, 10, 10, {patternUnits:'userSpaceOnUse'});
        var img=svg.image(extDep, 0, 0, 10, 10, self.master.resourceUrl +"hasExternalDeps.png",{opacity:.3});

        self.svg = svg;
        $(svg).addClass("ganttSVGBox");

        //creates grid group
        var gridGroup = svg.group("gridGroup");

        //creates links group
        self.linksGroup = svg.group("linksGroup");

        //creates tasks group
        self.tasksGroup = svg.group("tasksGroup");

        //compute scalefactor fx
        //self.fx = computedTableWidth / (endPeriod - startPeriod);
        self.fx = zoomDrawer.computedScaleX;

      }
  });

  return box;
};

GanttMaster.prototype.endTransaction = function () {
  if (!this.__currentTransaction) {
    console.error("Transaction never started.");
    return true;
  }

  var ret = true;

  //no error -> commit
  if (this.__currentTransaction.errors.length <= 0) {
    //console.debug("committing transaction");

    //put snapshot in undo
    this.__undoStack.push(this.__currentTransaction.snapshot);
    //clear redo stack
    this.__redoStack = [];

    //shrink gantt bundaries
    this.gantt.shrinkBoundaries();
    this.taskIsChanged(); //enqueue for gantt refresh


    //error -> rollback
  } else {
    ret = false;
    //console.debug("rolling-back transaction");

    //compose error message
    var msg = "ERROR:\n";
    for (var i = 0; i < this.__currentTransaction.errors.length; i++) {
      var err = this.__currentTransaction.errors[i];
      msg = msg + err.msg + "\n\n";
    }
    this.odoo_dialog.alert(null, msg);


    //try to restore changed tasks
    var oldTasks = JSON.parse(this.__currentTransaction.snapshot);
    this.deletedTaskIds = oldTasks.deletedTaskIds;
    this.__inUndoRedo = true; // avoid Undo/Redo stacks reset
    this.loadTasks(oldTasks.tasks, oldTasks.selectedRow);
    this.redraw();

  }
  //reset transaction
  this.__currentTransaction = undefined;

  //show/hide save button
  this.saveRequired();

  //[expand]
  this.editor.refreshExpandStatus(this.currentTask);

  return ret;
};

Task.prototype.clone = function () {
  var ret = {};
  for (var key in this) {
    if (typeof(this[key]) != "function")
      if (typeof(this[key]) != "object" || Array.isArray(this[key]) || ['status_obj', 'data'].indexOf(key) >= 0)
      ret[key] = this[key];
    }
  return ret;
};

GanttMaster.prototype.changeMultipleTask = function(tasksData) {
	this.beginTransaction();
	var updatedSuccess = false;
	for (var i = 0; i < tasksData.length; i++) {
		var taskData = tasksData[i];
		var task = taskData.task;
		if(task && taskData.start && taskData.end) {
			task.setPeriod(taskData.start, taskData.end);
		}
	}
	updatedSuccess = this.__currentTransaction.errors.length <= 0 ? true : false;
	this.endTransaction();
	
	if(!updatedSuccess) return;
	// Update status
	for (var i = 0; i < tasksData.length; i++) {
		var taskData = tasksData[i];
		var task = taskData.task;
		if (task && task.status_obj && task.rowElement) {
			var color = task.status_obj.color;
			task.rowElement.find('.cvcColorSquare').css({ 'background-color': color });
			task.rowElement.find('.cvcColorSquare').attr('title', task.status_obj.name);
			task.rowElement.find('.cvcColorSquare').attr('status_id', task.status_obj.id);
		}
		// Color for task with no start time
		if (task && task.hidden_visibility) {
			task.rowElement.find('.cvcColorSquare').css({ 'background-color': '#dededf' });
		}
	}
}

function translateGanttDateHeadText(currentLang) {
	setTimeout(function() {
		translateDateFunc(currentLang);
	}, 1500);
}

GanttMaster.prototype.expandAll = function() {
    for(var i = 0; i < this.tasks.length; i++) {
        var task = this.tasks[i];
        if(task.hasChild && !task.getParent()) {
            task.collapsed = false;
            var desc = task.getDescendant();
            for (var j=0; j<desc.length; j++) {
                desc[j].collapsed = false;
                desc[j].rowElement.show();
            }
        }
    }
    this.redraw();

    //store collapse statuses
    this.storeCollapsedTasks();
}

GanttMaster.prototype.collapseAll = function () {
    //console.debug("collapseAll");
    for(var i = 0; i < this.tasks.length; i++) {
        var task = this.tasks[i];
        if(task.hasChild && !task.getParent()) {
            var desc = task.getDescendant();
            for (var j=0; j<desc.length; j++) {
                if (desc[j].isParent()) {
                    desc[j].collapsed = true;
                }
                desc[j].rowElement.hide();
            }
        }
    }
    this.redraw();

    //store collapse statuses
    this.storeCollapsedTasks();
};

function translateDateFunc(currentLang) {
	$('.splitBox2 .ganttTable .ganttHead1 th > span').each(function(i, elem) {
		var str = $(elem).text();
		var translatedStr = translateDateText(str, currentLang);
		$(elem).text(translatedStr);
	});
	$('.splitBox2 .ganttTable .ganttHead2 th > span').each(function(i, elem) {
		var str = $(elem).text();
		if(str == 'T' && (i + 1) % 7 == 5 ) {
			str = 'T1';
		} else if(str.search( /T | t /g) == 0 && (i + 1) % 7 == 5) {
			str = str.replace(/T | t /g, 'T1 '); // Thursday vs Tuesday
		} else if(str == 'S' && (i + 1) % 7 == 0) {
			str = 'S1';
		} else if((str.search( /S | s /g) == 0) && (i + 1) % 7 == 0) {
			str = str = str.replace(/S | s /g, 'S1 '); // Sunday vs Saturday
		}
		var translatedStr = translateDateText(str, currentLang);
		$(elem).text(translatedStr);
	});
	$('.splitBox2 .ganttFixHead .ganttHead1 th > span').each(function(i, elem) {
		var str = $(elem).text();
		var translatedStr = translateDateText(str, currentLang);
		$(elem).text(translatedStr);
	});
	$('.splitBox2 .ganttFixHead .ganttHead2 th > span').each(function(i, elem) {
		var str = $(elem).text();
		if(str == 'T' && (i + 1) % 7 == 5 ) {
			str = 'T1';
		} else if(str.search( /T | t /g) == 0 && (i + 1) % 7 == 5) {
			str = str.replace(/T | t /g, 'T1 '); // Thursday vs Tuesday
		} else if(str == 'S' && (i + 1) % 7 == 0) {
			str = str = 'S1';
		} else if((str.search( /S | s /g) == 0) && (i + 1) % 7 == 0) {
			str = str = str.replace(/S | s /g, 'S1 '); // Sunday vs Saturday
		}
		var translatedStr = translateDateText(str, currentLang);
		$(elem).text(translatedStr);
	});
};

function getTaskStatusStyle(task) {
	var color;
	var name;
	if(task && task.status_obj) {
		color = task.status_obj.color;
		name = task.status_obj.name;
	}
	// Color for task with no start time
	if(task && task.hidden_visibility) {
		color = '#dededf';
	}
	return {
		color: color,
		name: name,
	}
}
