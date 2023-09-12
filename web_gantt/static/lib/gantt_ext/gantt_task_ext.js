function TaskFactory() {

  /**
   * Build a new Task
   */
  this.build = function (id, name, code, level, start, duration, collapsed, zoom, auto_resize) {
    // Set at beginning of day
    var adjusted_start = computeStart(start, zoom);
    var calculated_end = computeEndByDuration(adjusted_start, duration, zoom);
    var task = new Task(id, name, code, level, adjusted_start, calculated_end, duration, collapsed);
    task.auto_resize = auto_resize;
    return task;
  };

}

/*
 * Overwrite to check to exclude task has only one children, and children has start = parent start
 * to avoid circular
 */
Task.prototype.moveTo = function (start, ignoreMilestones, propagateToInferiors) {
  if (start instanceof Date) {
    start = start.getTime();
  }

  var originalPeriod = {
    start: this.start,
    end:   this.end
  };

  var wantedStartMillis = start;

  //set a legal start
  start = computeStart(start, this.master.gantt.zoom);

  //if depends, start is set to max end + lag of superior
  start = this.computeStartBySuperiors(start);

  var end = computeEndByDuration(start, this.duration, this.master.gantt.zoom);


  //check milestones compatibility
  if (!this.checkMilestonesConstraints(start,end,ignoreMilestones))
      return false;

  if (this.start != start || this.start != wantedStartMillis) {
    //in case of end is milestone it never changes!
    //if (!ignoreMilestones && this.endIsMilestone && end != this.end) {
    //  this.master.setErrorOnTransaction("\"" + this.name + "\"\n" + GanttMaster.messages["END_IS_MILESTONE"], this);
    //  return false;
    //}
    this.start = start;
    this.end = end;
    //profiler.stop();

    //check global boundaries
    if (this.start < this.master.minEditableDate || this.end > this.master.maxEditableDate) {
      this.master.setErrorOnTransaction("\"" + this.name + "\"\n" +GanttMaster.messages["CHANGE_OUT_OF_SCOPE"], this);
      return false;
    }


    // bicch 22/4/2016: quando si sposta un task con child a cavallo di holidays, i figli devono essere shiftati in workingDays, non in millisecondi, altrimenti si cambiano le durate
    // when moving children you MUST consider WORKING days,
    var panDeltaInWM = getDistanceInUnits(new Date(originalPeriod.start),new Date(this.start), this.master.gantt.zoom);

    //loops children to shift them
    var children = this.getChildren();
    // Check to exclude task has only one children
    var shouldUpdateChildren = true;
    if ( children.length == 1) {
        var chTask = children[0];
        // In case parent task has start date and end date has nothing to do with start, end date of children
        if(chTask.start == this.start || !this.auto_resize) {
          shouldUpdateChildren = false;
        }
    }
    if(shouldUpdateChildren) {
      for (var i = 0; i < children.length; i++) {
          var ch = children[i];
          var chStart=incrementDateByUnits(new Date(ch.start),panDeltaInWM, this.master.gantt.zoom);
          ch.moveTo(chStart,false,false);
      }
    }
    
    // debugger
    if (!updateTree(this)) {
      return false;
    }

    if (propagateToInferiors) {
      this.propagateToInferiors(end);
      var todoOk = true;
      var descendants = this.getDescendant();
      for (var i = 0; i < descendants.length; i++) {
        ch = descendants[i];
        if (!ch.propagateToInferiors(ch.end))
          return false;
      }
    }
  }

  return true;
};

//<%---------- SET PERIOD ---------------------- --%>
Task.prototype.setPeriod = function(start, end) {
    if (start instanceof Date) {
        start = start.getTime();
    }

    if (end instanceof Date) {
        end = end.getTime();
    }

    var originalPeriod = {
        start: this.start,
        end: this.end,
        duration: this.duration
    };
    var zoom = this.master.getStoredZoomLevelMaster(this.master.tasks);
    //compute legal start/end //todo mossa qui R&S 30/3/2016 perchè altrimenti il calcolo della durata, che è stato modificato sommando giorni, sbaglia
    start = computeStart(start, zoom);
    end = computeEnd(end, zoom);
    var newDuration = recomputeDuration(start, end, zoom);
    // debugger
    //if are equals do nothing and return true
    if (start == originalPeriod.start && end == originalPeriod.end && newDuration == originalPeriod.duration) {
        return true;
    }
    if (newDuration == this.duration) { // is shift
        return this.moveTo(start, false, true);
    }
    var wantedStartMillis = start;

    var children = this.getChildren();

    if (this.master.shrinkParent && children.length > 0 && this.auto_resize) {
        var chPeriod = this.getDeepestChildrenBoudaries();
        start = chPeriod.start;
        end = chPeriod.end;
    }

    //cannot start after end
    if (start > end) {
        start = end;
    }

    //if there are dependencies compute the start date and eventually moveTo
    var startBySuperiors = this.computeStartBySuperiors(start);
    if (startBySuperiors != start) {
        return this.moveTo(startBySuperiors, false, true);
    }
    var somethingChanged = false;

    if (this.start != start || this.start != wantedStartMillis) {
        this.start = start;
        somethingChanged = true;
    }

    //set end
    var wantedEndMillis = end;

    if (this.end != end || this.end != wantedEndMillis) {
        this.end = end;
        somethingChanged = true;
    }
    this.duration = recomputeDuration(this.start, this.end, zoom);
    //profilerSetPer.stop();
    //nothing changed exit
    if (!somethingChanged)
        return true;

    //cannot write exit
    if (!this.canWrite) {
        this.master.setErrorOnTransaction("\"" + this.name + "\"\n" + GanttMaster.messages["CANNOT_WRITE"], this);
        return false;
    }

    //external dependencies: exit with error
    if (this.hasExternalDep) {
        this.master.setErrorOnTransaction("\"" + this.name + "\"\n" + GanttMaster.messages["TASK_HAS_EXTERNAL_DEPS"], this);
        return false;
    }

    var todoOk = true;

    //I'm restricting
    var deltaPeriod = originalPeriod.duration - this.duration;
    var restricting = deltaPeriod > 0 && this.auto_resize;
    var enlarging = deltaPeriod < 0;
    var restrictingStart = restricting && (originalPeriod.start < this.start);
    var restrictingEnd = restricting && (originalPeriod.end > this.end);
    if (restricting) {
        //loops children to get boundaries
        var bs = Infinity;
        var be = 0;
        for (var i = 0; i < children.length; i++) {

            var ch = children[i];
            if (restrictingEnd) {
                be = Math.max(be, ch.end);
            } else {
                bs = Math.min(bs, ch.start);
            }
        }

        if (restrictingEnd) {
            this.end = Math.max(be, this.end);
        } else {
            this.start = Math.min(bs, this.start);
        }
        // if current zoom is by hours then coumpute it in differenc way
        this.duration = recomputeDuration(this.start, this.end, this.master.gantt.zoom);

        if (this.master.shrinkParent) {
            todoOk = updateTree(this);
        }

    } else {

        //check global boundaries
        if (this.start < this.master.minEditableDate || this.end > this.master.maxEditableDate) {
            this.master.setErrorOnTransaction("\"" + this.name + "\"\n" + GanttMaster.messages["CHANGE_OUT_OF_SCOPE"], this);
            todoOk = false;
        }

        //console.debug("set period: somethingChanged",this);
        if (todoOk) {
            todoOk = updateTree(this);
        }
    }
    // debugger
    if (todoOk) {
        todoOk = this.propagateToInferiors(end);
    }
    return todoOk;
};

Task.prototype.computeStartBySuperiors = function (proposedStart) {
  var zoom = this.master.getStoredZoomLevelMaster(this.master.tasks);
  return computeStart(proposedStart, zoom);
};

//<%---------- PROPAGATE TO INFERIORS ---------------------- --%>
Task.prototype.propagateToInferiors = function (end) {
  return true;
};

function updateTree(task) {
  //console.debug("updateTree ",task.code,task.name, new Date(task.start), new Date(task.end));
  var error;

  //try to enlarge parent
  var p = task.getClosestGroupParent();

  //no parent or parent not auto resize:exit
  if (!p || !p.auto_resize)
    return true;

  var newStart;
  var newEnd;

  //id shrink start and end are computed on children boundaries
  if (task.master.shrinkParent) {
    var chPeriod= p.getDeepestChildrenBoudaries();
    newStart = chPeriod.start;
    newEnd = chPeriod.end;
  } else {
    newStart = p.start;
    newEnd = p.end;

  if (p.start > task.start) {
      newStart = task.start;
    }
    if (p.end < task.end) {
      newEnd = task.end;
    }
  }

  if (p.start!=newStart) {
    if (p.startIsMilestone) {
      task.master.setErrorOnTransaction("\"" + p.name + "\"\n" + GanttMaster.messages["START_IS_MILESTONE"], task);
      return false;
    } else if (p.depends) {
      task.master.setErrorOnTransaction("\"" + p.name + "\"\n" + GanttMaster.messages["TASK_HAS_CONSTRAINTS"], task);
      return false;
    }
  }
  if (p.end!=newEnd) {
    if (p.endIsMilestone) {
      task.master.setErrorOnTransaction("\"" + p.name + "\"\n" + GanttMaster.messages["END_IS_MILESTONE"], task);
      return false;
    }
  }


  //propagate updates if needed
  if (newStart != p.start || newEnd != p.end) {
    //can write?
    if (!p.canWrite) {
      task.master.setErrorOnTransaction(GanttMaster.messages["CANNOT_WRITE"] + "\n" + p.name, task);
      return false;
    }

    //has external deps ?
    if (p.hasExternalDep) {
      task.master.setErrorOnTransaction(GanttMaster.messages["TASK_HAS_EXTERNAL_DEPS"] + "\n\"" + p.name + "\"", task);
      return false;
    }

    return p.setPeriod(newStart, newEnd);
  }

  return true;
}

Task.prototype.getDeepestChildrenBoudaries = function () {
  var newStart = Infinity;
  var newEnd = -Infinity;
  var children = this.getDescendant();
  // period of parent is time from deepest children start to end (including sub-children)
  for (var i = 0; i < children.length; i++) {
    var ch = children[i];
    newStart = Math.min(newStart, ch.start);
    newEnd = Math.max(newEnd, ch.end);
  }
  return({start:newStart,end:newEnd})
}

Task.prototype.getClosestGroupParent = function () {
    // When task has sub task as children and when subtask resize, the project need to update start and end date
    if (this.master) {
        var topLevel = this.level;
        var pos = this.getRow();
        for (var i = pos; i >= 0; i--) {
            var par = this.master.tasks[i];
            if (topLevel > par.level && par.res_model != this.res_model) {
                topLevel = par.level;
                return par;
            }
        }
    }
}
