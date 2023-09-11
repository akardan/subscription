$.splittify = {
  init: function (where, first, second, perc) {

    //perc = perc || 50;

    var element = $("<div>").addClass("splitterContainer");
    var firstBox = $("<div>").addClass("splitElement splitBox1");
    var splitterBar = $("<div>").addClass("splitElement vSplitBar").attr("unselectable", "on").css("padding-top", where.height() / 2 + "px");
    var secondBox = $("<div>").addClass("splitElement splitBox2");


    var splitter = new Splitter(element, firstBox, secondBox, splitterBar);
    splitter.perc =  perc;

    //override with saved one
    loadPosition();

    var toLeft = $("<div>").addClass("toLeft").html("{").click(function () {splitter.resize(0.001, 300);});
    splitterBar.append(toLeft);

    var toCenter = $("<div>").addClass("toCenter").html("&#xa9;").click(function () {splitter.resize(50, 300);});
    splitterBar.append(toCenter);

    var toRight = $("<div>").addClass("toRight").html("}").click(function () {splitter.resize(99.9999, 300);});
    splitterBar.append(toRight);


    firstBox.append(first);
    secondBox.append(second);

    element.append(firstBox).append(secondBox).append(splitterBar);

    where.append(element);
    var ideal_first_box_width = 666;
    var totalW = where.innerWidth();
    if (splitter.perc < 35 || splitter.perc > 50) {
        splitter.perc = Math.ceil((ideal_first_box_width/totalW) * 100);  
    }
    var splW = splitterBar.width();
    var fbw = totalW * perc / 100 - splW;
    fbw = fbw > totalW - splW - splitter.secondBoxMinWidth ? totalW - splW - splitter.secondBoxMinWidth : fbw;
    firstBox.width(fbw).css({left: 0});
    splitterBar.css({left: firstBox.width()});
    secondBox.width(totalW - fbw - splW).css({left: firstBox.width() + splW});

    splitterBar.on("mousedown.gdf", function (e) {

      e.preventDefault();
      $("body").addClass("gdfHResizing");

      $.splittify.splitterBar = $(this);
      //on event for start resizing
      //console.debug("start splitting");
      $("body").unselectable().on("mousemove.gdf", function (e) {
        //manage resizing
        e.preventDefault();

        var sb = $.splittify.splitterBar;
        var pos = e.pageX - sb.parent().offset().left;
        var w = sb.parent().width();
        var fbw = firstBox;

        pos = pos > splitter.firstBoxMinWidth ? pos : splitter.firstBoxMinWidth;
        //pos = pos < realW - 10 ? pos : realW - 10;
        pos = pos > totalW - splW - splitter.secondBoxMinWidth ? totalW - splW - splitter.secondBoxMinWidth : pos;
        sb.css({left: pos});
        firstBox.width(pos);
        secondBox.css({left: pos + sb.width(), width: w - pos - sb.width()});
        splitter.perc = (firstBox.width() / splitter.element.width()) * 100;

        //on mouse up on body to stop resizing
      }).on("mouseup.gdf", function () {
        //console.debug("stop splitting");
        $(this).off("mousemove.gdf").off("mouseup.gdf").clearUnselectable();
        delete $.splittify.splitterBar;

        $("body").removeClass("gdfHResizing");

        storePosition();
      });
    });


    // keep both side in synch when scroll
    var stopScroll = false;
    var fs = firstBox.add(secondBox);
    var lastScrollTop=0;
    fs.scroll(function (e) {
      var el = $(this);
      var top = el.scrollTop();

      var firstBoxHeader = firstBox.find(".ganttFixHead");
      var secondBoxHeader = secondBox.find(".ganttFixHead");

      if (el.is(".splitBox1") && stopScroll != "splitBox2") {
        stopScroll = "splitBox1";
        secondBox.scrollTop(top);
      } else if (el.is(".splitBox2") && stopScroll != "splitBox1") {
        stopScroll = "splitBox2";
        firstBox.scrollTop(top);
      }


      if (Math.abs(top-lastScrollTop)>10) {
        firstBoxHeader.css('top', top).hide();
        secondBoxHeader.css('top', top).hide();
      }
      lastScrollTop=top;

      where.stopTime("reset").oneTime(100, "reset", function () {

          stopScroll = "";
          top = el.scrollTop();

          firstBoxHeader.css('top', top).fadeIn();
          secondBoxHeader.css('top', top).fadeIn();

      });

    });


    firstBox.on('mousewheel MozMousePixelScroll', function (event) {

      event.preventDefault();

      var deltaY = event.originalEvent.wheelDeltaY;
      if (!deltaY)
        deltaY = event.originalEvent.wheelDelta;
      var deltaX = event.originalEvent.wheelDeltaX;

      if (event.originalEvent.axis) {
        deltaY = event.originalEvent.axis == 2 ? -event.originalEvent.detail : null;
        deltaX = event.originalEvent.axis == 1 ? -event.originalEvent.detail : null;
      }

      deltaY = Math.abs(deltaY) < 40 ? 40 * (Math.abs(deltaY) / deltaY) : deltaY;
      deltaX = Math.abs(deltaX) < 40 ? 40 * (Math.abs(deltaX) / deltaX) : deltaX;

      var scrollToY = secondBox.scrollTop() - deltaY;
      var scrollToX = firstBox.scrollLeft() - deltaX;

//          console.debug( firstBox.scrollLeft(), Math.abs(deltaX), Math.abs(deltaY));

      if (deltaY) secondBox.scrollTop(scrollToY);
      if (deltaX) firstBox.scrollLeft(scrollToX);

      return false;
    });


    function Splitter(element, firstBox, secondBox, splitterBar) {
      this.element = element;
      this.firstBox = firstBox;
      this.secondBox = secondBox;
      this.splitterBar = splitterBar;
      this.perc = 0;
      this.firstBoxMinWidth = 0;
      this.secondBoxMinWidth = 30;

      this.resize = function (newPerc, anim) {
        var animTime = anim ? anim : 0;
        this.perc = newPerc ? newPerc : this.perc;
        var totalW = this.element.width();
        var splW = this.splitterBar.width();
        var newW = totalW * this.perc / 100;
        newW = newW > this.firstBoxMinWidth ? newW : this.firstBoxMinWidth;
        newW = newW > totalW - splW - splitter.secondBoxMinWidth ? totalW - splW - splitter.secondBoxMinWidth : newW;
        this.firstBox.animate({width: newW}, animTime, function () {$(this).css("overflow-x", "auto")});
        this.splitterBar.animate({left: newW}, animTime);
        this.secondBox.animate({left: newW + this.splitterBar.width(), width: totalW - newW - splW}, animTime, function () {$(this).css("overflow", "auto")});

        storePosition();
      };

      var self = this;
      this.splitterBar.on("dblclick", function () {
        self.resize(50, true);
      })
    }


    function storePosition () {
      //console.debug("storePosition",splitter.perc);
      if (localStorage) {
        localStorage.setItem("TWPGanttSplitPos",splitter.perc);
      }
    }

    function loadPosition () {
      splitter.perc=70;
    }



    return splitter;
  }

};
// same dates returns 1
function getDurationInUnits(start, end, zoom) {
    if (zoom && zoom == '1d') {
        return start.distanceInWorkingHours(end); // working in hours
    }
    return start.distanceInWorkingDays(end) + 1; // working in days
}

function getDistanceInUnits(date1, date2, zoom) {
    if (zoom && zoom == '1d') {
        return date1.distanceInWorkingHours(date2); // working in hours
    }
    return date1.distanceInWorkingDays(date2); // working in days
}

function incrementDateByUnits(date, duration, zoom) {
    if (zoom != '1d') {
        date.incrementDateByWorkingDays(duration); // working in days
        return date;
    }
    date.incrementDateByWorkingHours(duration); // working in hours
    return date;
}

function computeStart(start, zoom) {
    return computeStartDate(start, zoom).getTime();
}

function computeEnd(end, zoom) {
    return computeEndDate(end, zoom).getTime()
}

/**
 * @param start
 * @returns {Date} the closes start date
 */
function computeStartDate(start, zoom) {
    var d = new Date(start);
    if (sessionStorage.getItem('gantt_date_type') == 'datetime'){
        if (zoom == '1d') {
            d = new Date(start + 60000*30);
            var h = d.getHours();
            d.setHours(h, 0, 0);
            return d
        }
        d = new Date(start + 3600000 * 12);
    }
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * @param end
 * @returns {Date} the closest end date
 */
function computeEndDate(end, zoom) {
    var d = new Date(end);
    if (sessionStorage.getItem('gantt_date_type') == 'datetime'){
        if (zoom == '1d') {
            d = new Date(end - 60000*30);
            var h = d.getHours();
            d.setHours(h, 59, 59);
            return d;
        }
        d = new Date(end - 3600000 * 12);
    }
    d.setHours(23, 59, 59, 999);
    return d;
}

function computeEndByDuration(start, duration, zoom) {
    var d = new Date(start);
    var q = duration - 1;
    if (zoom != '1d') {
        while (q > 0) {
            d.setDate(d.getDate() + 1);
            q--;

        }
    } else {
        q = duration - 1;
        while (q > 0) {
            d.setTime(d.getTime() + 3600000);
            q--;
        }
    }
    if (zoom != '1d') {
        d.setHours(23, 59, 59, 999);
    } else {
        var h = d.getHours();
        d.setHours(h, 59, 59);
    }
    return d.getTime();
}

function recomputeDuration(start, end, zoom) {
    //console.debug("recomputeDuration");
    return getDurationInUnits(new Date(start), new Date(end), zoom);
}


function resynchDates(leavingField, startField, startMilesField, durationField, endField, endMilesField, zoom) {
    function resynchDatesSetFields(command) {
        //console.debug("resynchDatesSetFields",command);
        var duration = stringToDuration(durationField.val());
        var start = computeStart(Date.parseString(startField.val()).getTime());

        var end = endField.val();
        if (end.length > 0) {
            end = Date.parseString(end);
            end = computeEnd(end.getTime());
        }

        var date = new Date();
        if ("CHANGE_END" == command) {
            date.setTime(start);
            var workingUnits = duration - 1; // if we do not decremet a task lasting two days starting on 10 will end on 12 (at 00:00) instead of on (at 23:59)
            incrementDateByUnits(date, workingUnits, zoom);
            end = computeEnd(date.getTime()); // not strictly necessary
        } else if ("CHANGE_START" == command) {
            date.setTime(end);
            var workingUnits = duration - 1; // if we do not decremet a task lasting two days starting on 10 will end on 12 (at 00:00) instead of on (at 23:59)
            incrementDateByUnits(date, -workingUnits, zoom);
            start = computeStart(date.getTime()); //not strictly necessary
        } else if ("CHANGE_DURATION" == command) {
            duration = getDurationInUnits(new Date(start), new Date(end), zoom) + 1;
        }

        startField.val(new Date(start).format());
        endField.val(new Date(end).format());
        durationField.val(durationToString(duration));

        return { start: start, end: end, duration: duration };
    }

    var leavingFieldName = leavingField.prop("name");
    var durIsFilled = durationField.val().length > 0;
    var startIsFilled = startField.val().length > 0;
    var endIsFilled = endField.val().length > 0;
    var startIsMilesAndFilled = startIsFilled && (startMilesField.prop("checked") || startField.is("[readOnly]"));
    var endIsMilesAndFilled = endIsFilled && (endMilesField.prop("checked") || endField.is("[readOnly]"));

    if (durIsFilled) {
        durationField.val(durationToString(stringToDuration(durationField.val())));
    }

    if (leavingFieldName.indexOf("Milestone") > 0) {
        if (startIsMilesAndFilled && endIsMilesAndFilled) {
            durationField.prop("readOnly", true);
        } else {
            durationField.prop("readOnly", false);
        }
        return;
    }

    //need at least two values to resynch the third
    if ((durIsFilled ? 1 : 0) + (startIsFilled ? 1 : 0) + (endIsFilled ? 1 : 0) < 2)
        return;

    var ret;
    if (leavingFieldName == 'start' && startIsFilled) {
        if (endIsMilesAndFilled && durIsFilled) {
            ret = resynchDatesSetFields("CHANGE_DURATION");
        } else if (durIsFilled) {
            ret = resynchDatesSetFields("CHANGE_END");
        }

    } else if (leavingFieldName == 'duration' && durIsFilled && !(endIsMilesAndFilled && startIsMilesAndFilled)) {
        if (endIsMilesAndFilled && !startIsMilesAndFilled) {
            ret = resynchDatesSetFields("CHANGE_START");
        } else if (!endIsMilesAndFilled) {
            //document.title=('go and change end!!');
            ret = resynchDatesSetFields("CHANGE_END");
        }

    } else if (leavingFieldName == 'end' && endIsFilled) {
        ret = resynchDatesSetFields("CHANGE_DURATION");
    }
    return ret;
}

function stringToDuration(durStr, zoom) {
    var duration = NaN;
    if (zoom == '1d') {
        duration = hoursFromString(durStr, true) || 1;
        return duration;
    }
    duration = daysFromString(durStr, true) || 1;
    return duration;
}
