GridEditor.prototype.refreshTaskRow = function(task) {
    var canWrite = this.master.permissions.canWrite || task.canWrite;

    var row = task.rowElement;

    row.find(".taskRowIndex").html(task.getRow() + 1);
    row.find(".indentCell").css("padding-left", task.level * 10 + 18);
    row.find("[name=name]").val(task.name);
    row.find("[name=code]").val(task.code);
    row.find("[status]").attr("status", task.status);
    if (this.master.gantt.zoom == '1d') {

    }
    row.find("[name=duration]").val(durationToString(task.duration)).prop("readonly", !canWrite || task.isParent() && task.master.shrinkParent);
    row.find("[name=progress]").val(task.progress).prop("readonly", !canWrite || task.progressByWorklog == true);
    row.find("[name=startIsMilestone]").prop("checked", task.startIsMilestone);
    row.find("[name=start]").val(new Date(task.start).format('M/d/yyyy H:m:s')).updateOldValue().prop("readonly", !canWrite || task.depends || !(task.canWrite || this.master.permissions.canWrite)); // called on dates only because for other field is called on focus event
    row.find("[name=endIsMilestone]").prop("checked", task.endIsMilestone);
    row.find("[name=end]").val(new Date(task.end).format('M/d/yyyy H:m:s')).prop("readonly", !canWrite || task.isParent() && task.master.shrinkParent).updateOldValue();
    row.find("[name=depends]").val(task.depends);
    row.find(".taskAssigs").html(task.getAssigsString());

    //manage collapsed
    if (task.collapsed)
        row.addClass("collapsed");
    else
        row.removeClass("collapsed");


    //Enhancing the function to perform own operations
    this.master.element.trigger('gantt.task.afterupdate.event', task);
    //profiler.stop();
};


GridEditor.prototype.bindRowInputEvents = function(task, taskRow) {
    var self = this;

    //bind dateField on dates
    taskRow.find(".date").each(function() {
        var el = $(this);
        el.click(function() {
            var inp = $(this);
            inp.dateField({
                inputField: el,
                minDate: self.minAllowedDate,
                maxDate: self.maxAllowedDate,
                callback: function(d) {
                    $(this).blur();
                }
            });
        });

        el.blur(function(date) {
            var inp = $(this);
            if (inp.isValueChanged()) {
                if (!Date.isValid(inp.val())) {
                    alert(GanttMaster.messages["INVALID_DATE_FORMAT"]);
                    inp.val(inp.getOldValue());

                } else {
                    var row = inp.closest("tr");
                    var taskId = row.attr("taskId");
                    var task = self.master.getTask(taskId);

                    var leavingField = inp.prop("name");
                    var dates = resynchDates(inp, row.find("[name=start]"), row.find("[name=startIsMilestone]"), row.find("[name=duration]"), row.find("[name=end]"), row.find("[name=endIsMilestone]"), this.master.gantt.zoom);
                    //console.debug("resynchDates",new Date(dates.start), new Date(dates.end),dates.duration)
                    //update task from editor
                    self.master.beginTransaction();
                    self.master.changeTaskDates(task, dates.start, dates.end);
                    self.master.endTransaction();
                    inp.updateOldValue(); //in order to avoid multiple call if nothing changed
                }
            }
        });
    });


    //milestones checkbox
    taskRow.find(":checkbox").click(function() {
        var el = $(this);
        var row = el.closest("tr");
        var taskId = row.attr("taskId");

        var task = self.master.getTask(taskId);

        //update task from editor
        var field = el.prop("name");

        if (field == "startIsMilestone" || field == "endIsMilestone") {
            self.master.beginTransaction();
            //milestones
            task[field] = el.prop("checked");
            resynchDates(el, row.find("[name=start]"), row.find("[name=startIsMilestone]"), row.find("[name=duration]"), row.find("[name=end]"), row.find("[name=endIsMilestone]"));
            self.master.endTransaction();
        }

    });


    //binding on blur for task update (date exluded as click on calendar blur and then focus, so will always return false, its called refreshing the task row)
    taskRow.find("input:text:not(.date)").focus(function() {
        $(this).updateOldValue();

    }).blur(function(event) {
        var el = $(this);
        var row = el.closest("tr");
        var taskId = row.attr("taskId");
        var task = self.master.getTask(taskId);
        //update task from editor
        var field = el.prop("name");

        if (el.isValueChanged()) {
            self.master.beginTransaction();

            if (field == "depends") {
                var oldDeps = task.depends;
                task.depends = el.val();

                // update links
                var linkOK = self.master.updateLinks(task);
                if (linkOK) {
                    //synchronize status from superiors states
                    var sups = task.getSuperiors();

                    var oneFailed = false;
                    var oneUndefined = false;
                    var oneActive = false;
                    var oneSuspended = false;
                    var oneWaiting = false;
                    for (var i = 0; i < sups.length; i++) {
                        oneFailed = oneFailed || sups[i].from.status == "STATUS_FAILED";
                        oneUndefined = oneUndefined || sups[i].from.status == "STATUS_UNDEFINED";
                        oneActive = oneActive || sups[i].from.status == "STATUS_ACTIVE";
                        oneSuspended = oneSuspended || sups[i].from.status == "STATUS_SUSPENDED";
                        oneWaiting = oneWaiting || sups[i].from.status == "STATUS_WAITING";
                    }

                    if (oneFailed) {
                        task.changeStatus("STATUS_FAILED")
                    } else if (oneUndefined) {
                        task.changeStatus("STATUS_UNDEFINED")
                    } else if (oneActive) {
                        //task.changeStatus("STATUS_SUSPENDED")
                        task.changeStatus("STATUS_WAITING")
                    } else if (oneSuspended) {
                        task.changeStatus("STATUS_SUSPENDED")
                    } else if (oneWaiting) {
                        task.changeStatus("STATUS_WAITING")
                    } else {
                        task.changeStatus("STATUS_ACTIVE")
                    }

                    self.master.changeTaskDeps(task); //dates recomputation from dependencies
                }

            } else if (field == "duration") {
                var dates = resynchDates(el, row.find("[name=start]"), row.find("[name=startIsMilestone]"), row.find("[name=duration]"), row.find("[name=end]"), row.find("[name=endIsMilestone]"));
                self.master.changeTaskDates(task, dates.start, dates.end);

            } else if (field == "name" && el.val() == "") { // remove unfilled task
                self.master.deleteCurrentTask(taskId);


            } else if (field == "progress") {
                task[field] = parseFloat(el.val()) || 0;
                el.val(task[field]);

            } else {
                task[field] = el.val();
            }
            self.master.endTransaction();

        } else if (field == "name" && el.val() == "") { // remove unfilled task even if not changed
            if (task.getRow() != 0) {
                self.master.deleteCurrentTask(taskId);

            } else {
                el.oneTime(1, "foc", function() { $(this).focus() }); //
                event.preventDefault();
                //return false;
            }

        }
    });

    //cursor key movement
    taskRow.find("input").keydown(function(event) {
        var theCell = $(this);
        var theTd = theCell.parent();
        var theRow = theTd.parent();
        var col = theTd.prevAll("td").length;

        var ret = true;
        if (!event.ctrlKey) {
            switch (event.keyCode) {
                case 13:
                    if (theCell.is(":text"))
                        theCell.blur();
                    break;

                case 37: //left arrow
                    if (!theCell.is(":text") || (!this.selectionEnd || this.selectionEnd == 0))
                        theTd.prev().find("input").focus();
                    break;
                case 39: //right arrow
                    if (!theCell.is(":text") || (!this.selectionEnd || this.selectionEnd == this.value.length))
                        theTd.next().find("input").focus();
                    break;

                case 38: //up arrow
                    //var prevRow = theRow.prev();
                    var prevRow = theRow.prevAll(":visible:first");
                    var td = prevRow.find("td").eq(col);
                    var inp = td.find("input");

                    if (inp.length > 0)
                        inp.focus();
                    break;
                case 40: //down arrow
                    //var nextRow = theRow.next();
                    var nextRow = theRow.nextAll(":visible:first");
                    var td = nextRow.find("td").eq(col);
                    var inp = td.find("input");
                    if (inp.length > 0)
                        inp.focus();
                    else
                        nextRow.click(); //create a new row
                    break;
                case 36: //home
                    break;
                case 35: //end
                    break;

                case 9: //tab
                case 13: //enter
                    break;
            }
        }
        return ret;

    }).focus(function() {
        $(this).closest("tr").click();
    });


    //change status
    taskRow.find(".taskStatus").click(function() {
        var el = $(this);
        var tr = el.closest("[taskid]");
        var taskId = tr.attr("taskid");
        var task = self.master.getTask(taskId);

        var changer = $.JST.createFromTemplate({}, "CHANGE_STATUS");
        changer.find("[status=" + task.status + "]").addClass("selected");
        changer.find(".taskStatus").click(function(e) {
            e.stopPropagation();
            var newStatus = $(this).attr("status");
            changer.remove();
            self.master.beginTransaction();
            task.changeStatus(newStatus);
            self.master.endTransaction();
            el.attr("status", task.status);
        });
        el.oneTime(3000, "hideChanger", function() {
            changer.remove();
        });
        el.after(changer);
    });

};
