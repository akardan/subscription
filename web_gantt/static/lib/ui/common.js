

// Instance root for all component
var message = message || {};
var FE = {
	FN : function() {
	},
	LOADING : '<span class="fa fa-spinner fa-pulse fa-3x"/>',
	sys : {
		path : ''
	},
	url : function(url) {
		return this.sys.path + url;
	},
	zero : function(n) {
		return n > 9 ? n : '0' + n;
	},
	escape : function(s) {
		s = $.trim(s).replace(/&/g, '&amp;').replace(/'/g, '&apos;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
				.replace(/>/g, '&gt;');
		return '\"' + s + '\"';
	},
	trim : function(s) {
		return $.trim(s).replace(/\s{2,}/, ' ');
	},
	compare : function(a, b) {
		if (!(isNaN(a) || isNaN(b))) {
			a = parseFloat(a);
			b = parseFloat(b);
		}
		return a > b ? 1 : a < b ? -1 : 0;
	},
	has : {},
	is : {
		input : function(elem) {
			var tag = elem.tagName;
			return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
		},
		number : function(n) {
			return !isNaN(parseFloat(n)) && isFinite(n);
		},
		empty : function(val) {
			if (val == null) {
				return true;
			}
			if (typeof val === 'string') {
				val = val.trim().length === 0;
				return val;
			}
			if (val instanceof Array) {
				val = val.length === 0;
				return val;
			}
			return false;
		}
	},
	getTime : Date.now || function() {
		return new Date().getTime();
	},
	getId : function(id) {
		return $(document.getElementById(id));
	}
};

(function($, FE) {
	var vendors = [ "webkit", "Moz", "ms", "O" ];
	var _style = document.createElement("div").style;

	$.support.touch = 'ontouchend' in document;
	$.support.placeholder = 'placeholder' in document.createElement('input');
	$.support._css3 = {};
	$.support.css3 = function(name) {
		var o = $.support._css3[name];
		if (o != null) {
			return o;
		}

		var name2 = name.charAt(0).toUpperCase() + name.substr(1);
		var transform, i = 0, l = vendors.length;
		for (; i < l; i++) {
			transform = vendors[i] + name2;
			if (transform in _style) {
				return $.support._css3[name] = transform;
			}
		}

		if (name in _style) {
			return $.support._css3[name] = name;
		}

		return $.support._css3[name] = false;
	};

	$.scrollTo = function(top, interval, fn) {
		if (interval === undefined) {
			interval = 500;
		}
		$('html:not(:animated),body:not(:animated)').animate({
			scrollTop : top - 20
		}, interval, fn);
		return false;
	};

	$.fn.scrollTo = function(interval, fn) {
		var off = this.offset();
		if (off) {
			$.scrollTo(off.top, interval, fn);
		}
	};

	$.fn.exists = function() {
		return this.length > 0;
	};

	$.fn.disabled = function(dis) {
		var o = this;
		var k = 'disabled';

		if (dis != null) {
			if (dis) {
				o.data(k, true).attr(k, 'on');
			} else {
				o.removeData(k).attr(k, null);
			}
			return o;
		} else {
			dis = o.data(k);

			if (dis == null) {
				if (o.attr(k) != null || o.hasClass('ui-state-disabled')) {
					o.data(k, true);
					dis = true;
				} else {
					dis = false;
				}
			}
			return dis;
		}
	};

	$.fn.ok = function(action) {
		var changed = true, unbind = false, elem;
		if (action.jquery) {
			elem = action;
		} else {
			elem = this;
			elem.bind('onok', action);
		}
		this.bind('keyup', function(e) {
			if (e.keyCode == 13) {
				var events = $._data(elem[0], 'events');
				if (events == null || events.onok == null) {
					$(this).unbind(e);
					unbind = true;
				} else if (changed) {
					changed = false;
					elem.triggerHandler('onok');
				}
				e.preventDefault();
			} else {
				changed = true;
			}
		}).bind('blur', function(e) {
			if (unbind) {
				$(this).unbind(e);
			} else {
				changed = true;
			}
		}).bind('change', function(e) {
			if (unbind) {
				$(this).unbind(e);
			} else {
				changed = true;
			}
		});
	};

	$.fn.removeFellow = function(id) {
		if (id === undefined) {
			this.removeData('fellows');
		} else {
			var fellows = elem.data('fellows');
			if (fellows != null) {
				delete fellows[id];
			}
		}
		return elem;
	};

	$.fn.getFellow = function(id) {
		var elem = this;
		var fellows = elem.data('fellows');
		if (fellows == null) {
			fellows = {};
			elem.data('fellows', fellows);
		}
		var my = fellows[id];

		if (my == null || my.data('fellowBy') == null) {
			my = elem.getId(id).data('fellowBy', elem);
			fellows[id] = my;
		}
		return my;
	};

	$.fn.getFellowName = function(id) {
		var elem = this;
		var fellows = elem.data('fellows');
		if (fellows == null) {
			fellows = {};
			elem.data('fellows', fellows);
		}

		var my = fellows[id];
		if (my == null || my.data('fellowBy') == null) {
			my = elem.find('[name=' + id + ']').data('fellowBy', elem);
			fellows[id] = my;
		}
		return my;
	};

	$.fn.getId = function(id) {
		return this.find('#' + id);
	};

	FE.BLANK = FE.url(FE.BLANK);
	FE.AS = FE.url(FE.AS);

	FE.events = {
		dialog : {
			centerHalfFn : function(e) {
				var elem = $(this);
				var h = window.screen.availHeight - elem.dialog('widget').outerHeight();
				if (h <= 0) {
					h = 0;
				} else {
					h = h / 4;
				}
				elem.dialog('option', 'position', [ 'center', h ]).unbind(e);
			},
			centerHalf : function(o) {
				o.bind('dialogopen', this.centerHalfFn);
			}
		}
	};

	FE.dialog = function(elem, op) {
		if (op.inline) {
			op.modal = false;
			op.draggable = false;
			op.resizable = false;
			if (op.inlineRoot) {
				if (!op.inlineRoot.jquery) {
					op.inlineRoot = FE.getFellow(op.inlineRoot);
				}
				op.width = 'auto';
			}
		} else if (op.centerHalf) {
			this.events.dialog.centerHalf(elem);
		}
		if (!op.show && op.modal) {
			op.show = 'fade';
		}
		var create = op.create;
		op.create = function(e) {
			if (create) {
				create(e, this);
			}
			if (op.saveCancel) {
				elem.saveCancel(op.saveCancel);
			} else if (op.saveLanguage) {
				elem.saveLanguage(op.saveLanguage);
			}
			if (op.inline) {
				var dialog = elem.parent().addClass('j-window-inline');
				if (op.inlineRoot) {
					dialog.appendTo(op.inlineRoot);
				}
			}
		};
		if (op.height == null && op.minHeight == null) {
			op.minHeight = 'auto';
		}
		return elem.dialog(op);
	};
})(window.jQuery, window.FE);

/*
 * ! jQuery UI Touch Punch 0.2.3
 * 
 * Copyright 2011–2014, Dave Furfero Dual licensed under the MIT or GPL Version
 * 2 licenses.
 * 
 * Depends: jquery.ui.widget.js jquery.ui.mouse.js
 */
(function($) {
	// Ignore browsers without touch support
	if (!$.support.touch) {
		return;
	}

	function _touchFix() {
		this.prevent = true;
		return this;
	}

	_touchFix.prototype = {
		touchstart : function(touch) {
			this.screenX = touch.screenX;
			this.screenY = touch.screenY;
			this.clientX = touch.clientX;
			this.clientY = touch.clientY;
		},
		touchmove : function(touch) {
		}
	};

	var mouseProto = $.ui.mouse.prototype, _mouseInit = mouseProto._mouseInit, _mouseDestroy = mouseProto._mouseDestroy, touchHandled;

	/**
	 * Simulate a mouse event based on a corresponding touch event
	 * 
	 * @param {Object}
	 *            event A touch event
	 * @param {String}
	 *            simulatedType The corresponding mouse event
	 */
	function simulateMouseEvent(touch, event, simulatedType, preventDefault) {

		// Ignore multi-touch events
		if (event.originalEvent.touches.length > 1) {
			return;
		}

		var simulatedEvent = document.createEvent('MouseEvents');
		var target = $(event.target);

		if (preventDefault) {
			if (target.is("input") || target.is("textarea")) {
				event.stopPropagation();
			} else {
				event.preventDefault();
			}
		}

		// Initialize the simulated mouse event using the touch event's
		// coordinates
		simulatedEvent.initMouseEvent(simulatedType, // type
		true, // bubbles
		true, // cancelable
		window, // view
		1, // detail
		touch.screenX, // screenX
		touch.screenY, // screenY
		touch.clientX, // clientX
		touch.clientY, // clientY
		false, // ctrlKey
		false, // altKey
		false, // shiftKey
		false, // metaKey
		0, // button
		null // relatedTarget
		);

		// Dispatch the simulated event to the target element
		event.target.dispatchEvent(simulatedEvent);
	}

	/**
	 * Handle the jQuery UI widget's touchstart events
	 * 
	 * @param {Object}
	 *            event The widget element's touchstart event
	 */
	mouseProto._touchStart = function(event) {
		var touch = event.originalEvent.changedTouches[0];

		// Ignore the event if another widget is already being handled
		if (touchHandled || !this._mouseCapture(touch)) {
			return;
		}

		// Set the flag to prevent other widgets from inheriting the touch event
		touchHandled = true;
		this._touchMoved = false;

		// Track movement to determine if interaction was a click
		$.touchFix = new _touchFix();
		$.touchFix.touchstart(touch);

		// Simulate the mouseover event
		simulateMouseEvent(touch, event, 'mouseover');

		// Simulate the mousemove event
		simulateMouseEvent(touch, event, 'mousemove');

		// Simulate the mousedown event
		simulateMouseEvent(touch, event, 'mousedown');
	};

	/**
	 * Handle the jQuery UI widget's touchmove events
	 * 
	 * @param {Object}
	 *            event The document's touchmove event
	 */
	mouseProto._touchMove = function(event) {
		// Ignore event if not handled
		if (!touchHandled) {
			return;
		}
		var touch = event.originalEvent.changedTouches[0];

		// Interaction was not a click
		this._touchMoved = true;
		var touchFix = $.touchFix;
		touchFix.touchmove(touch);

		if (touchFix.touch) {
			touch = touchFix.touch;
		}

		// Simulate the mousemove event
		simulateMouseEvent(touch, event, 'mousemove', touchFix.prevent);
	};

	/**
	 * Handle the jQuery UI widget's touchend events
	 * 
	 * @param {Object}
	 *            event The document's touchend event
	 */
	mouseProto._touchEnd = function(event) {
		// Ignore event if not handled
		if (!touchHandled) {
			return;
		}

		var touch = event.originalEvent.changedTouches[0];

		// Simulate the mouseup event
		simulateMouseEvent(touch, event, 'mouseup', true);

		// Simulate the mouseout event
		simulateMouseEvent(touch, event, 'mouseout', true);

		// If the touch interaction did not move, it should trigger a click
		if (!this._touchMoved) {

			// Simulate the click event
			simulateMouseEvent(touch, event, 'click', true);
		}

		// Unset the flag to allow other widgets to inherit the touch event
		touchHandled = false;
	};

	/**
	 * A duck punch of the $.ui.mouse _mouseInit method to support touch events.
	 * This method extends the widget with bound touch event handlers that
	 * translate touch events to mouse events and pass them to the widget's
	 * original mouse event handling methods.
	 */
	mouseProto._mouseInit = function() {

		var self = this;

		// Delegate the touch handlers to the widget's element
		self.element.bind({
			touchstart : $.proxy(self, '_touchStart'),
			touchmove : $.proxy(self, '_touchMove'),
			touchend : $.proxy(self, '_touchEnd')
		});

		// Call the original $.ui.mouse init method
		_mouseInit.call(self);
	};

	/**
	 * Remove the touch event handlers
	 */
	mouseProto._mouseDestroy = function() {

		var self = this;

		// Delegate the touch handlers to the widget's element
		self.element.unbind({
			touchstart : $.proxy(self, '_touchStart'),
			touchmove : $.proxy(self, '_touchMove'),
			touchend : $.proxy(self, '_touchEnd')
		});

		// Call the original $.ui.mouse destroy method
		_mouseDestroy.call(self);
	};

}($ || jQuery));