odoo.define('viin_web_gantt.common', function(require) {
	"use strict";
	var common = {
		busyMask: null,
		busy: function(open, cls) {
			if (this.busyMask == null) {
				this.loadingMask();
				this.busyMask = true;
			}
			if (open === true) {
				this.open(cls);
			} else {
				this.close(cls);
			}
		},
		
		loadingMask: function() {
			this.count = 0;
			this.element = $('<div id="mask" class="noprint" style="z-index: 900;"/>');
			this.ganttWorkspace = $('.o_content');
			this.element.appendTo(this.ganttWorkspace);
		},
		
		showLoading: function() {
			this._size();
			this.element.show();
			var me = this;
			if (!me.warp) {
				me.warp = $('<div class="loading-warp">' + '<span class="fa fa-spinner fa-pulse fa-3x"/>' + '</div>').appendTo(me.element);
			}
			me._pos();
		},
		closeLoading: function() {
			this.element.hide();
            this.element.remove();
		},
		open: function(cls) {
			if (cls) {
				this.element.addClass(cls);
			}
			if (this.count === 0) {
				this.showLoading();
			}
			this.count++;
		},
		close: function(cls) {
            this.count = 0;
            this.closeLoading();
            this.busyMask = null;
            this.warp = null;
            delete this.element;
			if (cls) {
				this.element.removeClass(cls);
			}
		},
		_size: function() {
			var doc = this.ganttWorkspace;
			this.element.height(doc.height()).width(doc.width()).css({ top: doc.position().top + 'px', left: 0});
		},
		_pos: function() {
			var w = this.ganttWorkspace, top = (w.height() - this.warp.height()) / 2 + w.scrollTop(), left = (w.width())
					/ 2 + w.scrollLeft();	
			this.warp.css({
				position : 'absolute',
				top : top,
				left : left
			});
		}
	}
	return common;
})