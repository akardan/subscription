/*
* This file is based on gantt-pdf/ganttPDF.js
*/
odoo.define('viin_web_gantt.gantt_pdf', function(require){
	"use strict";
	
	var Dialog = require('web.Dialog');
	var core = require('web.core');
	var _t = core._t;
	var gantt_pdf = {
		master: null,
		init: function(master) {
			this.master = master;
		},
		exportPDF: function() {
		  var self=this;
		  self.master.gantt.redrawTasks(true);
		
		  var marginTop=10;
		  var marginLeft=10;
		
		  var pageFormats={
		    a2: {n:"a2",w:420,h:594},
		    a3: {n:"a3",w:297,h:420},
		    a4: {n:"a4",w:210,h:297}
		  };
		
		  var pageFormat=pageFormats.a3;
		
		  var gridBoxWidthInPixel = $(".splitBox1 .gdfTable:not(.ganttFixHead)").width();
		  var ganttWidthInPixel=gridBoxWidthInPixel+$(".splitBox2 .gantt").width();
		  var ganttHeightInPixel=$(".splitBox2 .ganttTable").height();
		
		  var widthInMM;
		  var heightInMM;
		  var orientation;
		  if (ganttWidthInPixel>ganttHeightInPixel) {
		    widthInMM = pageFormat.h;
		    heightInMM = pageFormat.w;
		    orientation = 'l';
		  } else {
		    widthInMM = pageFormat.w;
		    heightInMM = pageFormat.h;
		    orientation = 'p';
		  }

		  if(self.master.tasks.length == 0) {
			Dialog.alert(null, _t('There is no tasks!'));
			return
		  }
		
		  var scaleFactor=Math.min((widthInMM-marginLeft*2)/ganttWidthInPixel,(heightInMM-marginTop*2)/ganttHeightInPixel);
		  var pointInMillimeters=0.352778; //1 point in millimeters
		
		  var taskRowsHeight=self.master.editor.element.find("tr.taskEditRow:visible:not(.emptyRow)").length*($("tr.taskEditRow[taskId]:first").outerHeight())*scaleFactor;
		  var headerHeight=$(".splitBox1 .gdfTable:not(.ganttFixHead) tr:first").outerHeight()*scaleFactor;
		  var gridBoxWidth=gridBoxWidthInPixel* scaleFactor;
		  var textShiftY=6*scaleFactor;//in mm
		  var textShiftX=1*scaleFactor;//in mm
		
		  var pdf = new jsPDF({
		    orientation: orientation,
		    unit:         'mm',
		    format:       pageFormat.n,
		    compress:     false,
		    fontSize:     14*scaleFactor/pointInMillimeters,  //in points
		    lineHeight:   1,
		    autoSize:     true,
		    printHeaders: false
		  });
		
		  pdf.setProperties({
		    title:    self.master.tasks[0].name,
		    subject:  'Twproject Gantt editor',
		    author:   "<%=pageState.getLoggedOperator().getDisplayName()%>",
		    creator:   "<%=pageState.getLoggedOperator().getDisplayName()%>"
		  });

		  callAddFont(pdf);
		  // pdf.setFont('Arial');
		  pdf.setFont("OpenSans-Regular","normal");
		
		  //si disegna uno sfondo per l'header
		  pdf.setFillColor(230,230,230);
		  pdf.rect(marginLeft,marginTop, ganttWidthInPixel*scaleFactor, headerHeight,"F");
		
		
		  drawAlternateRows(marginLeft,marginTop+headerHeight,ganttWidthInPixel*scaleFactor);
		  drawLeftHeader();
		  drawRightHeader(marginLeft+gridBoxWidth,marginTop);
		  drawDataTasks(marginLeft,marginTop+headerHeight);
		  drawLinks();
		  drawGanttTasks(marginLeft,marginTop+headerHeight,self.master.element.is(".colorByStatus"));
		
		  if (self.master.progressCheckBar)
		    drawControlBars(marginLeft,marginTop+headerHeight);
		
		  pdf.save(self.master.tasks[0].name.replace(/\W/gi,"-"));
		
		
		
		  function drawAlternateRows(left,top,w){
		    //righe alternate
		    var swap=true;
		    var h=self.master.tasks[0].rowElement.outerHeight()*scaleFactor;
		
		    var y=top;
		    for (var i = 0; i < self.master.tasks.length; i++) {
		      var task = self.master.tasks[i];
		      if (!task.rowElement.is(":visible"))
		        continue;
		
		
		      //si disegna lo sfondo della riga
		      if (swap) {
		        pdf.setFillColor(255, 255, 255);
		      }else {
		        pdf.setFillColor(250, 250, 250);
		        pdf.rect(left, y, w, h, "F");
		      }
		      y+=h;
		      swap=!swap;
		    }
		  }
		
		
		  // disegna griglia dati
		  function drawLeftHeader () {
		    var x = marginLeft;
		    var tr = $(".splitBox1 .gdfTable:not(.ganttFixHead) tr:first");
		    var rowHeight = tr.outerHeight() * scaleFactor;
		    x = marginLeft;
		    var cells = tr.find("td,th");
		    pdf.setLineWidth(1 * scaleFactor);
		
		    cells.each(function (col) {
		      var cell = $(this);
		
		      //si saltano le celle non visibili
		      if (!cell.is(":visible"))
		        return;
		
		
		      var cellWidth = cell.outerWidth() * scaleFactor;
		      var text="";
		      if (col == 4 || col == 6) {
		        //text = cell.find("input:checked").length > 0 ? "[]" : "";
		        return true;
		      } else {
		        text = cell.text();
		      }
		
		      text = text ? text.trim() : "";
		      pdf.setFontSize(14*scaleFactor/pointInMillimeters);
		      pdf.text(textShiftX+x+ cellWidth / 2, marginTop+textShiftY+rowHeight/2, text, null, null, "center");
		      setGridLineAttributes();
		      pdf.line(x + cellWidth, marginTop , x + cellWidth , marginTop+headerHeight+taskRowsHeight);
		      x += cellWidth;
		    })
		
		  }
		
		
		  function drawRightHeader (left,top) {
		    var y=top;
		    pdf.setLineWidth(1 * scaleFactor);
		    $(".splitBox2 .ganttTable .ganttHead1 th").each(function (r) {
			
		      var cell = $(this);
		      var rowHeight = cell.outerHeight() * scaleFactor;
		      var x = left+cell.position().left*scaleFactor;
		      var y = top;
		
		      var cellWidth = cell.outerWidth() * scaleFactor;
		
		      var text = "";
		      text = cell.text();
		      text = text ? text.trim() : "";
		
		      pdf.setFontSize(14 * scaleFactor / pointInMillimeters);
		      pdf.text(textShiftX + x + cellWidth / 2, textShiftY + y + rowHeight / 2, text, null, null, "center");
		
		      //body line
		      pdf.setLineWidth(1 * scaleFactor);
		      pdf.setDrawColor(180, 180, 180);
		      pdf.line(x + cellWidth, y, x + cellWidth, marginTop + headerHeight); //si allungano solo le linee della seconda barra
		    });

			$(".splitBox2 .ganttTable .ganttHead2 th").each(function (r) {
				var cell = $(this);
			    var rowHeight = cell.outerHeight() * scaleFactor;
			    var x = left+cell.position().left*scaleFactor;
			    var y = top + rowHeight;
		
				var cellWidth = cell.outerWidth() * scaleFactor;
		
				var text = "";
			    text = cell.text();
			    text = text ? text.trim() : "";
			
			    pdf.setFontSize(14 * scaleFactor / pointInMillimeters);
			    pdf.text(textShiftX + x + cellWidth / 2, textShiftY + y + rowHeight / 2, text, null, null, "center");
			
			    //body line
			    pdf.setLineWidth(1 * scaleFactor);
			    pdf.setDrawColor(180, 180, 180);
			    pdf.line(x + cellWidth, y, x + cellWidth, marginTop + headerHeight + taskRowsHeight); //si allungano solo le linee della seconda barra
		    });
		  }
		
		
		
		  //draw data grid
		  function drawDataTasks(left,top,colorByStatus) {
		    var y = top;
		    for (var i = 0; i < self.master.tasks.length; i++) {
		      var task = self.master.tasks[i];
		      if (!task.rowElement.is(":visible"))
		        continue;
			  var rgb = hexToRgb(task.status_obj.color);
		
		      if (self.master.showCriticalPath && task.isCritical){
		        pdf.setTextColor(211,2,2);
		      } else {
		        pdf.setTextColor(0,0,0);
		      }
		
		      var tr = task.rowElement;
		      var x = left;
		      var rowHeight = tr.outerHeight() * scaleFactor;
		      var rowWidth = tr.outerWidth() * scaleFactor;
		
		
		      //si saltano le righe non visibili
		      if (!tr.is(":visible"))
		        return;
		
		      // parte griglia
		      tr.find("td,th").each(function (col) {
		        var cell = $(this);
		
		        //si saltano le celle non visibili
		        if (!cell.is(":visible"))
		          return;
		
		        var cellWidth = cell.outerWidth() * scaleFactor;
		        var text = "";
		        var paddingLeft=(parseInt(cell.css("padding-left"))||0)*scaleFactor;
		
		        if (col == 0) { // numero progressivo
		          text = (i + 1)+"";
		        } else if (col == 1) { // status
		          pdf.setFillColor(rgb.r,rgb.g,rgb.b);
		          pdf.circle(x+cellWidth/2, y + rowHeight / 2, cellWidth * .3, "F")
		
		        } else if (col == 3) { // name
		          text = cell.find("input").val();
		          text =(task.collapsed?"[+] ":"")+ text;
		
		        } else if (col == 4 || col == 6) {
		          //text = cell.find("input:checked").length > 0 ? "[]" : "";
		          return true;
		
		        } else if (col == 11) { // assignees
				  // Get image of manager
				  var manager_name = $('.manager', cell).attr('title');
				  var memeber_name = $('.member:not(manager)', cell).attr('title');
				  var text_assign = '';
				  if(manager_name && manager_name != 'System/') {
					text_assign += manager_name;
				  }
				  if(memeber_name && memeber_name != 'System/') {
					text_assign += '         ' + memeber_name;
				  }
				  pdf.text(textShiftX+x+paddingLeft, textShiftY+y + rowHeight / 2, text_assign);
		          text = cell.text().trim();
		        } else {
		          text = cell.find("input").val();
		          //console.debug(col, text)
                  if(typeof text == 'undefined') return;
		        }
		        text=pdf.splitTextToSize(text, cellWidth-paddingLeft)[0];
		        pdf.setFontSize( 14*scaleFactor/pointInMillimeters);
		        pdf.text(textShiftX+x+paddingLeft, textShiftY+y + rowHeight / 2, text);
		        x += cellWidth;
		      });
		
		      y += rowHeight;
		      setGridLineAttributes();
		      pdf.line(left, y, left+ganttWidthInPixel*scaleFactor , y);
		    }
		  }
		
		
		
		  function drawGanttTasks(left,top,colorByStatus) {
		    for (var i = 0; i < self.master.tasks.length; i++) {
		      var task = self.master.tasks[i];
		      if (!task.rowElement.is(":visible") || task.hidden_visibility)
		        continue;
		
		      var rgb;
		      var rbgContrast;
		      if (colorByStatus) {
		        rgb = hexToRgb(task.status_obj.color);
		        rbgContrast= rgbContrast(rgb);
		      } else {
		        rgb = hexToRgb(task.ganttElement.attr("fill"));
		        rbgContrast= rgbContrast(rgb);
		      }
		
		
		      var tr = task.rowElement;
		      var rowHeight = tr.outerHeight() * scaleFactor;
		
		      //parte gantt
		      task.ganttElement
		
		      var xBox=parseInt(task.ganttElement.attr("x"));
		      var yBox=parseInt(task.ganttElement.attr("y"));
		      var wBox=parseInt(task.ganttElement.attr("width"));
		      var hBox=parseInt(task.ganttElement.attr("height"));
		
		      pdf.setFillColor(rgb.r,rgb.g,rgb.b);
		
		      //si mostra critical
		      pdf.setLineWidth(3 * scaleFactor);
		      if (self.master.showCriticalPath && task.isCritical) {
		        pdf.setDrawColor(255, 0, 0);
		      } else {
		        pdf.setDrawColor(rgb.r,rgb.g,rgb.b);
		      }
		
		      pdf.rect(marginLeft+gridBoxWidth+xBox*scaleFactor,marginTop+yBox*scaleFactor,wBox*scaleFactor,hBox*scaleFactor,"FD")
		
		      //parent tasks black group bar
		      if(task.isParent()) {
		        pdf.setFillColor(0, 0, 0);
		        pdf.rect(marginLeft + gridBoxWidth + xBox * scaleFactor, marginTop + yBox * scaleFactor, wBox * scaleFactor, 3 * scaleFactor, "F")
		      }
		
		      //progress
		      if(task.progress>0) {
		        var scur=50;
		        pdf.setFillColor(rgb.r>scur?rgb.r-scur:0,rgb.g>scur?rgb.g-scur:0,rgb.b>scur?rgb.b-scur:0);
		        var wProgPx = wBox * ((task.progress > 100 ? 100 : task.progress) / 100);
		        pdf.rect(marginLeft + gridBoxWidth + xBox * scaleFactor, marginTop + (yBox+4) * scaleFactor, wProgPx *scaleFactor, (hBox-8) * scaleFactor, "F")
		        pdf.setFontSize( 10*scaleFactor/pointInMillimeters);
		        pdf.setTextColor(rbgContrast.r,rbgContrast.g,rbgContrast.b);
		        if(wBox>30)
		          pdf.text(marginLeft +gridBoxWidth + ( xBox + Math.min( wProgPx+3, wBox-30) ) * scaleFactor, marginTop + (yBox+13) * scaleFactor, task.progress+"%");
		        pdf.setTextColor(0,0,0);
		      }
		
		      //start milestone
		      if (task.startIsMilestone){
		        pdf.addImage(getMilestoneImage(),marginLeft+gridBoxWidth+(xBox-9)*scaleFactor,marginTop+yBox*scaleFactor,18*scaleFactor,18*scaleFactor)
		      }
		
		      //end milestone
		      if (task.endIsMilestone){
		        pdf.addImage(getMilestoneImage(),marginLeft+gridBoxWidth+(xBox+wBox-9)*scaleFactor,marginTop+yBox*scaleFactor,18*scaleFactor,18*scaleFactor)
		      }
		
		    }
		  }
		
		
		  function setGridLineAttributes() {
		    pdf.setLineWidth(1 * scaleFactor)
		    pdf.setDrawColor(240, 240, 240);
		  }
		
		
		  function drawLinks() {
		    var criticalLinks = [];
		    for (var i = 0; i < self.master.links.length; i++) {
		      var link = self.master.links[i];
		      if (!link.from.rowElement.is(":visible") || !link.to.rowElement.is(":visible") || link.from.hidden_visibility || link.to.hidden_visibility)
		        continue;
		
		      if (self.master.showCriticalPath && link.from.isCritical && link.to.isCritical) {
		        criticalLinks.push(link);
		        continue;
		      }
		      drawSingleLink(link, false);
		    }
		
		    for (var i = 0; i < criticalLinks.length; i++) {
		      var link = criticalLinks[i];
		      if (!link.from.rowElement.is(":visible") || !link.to.rowElement.is(":visible"))
		        continue;
		
		      drawSingleLink(link, true);
		    }
		
		  }
		
		  function drawSingleLink(link,critical) {
		    var ps = 10 * scaleFactor; //pedunculus
		    var r = 5 * scaleFactor; //radius
		    var arrowOffset = 0;//5* scaleFactor;
		    pdf.setLineWidth(3 * scaleFactor);
		
		    var rectFrom = link.from.ganttElement;
		    var rectTo = link.to.ganttElement;
		
		    if (critical) {
		      pdf.setDrawColor(255, 0, 0);
		      pdf.setFillColor(255, 0, 0);
		    } else {
		      pdf.setDrawColor(47, 151, 198);
		      pdf.setFillColor(47, 151, 198);
		    }
		
		    //console.debug(link.from.name+" -> "+link.to.name)
		    var rectHeight = parseInt(rectFrom.attr("height")) * scaleFactor;
		
		    var fx1 = parseInt(rectFrom.attr("x")) * scaleFactor;
		    var fx2 = fx1 + parseInt(rectFrom.attr("width")) * scaleFactor;
		    var fy = rectHeight / 2 + parseInt(rectFrom.attr("y")) * scaleFactor;
		
		    var tx1 = parseInt(rectTo.attr("x")) * scaleFactor;
		    var tx2 = tx1 + parseInt(rectTo.attr("width")) * scaleFactor;
		    var ty = (parseInt(rectTo.attr("height")) / 2 + parseInt(rectTo.attr("y"))) * scaleFactor;
		
		    var tooClose = tx1 < fx2 + 2 * ps;
		    var up = fy > ty ? -1 : 1;
		
		    var prev = fx2 + 2 * ps > tx1;
		    var fprev = prev ? -1 : 1;
		
		    if (tooClose) {
		      var firstLine = up * (rectHeight / 2 - 2 * r + 2 * scaleFactor);
		
		      //pdf.line((fx2) * scaleFactor, (fy) * scaleFactor,(tx1) * scaleFactor, (ty) * scaleFactor);
		      pdf.lines([
		        [ps, 0],
		        [0, 0, r, 0, r, up * r],
		        [0, firstLine],
		        [0, 0, 0, up * r, -r, up * r],
		        [fprev * 2 * ps + (tx1 - fx2), 0],
		        [0, 0   , -r , 0, -r , up * r  ],
		        [0, ((Math.abs(ty - fy) - 4 * r - Math.abs(firstLine)) * up - arrowOffset) ],
		        [0, 0   , 0, up * r , r , up * r  ],
		        [ps , 0]
		      ], marginLeft + gridBoxWidth + fx2, marginTop + fy);
		
		    } else {
		      pdf.lines([
		        [((tx1 - fx2) / 2 - r) , 0],
		        [0, 0   , r , 0, r , up * r  ],
		        [0, ty - fy - up * 2 * r + arrowOffset ],
		        [0, 0   , 0, up * r , r , up * r  ],
		        [((tx1 - fx2) / 2 - r) , 0]
		      ], marginLeft + gridBoxWidth + fx2, marginTop + fy);
		    }
		
		    //arrow
		
		    pdf.triangle(
		        marginLeft + gridBoxWidth + tx1, marginTop + ty,
		        marginLeft + gridBoxWidth + tx1 - r, marginTop + ty - r / 2,
		        marginLeft + gridBoxWidth + tx1 - r, marginTop + ty + r / 2, "FD");
		
		  }
		
		  function getMilestoneImage(){
		    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAYdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjEuNv1OCegAAAB1SURBVDhPrc7RCYAwDEXRruIAztiRuodLKRGv0JImafTC+8jPIcWr1nrKnjOXAK21e2kMhFLYiNASNkMohHkImVgUIRWbIce+dRvrMOsTD5Je7DfI+sqDOoSsz7RUhKKYiZCHhRCaYUsIjVgKIbBPCAngI6Vcag9a/4PPbvQAAAAASUVORK5CYII=";
		  }
		
		
		  function drawControlBars(left,top){
		    //console.debug("drawControlBars");
		    var checkBarGroup=self.master.progressCheckBar.checkBarGroup;
		
		    var collapsedDescendant = self.master.getCollapsedDescendant();
		
		    var lineCount=0;
		    for (var checkBarLabel in self.master.progressCheckBar.checkBars) {
		      //var checkBarDate=Date.parseString(checkBarLabel);
		      var points = self.master.progressCheckBar.checkBars[checkBarLabel].points; // sono i millisecondi corrispondente al progress del progetto
		      var color = self.master.progressCheckBar.checkBars[checkBarLabel].color;
		
		      // conversione colore
		      var hsl=color.replace(/[^0-9,]/g,"").split(","); //-> ["180","70","50"]
		      var rgb=hslToRgb(parseInt(hsl[0]),parseInt(hsl[1])/100,parseInt(hsl[2])/100);
		
		      pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
		      pdf.setFillColor(rgb.r, rgb.g, rgb.b);
		      pdf.setTextColor(rgb.r, rgb.g, rgb.b);
		      pdf.setLineWidth(0.1);
		
		      //array dei punti della linea pdf. Sono in coordinate relative a partire dal punto iniziale
		      var pdfPoints=[];
		
		      //si converte il millisecondo di analisi in x assoluto svg
		      var tmX= Math.round((Date.parseString(checkBarLabel) - self.master.gantt.startMillis) * self.master.gantt.fx);
		      var startX=Math.max(0,tmX);
		
		      // si parte sopra la barra della data
		      pdfPoints.push([0,headerHeight]);
		
		      var lastPdfY=headerHeight;
		
		      var x=startX;
		
		      for (var i=0;i<points.length;i++){
		        var task = self.master.tasks[i];
		        if (collapsedDescendant.indexOf(task) < 0) {
		          var svgx = Math.max(0,Math.round((points[i] - self.master.gantt.startMillis) * self.master.gantt.fx));
		          pdfPoints.push([(svgx - x) * scaleFactor,0]);
		          pdfPoints.push([0,self.master.rowHeight* scaleFactor]);
		          x = Math.max(0, svgx);
		          lastPdfY+=self.master.rowHeight* scaleFactor;
		        }
		      }
		
		      //si aggiunge un baffo in fondo per poter scrivere la data
		      pdfPoints.push([(startX-x)*scaleFactor,0]);
		      pdfPoints.push([0,lineCount*3+3]);
		
		      //si disegna la poly-linea
		      pdf.lines(pdfPoints, marginLeft + gridBoxWidth+startX*scaleFactor, marginTop );
		
		      //si mette label data
		      pdf.text(checkBarLabel,marginLeft + gridBoxWidth+startX*scaleFactor + 1,marginTop+lastPdfY+lineCount*3+4);
		
		      lineCount++;
		    }
		  }
		}
	}
	return gantt_pdf;
})