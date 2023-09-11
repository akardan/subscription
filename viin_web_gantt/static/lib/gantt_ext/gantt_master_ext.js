GanttMaster.prototype.loadTasks = function(tasks, selectedRow) {
    var factory = new TaskFactory();

    //reset
    this.reset();
    var zoom = this.getStoredZoomLevelMaster(tasks);
    this.dataTasks = tasks;
    for (var i = 0; i < tasks.length; i++) {
        var task = tasks[i];
        if (!(task instanceof Task)) {
            tasks[i].original_start = tasks[i].start;
            tasks[i].original_end = tasks[i].end;
            if (zoom == '1d') {
                task.duration = Math.ceil((task.end - task.start) / 3600000);
            }
            var t = factory.build(task.id, task.name, task.code, task.level, task.start, task.duration, task.collapsed, zoom, task.auto_resize);
            for (var key in task) {
                if (key != "end" && key != "start")
                    t[key] = task[key]; //copy all properties
            }
            task = t;
        }
        task.master = this; // in order to access controller from task
        this.tasks.push(task);  //append task at the end
    }
    for (var i = 0; i < this.tasks.length; i++) {
        var task = this.tasks[i];
        var numOfError = this.__currentTransaction && this.__currentTransaction.errors ? this.__currentTransaction.errors.length : 0;
        //add Link collection in memory
        while (!this.updateLinks(task)) {  // error on update links while loading can be considered as "warning". Can be displayed and removed in order to let transaction commits.
            if (this.__currentTransaction && numOfError != this.__currentTransaction.errors.length) {
                var msg = "ERROR:\n";
                while (numOfError < this.__currentTransaction.errors.length) {
                    var err = this.__currentTransaction.errors.pop();
                    msg = msg + err.msg + "\n\n";
                }
                alert(msg);
            }
            this.__removeAllLinks(task, false);
        }
        if (!task.setPeriod(task.start, task.end)) {
            alert(GanttMaster.messages.GANNT_ERROR_LOADING_DATA_TASK_REMOVED + "\n" + task.name);
            //remove task from in-memory collection
            this.tasks.splice(task.getRow(), 1);
        } else {
            //append task to editor
            this.editor.addTask(task, null, true);
            //append task to gantt
            this.gantt.addTask(task);
        }
    }
    // re-select old row if tasks is not empty
    if (this.tasks && this.tasks.length > 0) {
        selectedRow = selectedRow ? selectedRow : 0;
        this.tasks[selectedRow].rowElement.click();
    }
};

GanttMaster.prototype.updateLinks = function(task) {
    // defines isLoop function
    function isLoop(task, target, visited) {
        //var prof= new Profiler("gm_isLoop");
        //console.debug("isLoop :"+task.name+" - "+target.name);
        if (target == task) {
            return true;
        }

        var sups = task.getSuperiors();

        //my children superiors are my superiors too
        var chs = task.getChildren();
        for (var i = 0; i < chs.length; i++) {
            sups = sups.concat(chs[i].getSuperiors());
        }

        var loop = false;
        //check superiors
        for (var i = 0; i < sups.length; i++) {
            var supLink = sups[i];
            if (supLink.from == target) {
                loop = true;
                break;
            } else {
                if (visited.indexOf(supLink.from.id + "x" + target.id) <= 0) {
                    visited.push(supLink.from.id + "x" + target.id);
                    if (isLoop(supLink.from, target, visited)) {
                        loop = true;
                        break;
                    }
                }
            }
        }

        //check target parent
        var tpar = target.getParent();
        if (tpar) {
            if (visited.indexOf(task.id + "x" + tpar.id) <= 0) {
                visited.push(task.id + "x" + tpar.id);
                if (isLoop(task, tpar, visited)) {
                    loop = true;
                }
            }
        }

        //prof.stop();
        return loop;
    }

    //remove my depends
    this.links = this.links.filter(function(link) {
        return link.to != task;
    });

    var todoOk = true;
    if (task.depends) {

        //cannot depend from an ancestor
        var parents = task.getParents();
        //cannot depend from descendants
        var descendants = task.getDescendant();

        var deps = task.depends.split(",");
        var newDepsString = "";

        var visited = [];
        var depsEqualCheck = [];
        for (var j = 0; j < deps.length; j++) {
            var depString = deps[j]; // in the form of row(lag) e.g. 2:3,3:4,5
            var supStr = depString;
            var lag = 0;
            var pos = depString.indexOf(":");
            if (pos > 0) {
                supStr = depString.substr(0, pos);
                var lagStr = depString.substr(pos + 1);
                lag = Math.ceil((stringToDuration(lagStr, this.gantt.zoom)) / Date.workingPeriodResolution) * Date.workingPeriodResolution;
            }

            var sup = this.tasks[parseInt(supStr) - 1];

            if (sup) {
                if (parents && parents.indexOf(sup) >= 0) {
                    this.setErrorOnTransaction("\"" + task.name + "\"\n" + GanttMaster.messages.CANNOT_DEPENDS_ON_ANCESTORS + "\n\"" + sup.name + "\"");
                    todoOk = false;

                } else if (isLoop(sup, task, visited)) {
                    todoOk = false;
                    this.setErrorOnTransaction(GanttMaster.messages.CIRCULAR_REFERENCE + "\n\"" + task.id + " - " + task.name + "\" -> \"" + sup.id + " - " + sup.name + "\"");

                } else if (depsEqualCheck.indexOf(sup) >= 0) {
                    this.setErrorOnTransaction(GanttMaster.messages.CANNOT_CREATE_SAME_LINK + "\n\"" + sup.name + "\" -> \"" + task.name + "\"");
                    todoOk = false;

                } else {
                    this.links.push(new Link(sup, task, lag));
                    newDepsString = newDepsString + (newDepsString.length > 0 ? "," : "") + supStr + (lag == 0 ? "" : ":" + durationToString(lag));
                }

                if (todoOk)
                    depsEqualCheck.push(sup);
            }
        }
        if (this.prev_data_task[task.id] == 'undefined') {
            task.depends = newDepsString;
        } else if (this.prev_data_task[task.id] && this.prev_data_task[task.id].depends != newDepsString) {
            task.depends = newDepsString;
        }

    }
    //prof.stop();

    return todoOk;
};

GanttMaster.prototype.getStoredZoomLevelMaster = function(tasks) {
    var savedZooms = {}
    if (localStorage && localStorage.getObject("TWPGanttSavedZooms")) {
        savedZooms = localStorage.getObject("TWPGanttSavedZooms");
        if (tasks.length == 0) {
            return false;
        }
        return savedZooms[tasks[0].id];
    }
    var zoom = '1M';
    if (tasks.length == 0) {
        return zoom;
    }
    savedZooms[tasks[0].id] = zoom;
    localStorage.setObject("TWPGanttSavedZooms", savedZooms);
    return zoom;
};

GanttMaster.prototype.resetTasks = function() {
    var factory = new TaskFactory();
    var zoom = this.getStoredZoomLevelMaster(this.tasks);
    for (var i = 0; i < this.tasks.length; i++) {
        var task = this.tasks[i];
        if (zoom == '1d') {
            task.duration = Math.ceil((task.original_end - task.original_start) / 3600000);
        } else {
            task.duration = getDurationInUnits(new Date(task.original_start), new Date(task.original_end));
        }
        var factory_task = factory.build(task.id, task.name, task.code, task.level, task.original_start, task.duration, task.collapsed, zoom);
        this.tasks[i].start = factory_task.start;
        this.tasks[i].end = factory_task.end;
    }
};

/**
 * a project contais tasks, resources, roles, and info about permisions
 * @param project
 */
GanttMaster.prototype.loadProject = function(project) {
    //console.debug("loadProject", project)
    this.beginTransaction();
    this.serverClientTimeOffset = typeof project.serverTimeOffset != "undefined" ? (parseInt(project.serverTimeOffset) + new Date().getTimezoneOffset() * 60000) : 0;
    this.resources = project.resources;
    this.roles = project.roles;

    //permissions from loaded project
    this.permissions.canWrite = project.canWrite;
    this.permissions.canAdd = project.canAdd;
    this.permissions.canWriteOnParent = project.canWriteOnParent;
    this.permissions.cannotCloseTaskIfIssueOpen = project.cannotCloseTaskIfIssueOpen;
    this.permissions.canAddIssue = project.canAddIssue;
    this.permissions.canDelete = project.canDelete;
    //repaint button bar basing on permissions
    this.checkButtonPermissions();

    this.milestones = project.milestones;

    if (project.minEditableDate)
        this.minEditableDate = computeStart(project.minEditableDate);
    else
        this.minEditableDate = -Infinity;

    if (project.maxEditableDate)
        this.maxEditableDate = computeEnd(project.maxEditableDate);
    else
        this.maxEditableDate = Infinity;


    //recover stored ccollapsed statuas
    var collTasks = this.loadCollapsedTasks();

    //shift dates in order to have client side the same hour (e.g.: 23:59) of the server side
    for (var i = 0; i < project.tasks.length; i++) {
        var task = project.tasks[i];
        task.start += this.serverClientTimeOffset;
        task.end += this.serverClientTimeOffset;
        //set initial collapsed status
        task.collapsed = collTasks.indexOf(task.id) >= 0;
    }
    // Define zoom before load task
    this.loadTasks(project.tasks, project.selectedRow);
    this.deletedTaskIds = [];

    //recover saved zoom level
    if (project.zoom) {
        this.gantt.zoom = project.zoom;
    } else {
        this.gantt.shrinkBoundaries();
        this.gantt.setBestFittingZoom();
    }

    this.endTransaction();
    var self = this;
    if (this.gantt.zoom != '1d') {
        this.gantt.element.oneTime(200, function() { self.gantt.centerOnToday() });
    } else {
        this.gantt.element.oneTime(200, function() { self.gantt.centerOnTimeline() });
    }
};
