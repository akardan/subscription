/**
 * @override
 * Add class for visibility hidden when task has no start date
 */
Ganttalendar.prototype.drawTask = function(task) {
    var self = this;
    var hour_zoom = false;
    if(this.master.gantt.zoom == '1d') {
        task.duration = Math.ceil((task.end - task.start)/3600000);
        hour_zoom = true;
    }

    if (self.master.showBaselines) {
        var baseline = self.master.baselines[task.id];
        if (baseline) {
            //console.debug("baseLine",baseline)
            var baseTask = $(_createBaselineSVG(task, baseline));
            baseTask.css("opacity", .5);
            task.ganttBaselineElement = baseTask;
        }
    }
    var taskBox = $(_createTaskSVG(task, hour_zoom));
    task.ganttElement = taskBox;


    if (self.showCriticalPath && task.isCritical)
        taskBox.addClass("critical");

    if (this.master.permissions.canWrite || task.canWrite) {
        //bind all events on taskBox
        taskBox
            .click(function(e) { // manages selection
                e.stopPropagation(); // to avoid body remove focused
                self.element.find("[class*=focused]").removeClass("focused");
                $(".ganttSVGBox .focused").removeClass("focused");
                var el = $(this);
                if (!self.resDrop)
                    el.addClass("focused");
                self.resDrop = false; //hack to avoid select

                $("body").off("click.focused").one("click.focused", function() {
                    $(".ganttSVGBox .focused").removeClass("focused");
                })

            }).dblclick(function() {
                if (self.master.permissions.canSeePopEdit)
                    self.master.editor.openFullEditor(task, false);
            }).mouseenter(function() {
                //bring to top
                var el = $(this);
                if (!self.linkOnProgress) {
                    $("[class*=linkHandleSVG]").hide();
                    el.find("[class*=linkHandleSVG]").stopTime("hideLink").show();
                } else {
                    el.addClass("linkOver");
                }
            }).mouseleave(function() {
                var el = $(this);
                el.removeClass("linkOver").find("[class*=linkHandleSVG]").oneTime(500, "hideLink", function() { $(this).hide() });

            }).mouseup(function(e) {
                $(":focus").blur(); // in order to save grid field when moving task
            }).mousedown(function() {
                var task = self.master.getTask($(this).attr("taskid"));
                task.rowElement.click();
            }).dragExtedSVG($(self.svg.root()), {
                canResize: task.hidden_visibility ? false : this.master.permissions.canWrite || task.canWrite,
                canDrag: task.hidden_visibility ? false : (this.master.permissions.canWrite || task.canWrite),
                resizeZoneWidth: self.resizeZoneWidth,
                startDrag: function(e) {
                    $(".ganttSVGBox .focused").removeClass("focused");
                },
                drag: function(e) {
                    $("[from=" + task.id + "],[to=" + task.id + "]").trigger("update");
                },
                drop: function(e) {
                    self.resDrop = true; //hack to avoid select
                    var taskbox = $(this);
                    var task = self.master.getTask(taskbox.attr("taskid"));
                    var s = Math.round((parseFloat(taskbox.attr("x")) / self.fx) + self.startMillis);
                    self.master.beginTransaction();
                    self.master.moveTask(task, new Date(s));
                    self.master.endTransaction();
                },
                startResize: function(e) {
                    $(".ganttSVGBox .focused").removeClass("focused");
                    var taskbox = $(this);
                    var text = $(self.svg.text(parseInt(taskbox.attr("x")) + parseInt(taskbox.attr("width") + 8), parseInt(taskbox.attr("y")), "", { "font-size": "10px", "fill": "red" }));
                    taskBox.data("textDur", text);
                },
                resize: function(e) {
                    //find and update links from, to
                    var taskbox = $(this);
                    var st = Math.round((parseFloat(taskbox.attr("x")) / self.fx) + self.startMillis);
                    var en = Math.round(((parseFloat(taskbox.attr("x")) + parseFloat(taskbox.attr("width"))) / self.fx) + self.startMillis);
                    var zoom = task.master.gantt.zoom;
                    var d = getDurationInUnits(computeStartDate(st, zoom), computeEndDate(en, zoom), zoom);
                    var text = taskBox.data("textDur");
                    text.attr("x", parseInt(taskbox.attr("x")) + parseInt(taskbox.attr("width")) + 8).html(durationToString(d));

                    $("[from=" + task.id + "],[to=" + task.id + "]").trigger("update");
                },
                stopResize: function(e) {
                    self.resDrop = true; //hack to avoid select
                    var textBox = taskBox.data("textDur");
                    if (textBox)
                        textBox.remove();
                    var taskbox = $(this);
                    var task = self.master.getTask(taskbox.attr("taskid"));
                    var st = Math.round((parseFloat(taskbox.attr("x")) / self.fx) + self.startMillis);
                    var en = Math.round(((parseFloat(taskbox.attr("x")) + parseFloat(taskbox.attr("width"))) / self.fx) + self.startMillis);

                    //in order to avoid rounding issue if the movement is less than 1px we keep the same start and end dates
                    if (Math.abs(st - task.start) < 1 / self.fx) {
                        st = task.start;
                    }
                    if (Math.abs(en - task.end) < 1 / self.fx) {
                        en = task.end;
                    }

                    self.master.beginTransaction();
                    self.master.changeTaskDates(task, new Date(st), new Date(en));
                    self.master.endTransaction();
                }
            });
        taskBox.css({ fill: (task.status_obj && task.status_obj.color) || "#eee" })
        if (task && task.hidden_visibility) {
            taskBox.css({ fill: '#dededf' });
        }
        //binding for creating link
        taskBox.find("[class*=linkHandleSVG]").mousedown(function(e) {
            e.preventDefault();
            e.stopPropagation();
            var taskBox = $(this).closest(".taskBoxSVG");
            var svg = $(self.svg.root());
            var offs = svg.offset();
            self.linkOnProgress = true;
            self.linkFromEnd = $(this).is(".taskLinkEndSVG");
            svg.addClass("linkOnProgress");

            // create the line
            var startX = parseFloat(taskBox.attr("x")) + (self.linkFromEnd ? parseFloat(taskBox.attr("width")) : 0);
            var startY = parseFloat(taskBox.attr("y")) + parseFloat(taskBox.attr("height")) / 2;
            var line = self.svg.line(startX, startY, e.pageX - offs.left - 5, e.pageY - offs.top - 5, { class: "linkLineSVG" });
            var circle = self.svg.circle(startX, startY, 5, { class: "linkLineSVG" });

            //bind mousemove to draw a line
            svg.bind("mousemove.linkSVG", function(e) {
                var offs = svg.offset();
                var nx = e.pageX - offs.left;
                var ny = e.pageY - offs.top;
                var c = Math.sqrt(Math.pow(nx - startX, 2) + Math.pow(ny - startY, 2));
                nx = nx - (nx - startX) * 10 / c;
                ny = ny - (ny - startY) * 10 / c;
                self.svg.change(line, { x2: nx, y2: ny });
                self.svg.change(circle, { cx: nx, cy: ny });
            });

            //bind mouseup un body to stop
            $("body").one("mouseup.linkSVG", function(e) {
                $(line).remove();
                $(circle).remove();
                self.linkOnProgress = false;
                svg.removeClass("linkOnProgress");

                $(self.svg.root()).unbind("mousemove.linkSVG");
                var targetBox = $(e.target).closest(".taskBoxSVG");
                //console.debug("create link from " + taskBox.attr("taskid") + " to " + targetBox.attr("taskid"));

                if (targetBox && targetBox.attr("taskid") != taskBox.attr("taskid")) {
                    var taskTo;
                    var taskFrom;
                    if (self.linkFromEnd) {
                        taskTo = self.master.getTask(targetBox.attr("taskid"));
                        taskFrom = self.master.getTask(taskBox.attr("taskid"));
                    } else {
                        taskFrom = self.master.getTask(targetBox.attr("taskid"));
                        taskTo = self.master.getTask(taskBox.attr("taskid"));
                    }

                    if (taskTo && taskFrom) {
                        var gap = 0;
                        var depInp = taskTo.rowElement.find("[name=depends]");
                        depInp.val(depInp.val() + ((depInp.val() + "").length > 0 ? "," : "") + (taskFrom.getRow() + 1) + (gap != 0 ? ":" + gap : ""));
                        depInp.blur();
                    }
                }
            })
        });
        if(_.isEmpty(task.name) && task.id.match(/tmp_fk/i)) {
            taskBox.off();
        }
    }
    //ask for redraw link
    self.redrawLinks();

    //prof.stop();


    function _createTaskSVG(task, hour_zoom = false) {
        var svg = self.svg;
        var dimensions = {
            x: Math.round((task.start - self.startMillis) * self.fx),
            y: task.rowElement.position().top + task.rowElement.offsetParent().scrollTop() + self.taskVertOffset,
            width: !task.hidden_visibility ? Math.max(Math.round((task.end - task.start) * self.fx), 1) : 1,
            height: (self.master.showBaselines ? self.taskHeight / 1.3 : self.taskHeight)
        };
        if (hour_zoom) {
            // This fix for resolution of screen (when set with is 780, it is actualy 779,64px, it is 0.4px in shortage)
            var margin_left = -1 * (Math.floor((task.start - self.startMillis)/ 86400000)*0.4);
            dimensions.x += margin_left;
        }
        var taskSvg = svg.svg(self.tasksGroup, dimensions.x, dimensions.y, dimensions.width, dimensions.height, { class: "taskBox taskBoxSVG taskStatusSVG ", status: task.status, taskid: task.id, fill: task.color || "#eee" });
        //svg.title(taskSvg, task.name);
        //external box
        var layout = svg.rect(taskSvg, 0, 0, "100%", "100%", { class: "taskLayout", rx: "2", ry: "2" });
        
        //external dep
        if (task.hasExternalDep)
            svg.rect(taskSvg, 0, 0, "100%", "100%", { fill: "url(#extDep)" });

        //progress
        if (task.progress > 0) {
            var progress = svg.rect(taskSvg, 0, "20%", (task.progress > 100 ? 100 : task.progress) + "%", "60%", { rx: "2", ry: "2", fill: "rgba(0,0,0,.4)" });
            if (dimensions.width > 50) {
                var textStyle = { fill: "#888", "font-size": "10px", class: "textPerc teamworkIcons", transform: "translate(5)" };
                if (task.progress > 100)
                    textStyle["font-weight"] = "bold";
                if (task.progress > 90)
                    textStyle.transform = "translate(-40)";
                svg.text(taskSvg, (task.progress > 90 ? 100 : task.progress) + "%", (self.master.rowHeight - 5) / 2, (task.progress > 100 ? "!!! " : "") + task.progress + "%", textStyle);
            }
        }

        if (task.isParent())
            svg.rect(taskSvg, 0, 0, "100%", 3, { fill: "#000" });

        if (task.startIsMilestone) {
            svg.image(taskSvg, -9, dimensions.height / 2 - 9, 18, 18, self.master.resourceUrl + "milestone.png")
        }

        if (task.endIsMilestone) {
            svg.image(taskSvg, "100%", dimensions.height / 2 - 9, 18, 18, self.master.resourceUrl + "milestone.png", { transform: "translate(-9)" })
        }

        //task label
        svg.text(taskSvg, "100%", 18, task.name, { class: "taskLabelSVG", transform: "translate(20,-5)" });

        //link tool
        if (task.level > 0) {
            svg.circle(taskSvg, -self.resizeZoneWidth, dimensions.height / 2, dimensions.height / 3, { class: "taskLinkStartSVG linkHandleSVG", transform: "translate(" + (-dimensions.height / 3 + 1) + ")" });
            svg.circle(taskSvg, dimensions.width + self.resizeZoneWidth, dimensions.height / 2, dimensions.height / 3, { class: "taskLinkEndSVG linkHandleSVG", transform: "translate(" + (dimensions.height / 3 - 1) + ")" });
        }
        return taskSvg
    }


    function _createBaselineSVG(task, baseline) {
        var svg = self.svg;

        var dimensions = {
            x: Math.round((baseline.startDate - self.startMillis) * self.fx),
            y: task.rowElement.position().top + task.rowElement.offsetParent().scrollTop() + self.taskVertOffset + self.taskHeight / 2,
            width: Math.max(Math.round((baseline.endDate - baseline.startDate) * self.fx), 1),
            height: (self.master.showBaselines ? self.taskHeight / 1.5 : self.taskHeight)
        };
        var taskSvg = svg.svg(self.tasksGroup, dimensions.x, dimensions.y, dimensions.width, dimensions.height, { class: "taskBox taskBoxSVG taskStatusSVG baseline", status: baseline.status, taskid: task.id, fill: task.color || "#eee" });

        //tooltip
        var label = "<b>" + task.name + "</b>";
        label += "<br>";
        label += "@" + new Date(self.master.baselineMillis).format();
        label += "<br><br>";
        label += "<b>Status:</b> " + baseline.status;
        label += "<br><br>";
        label += "<b>Start:</b> " + new Date(baseline.startDate).format();
        label += "<br>";
        label += "<b>End:</b> " + new Date(baseline.endDate).format();
        label += "<br>";
        label += "<b>Duration:</b> " + baseline.duration;
        label += "<br>";
        label += "<b>Progress:</b> " + baseline.progress + "%";

        $(taskSvg).attr("data-label", label).on("click", function(event) {
            showBaselineInfo(event, this);
            //bind hide
        });

        //external box
        var layout = svg.rect(taskSvg, 0, 0, "100%", "100%", { class: "taskLayout", rx: "2", ry: "2" });


        //progress

        if (baseline.progress > 0) {
            var progress = svg.rect(taskSvg, 0, "20%", (baseline.progress > 100 ? 100 : baseline.progress) + "%", "60%", { rx: "2", ry: "2", fill: "rgba(0,0,0,.4)" });
            /*if (dimensions.width > 50) {
             var textStyle = {fill:"#888", "font-size":"10px",class:"textPerc teamworkIcons",transform:"translate(5)"};
             if (baseline.progress > 100)
             textStyle["font-weight"]="bold";
             if (baseline.progress > 90)
             textStyle.transform = "translate(-40)";
             svg.text(taskSvg, (baseline.progress > 90 ? 100 : baseline.progress) + "%", (self.master.rowHeight - 5) / 2, (baseline.progress > 100 ? "!!! " : "") + baseline.progress + "%", textStyle);
             }*/
        }

        //if (task.isParent())
        //  svg.rect(taskSvg, 0, 0, "100%", 3, {fill:"#000"});


        //task label
        //svg.text(taskSvg, "100%", 18, task.name, {class:"taskLabelSVG", transform:"translate(20,-5)"});


        return taskSvg
    }

};

Ganttalendar.prototype.getStoredZoomLevel = function () {
  if (localStorage  && localStorage.getObject("TWPGanttSavedZooms")) {
    var savedZooms = localStorage.getObject("TWPGanttSavedZooms");
    if(this.master.tasks.length == 0) {
        return false;
    }
    return savedZooms[this.master.tasks[0].id];
  }
  return false;
};

Ganttalendar.prototype.zoomGantt = function(isPlus) {
    var curLevel = this.zoom;
    var pos = this.zoomLevels.indexOf(curLevel + "");

    var centerMillis = this.getCenterMillis();
    var newPos = pos;
    if (isPlus) {
        newPos = pos <= 0 ? 0 : pos - 1;
    } else {
        newPos = pos >= this.zoomLevels.length - 1 ? this.zoomLevels.length - 1 : pos + 1;
    }
    if (newPos != pos) {
        curLevel = this.zoomLevels[newPos];
        this.gridChanged = true;
        this.zoom = curLevel;
        this.storeZoomLevel();
        if(curLevel == '1d' || (this.zoomLevels[pos] == '1d'&& curLevel != '1d')) {
            this.master.resetTasks(this.master.tasks);
        }
        this.redraw();
        this.goToMillis(centerMillis);
    }
};

Ganttalendar.prototype.centerOnTimeline = function() {
    if (new Date().getTime() < this.endMillis) {
        this.goToMillis(new Date().getTime());
    } else {
        var centerMillis = Math.ceil((this.startMillis + this.endMillis) / 2);
        this.goToMillis(centerMillis);
    }

}

Ganttalendar.prototype.shrinkBoundaries = function() {
    var start = Infinity;
    var end = -Infinity;
    for (var i = 0; i < this.master.tasks.length; i++) {
        var task = this.master.tasks[i];
        if (start > task.start)
            start = task.start;
        if (end < task.end)
            end = task.end;
    }

    //if include today synch extremes
    if (this.includeToday && this.zoom != '1d') {
        var today = new Date().getTime();
        start = start > today ? today : start;
        end = end < today ? today : end;
    }

    //mark boundaries as changed
    this.gridChanged = this.gridChanged || this.originalStartMillis != start || this.originalEndMillis != end;
    this.originalStartMillis = start;
    this.originalEndMillis = end;
};

/**
 * @override
 * Override for render milestones
 */
Ganttalendar.prototype.redrawTasks = function (drawAll) {
    var self = this;

    self.element.find("table.ganttTable").height(self.master.editor.element.height());
    var collapsedDescendant = this.master.getCollapsedDescendant();
    var startRowAdd = self.master.firstScreenLine - self.master.rowBufferSize;
    var endRowAdd = self.master.firstScreenLine + self.master.numOfVisibleRows + self.master.rowBufferSize;

    $("#linksGroup,#tasksGroup").empty();
    var gridGroup = $("#gridGroup").empty().get(0);

    //add missing ones
    var row = 0;
    self.master.firstVisibleTaskIndex = -1;
    for (var i = 0; i < self.master.tasks.length; i++) {
        var task = self.master.tasks[i];
        if (collapsedDescendant.indexOf(task) >= 0) {
            continue;
        }
        if (drawAll || (row >= startRowAdd && row < endRowAdd)) {
            this.drawTask(task);
            self.master.firstVisibleTaskIndex = self.master.firstVisibleTaskIndex == -1 ? i : self.master.firstVisibleTaskIndex;
            self.master.lastVisibleTaskIndex = i;
        }
        row++
    }

    //creates rows grid
    for (var i = 40; i <= self.master.editor.element.height(); i += self.master.rowHeight)
        self.svg.rect(gridGroup, 0, i, "100%", self.master.rowHeight, { class: "ganttLinesSVG" });

    // drawTodayLine
    if (new Date().getTime() > self.startMillis && new Date().getTime() < self.endMillis) {
        var x = Math.round(((new Date().getTime()) - self.startMillis) * self.fx);
        self.svg.line(gridGroup, x, 0, x, "100%", { class: "ganttTodaySVG" });
    }

    if (self.master.milestones) {
        let milestone_arr = self.master.milestones;
        milestone_arr.forEach(milestone => {
            let deadline = new Date(milestone.deadline);
            deadline.setHours(23,59,59,999);

            if (deadline.getTime() > self.startMillis && deadline.getTime() < self.endMillis) {
                let pos = Math.round((deadline.getTime() - self.startMillis) * self.fx);
                if (milestone.is_reached) {
                    self.svg.line(gridGroup, pos, 0, pos, "100%", { class: "gantt_milestone_line gantt_milestone_line_reached" });
                } else {
                    self.svg.line(gridGroup, pos, 0, pos, "100%", { class: "gantt_milestone_line" });
                }
            }
        });
    }
};

/**
 * @override
 * Override for render milestones
 */
Ganttalendar.prototype.createHeadCell = function (level, zoomDrawer, rowCtx, lbl, span, additionalClass, start, end) {
    var x = (start.getTime() - self.startMillis) * zoomDrawer.computedScaleX;
    var th = $("<th>").append(`<span>${lbl}</span>`).attr("colSpan", span);
    if (level > 1) { //set width on second level only
        var w = (end.getTime() - start.getTime()) * zoomDrawer.computedScaleX;
        th.css('min-width', w);
        if (this.master.milestones) {
            let milestone = this.master.milestones.find(m => {
                let milestone_date = new Date(m.deadline);
                milestone_date.setHours(0,0,0,0);
                return milestone_date.getTime() == start.getTime();
            });
            if (milestone) {
                let milestone_element = `<a tabindex="0" class="gantt_milestone" data-deadline=${milestone.deadline} data-id=${milestone.id}></div>`
                if (milestone.is_reached) {
                    milestone_element = `<a tabindex="0" class="gantt_milestone gantt_milestone_reached" data-deadline=${milestone.deadline} data-id=${milestone.id}></div>`
                }
                th.append(milestone_element);
            }
        }
    }
    if (additionalClass)
        th.addClass(additionalClass);
    rowCtx.append(th);
};
