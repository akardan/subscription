/**
* @override
*/
Date.prototype.distanceInWorkingDays= function (toDate){
  var pos = new Date(Math.min(this,toDate));
  pos.setHours(12, 0, 0, 0);
  var days = 0;
  var nd=new Date(Math.max(this,toDate));
  nd.setHours(12, 0,0, 0);
  while (pos < nd) {
    days = days + 1;
    pos.setDate(pos.getDate() + 1);
  }
  days=days*(this>toDate?-1:1);

  //console.debug("distanceInWorkingDays",this,toDate,days);
  return days;
};

Date.prototype.distanceInWorkingHours = function(toDate) {
    var pos = new Date(Math.min(this, toDate));
    var hours = 0;
    var nd = new Date(Math.max(this, toDate));
    while (pos < nd) {
        hours += 1
        pos.setTime(pos.getTime() + 3600000);
    }
    hours = hours * (this > toDate ? -1 : 1);

    return hours;
}

/**
 * @param string              "3y 4d", "4D:08:10", "12M/3d", "2H4D", "3M4d,2h", "12:30", "11", "3", "1.5", "2m/3D", "12/3d", "1234"
 *                            by default 2 means 2 hours 1.5 means 1:30
 * @param considerWorkingdays if true day length is from global.properties CompanyCalendar.MILLIS_IN_WORKING_DAY  otherwise in 24
 * @return milliseconds. 0 if invalid string
 */
function hoursFromString(string, considerWorkingdays) {
    if (!string)
        return undefined;

    //var regex = new RegExp("(\\d+[Yy])|(\\d+[Mm])|(\\d+[Ww])|(\\d+[Dd])|(\\d*[\\.,]\\d+)|(\\d+)", "g"); // bicch 14/1/16 supporto per 1.5d
    //var regex = new RegExp("([0-9\\.,]+[Yy])|([0-9\\.,]+[Qq])|([0-9\\.,]+[Mm])|([0-9\\.,]+[Ww])|([0-9\\.,]+[Dd])|(\\d*[\\.,]\\d+)|(\\d+)", "g");
    var regex = new RegExp("([\\-]?[0-9\\.,]+[Yy])|([\\-]?[0-9\\.,]+[Qq])|([\\-]?[0-9\\.,]+[Mm])|([\\-]?[0-9\\.,]+[Ww])|([\\-]?[0-9\\.,]+[Dd])|([\\-]?\\d*[\\.,]\\d+)|([\\-]?\\d+)", "g");

    var matcher = regex.exec(string);
    var totHours = 0;

    if (!matcher)
        return NaN;

    while (matcher != null) {
        for (var i = 1; i < matcher.length; i++) {
            var match = matcher[i];
            if (match) {
                var number = 0;
                try {
                    number = parseInt(match); // bicch 14/1/16 supporto per 1.5d
                    number = parseFloat(match.replace(',', '.'));
                } catch (e) {}
                if (i == 1) { // years
                    totHours = totHours + number * (considerWorkingdays ? workingDaysPerWeek * 52 * 24 : 365 * 24);
                } else if (i == 2) { // quarter
                    totHours = totHours + number * (considerWorkingdays ? workingDaysPerWeek * 12 * 24 : 91 * 24);
                } else if (i == 3) { // months
                    totHours = totHours + number * (considerWorkingdays ? workingDaysPerWeek * 4 * 24 : 30 * 24);
                } else if (i == 4) { // weeks
                    totHours = totHours + number * (considerWorkingdays ? workingDaysPerWeek * 24 : 7 * 24);
                } else if (i == 5) { // days
                    totHours = (totHours + number) * 24;
                } else if (i == 6) { // days.minutes
                    totHours = (totHours + number) * 24;
                } else if (i == 7) { // days
                    totHours = (totHours + number) * 24;
                }
            }
        }
        matcher = regex.exec(string);
    }

    return parseInt(totHours);
}

Date.prototype.incrementDateByWorkingHours = function(hours) {
    var q = Math.abs(hours);
    while (q > 0) {
        this.setTime(this.getTime() + 3600000);
        if (!this.isHoliday())
            q--;
    }
    return this;
};
