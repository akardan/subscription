odoo.define('viin_web_gantt.test_utils_mock', function(require) {
	"use strict";

	/**
	 * Mock Test Utils
	 *
	 * This module defines various utility functions to help mocking data.
	 *
	 * Note that all methods defined in this module are exported in the main
	 * testUtils file.
	 */
	
	var basic_fields = require('web.basic_fields');
	var config = require('web.config');
	var core = require('web.core');
	var dom = require('web.dom');
	var MockServer = require('web.MockServer');
	var session = require('web.session');
	
	var DebouncedField = basic_fields.DebouncedField;
	var testUtilsMock = require('web.test_utils_mock');
	
	//------------------------------------------------------------------------------
	// Private functions
	//------------------------------------------------------------------------------
	
	/**
	 * logs all event going through the target widget.
	 *
	 * @param {Widget} widget
	 */
	function _observe(widget) {
	    var _trigger_up = widget._trigger_up.bind(widget);
	    widget._trigger_up = function (event) {
	        console.log('%c[event] ' + event.name, 'color: blue; font-weight: bold;', event);
	        _trigger_up(event);
	    };
	}
	
	//------------------------------------------------------------------------------
	// Public functions
	//------------------------------------------------------------------------------
	
	/**
	 * Removes the src attribute on images and iframes to prevent not found errors,
	 * and optionally triggers an rpc with the src url as route on a widget.
	 * This method is critical and must be fastest (=> no jQuery, no underscore)
	 *
	 * @param {DOM Node} el
	 * @param {[Widget]} widget the widget on which the rpc should be performed
	 */
	function removeSrcAttribute(el, widget) {
	    var nodes;
	    if (el.nodeName === 'IMG' || el.nodeName === 'IFRAME') {
	        nodes = [el];
	    } else {
	        nodes = Array.prototype.slice.call(el.getElementsByTagName('img'))
	            .concat(Array.prototype.slice.call(el.getElementsByTagName('iframe')));
	    }
	    var node;
	    while (node = nodes.pop()) {
	        var src = node.attributes.src && node.attributes.src.value;
	        if (src && src !== 'about:blank') {
	            node.setAttribute('data-src', src);
	            if (node.nodeName === 'IMG') {
	                node.attributes.removeNamedItem('src');
	            } else {
	                node.setAttribute('src', 'about:blank');
	            }
	            if (widget) {
	                widget._rpc({ route: src });
	            }
	            $(node).trigger('load');
	        }
	    }
	}
	
	/**
	* @override
	 */
	function addMockEnvironment(widget, params) {
	    var Server = MockServer;
	    params.services = params.services || {};
	    if (params.mockRPC) {
	        Server = MockServer.extend({ _performRpc: params.mockRPC });
	    }
	    if (params.debug) {
	        _observe(widget);
	        var separator = window.location.href.indexOf('?') !== -1 ? "&" : "?";
	        var url = window.location.href + separator + 'testId=' + QUnit.config.current.testId;
	        console.log('%c[debug] debug mode activated', 'color: blue; font-weight: bold;', url);
	    }
	
	    var mockServer = new Server(params.data, {
	        actions: params.actions,
	        archs: params.archs,
	        currentDate: params.currentDate,
	        debug: params.debug,
	        widget: widget,
	    });
	
	    // make sure images do not trigger a GET on the server
	    $('body').on('DOMNodeInserted.removeSRC', function (event) {
			if(event.target.nodeType != Node.COMMENT_NODE) {
				removeSrcAttribute(event.target, widget);
			}
	    });
	
	    // make sure the debounce value for input fields is set to 0
	    var initialDebounceValue = DebouncedField.prototype.DEBOUNCE;
	    DebouncedField.prototype.DEBOUNCE = params.fieldDebounce || 0;
	    var initialDOMDebounceValue = dom.DEBOUNCE;
	    dom.DEBOUNCE = 0;
	    var initialSession, initialConfig, initialParameters, initialDebounce, initialThrottle;
	    initialSession = _.extend({}, session);
	    session.getTZOffset = function () {
	        return 0; // by default, but may be overridden in specific tests
	    };
	    if ('session' in params) {
	        _.extend(session, params.session);
	    }
	    if ('config' in params) {
	        initialConfig = _.clone(config);
	        initialConfig.device = _.clone(config.device);
	        if ('device' in params.config) {
	            _.extend(config.device, params.config.device);
	        }
	        if ('debug' in params.config) {
	            odoo.debug = params.config.debug;
	        }
	    }
	    if ('translateParameters' in params) {
	        initialParameters = _.extend({}, core._t.database.parameters);
	        _.extend(core._t.database.parameters, params.translateParameters);
	    }
	    if (params.debounce === false) {
	        initialDebounce = _.debounce;
	        _.debounce = function (func) {
	            return func;
	        };
	    }
	    if (!('throttle' in params) || !params.throttle) {
	        initialThrottle = _.throttle;
	        _.throttle = function (func) {
	            return func;
	        };
	    }
	
	    var widgetDestroy = widget.destroy;
	    widget.destroy = function () {
	        // clear the caches (e.g. data_manager, ModelFieldSelector) when the
	        // widget is destroyed, at the end of each test to avoid collisions
	        core.bus.trigger('clear_cache');
	
	        Object.keys(services).forEach(function(s) {
	            var service = services[s];
	            if (service && !service.isDestroyed())
	                service.destroy();
	        });
	
	        DebouncedField.prototype.DEBOUNCE = initialDebounceValue;
	        dom.DEBOUNCE = initialDOMDebounceValue;
	        if (params.debounce === false) {
	            _.debounce = initialDebounce;
	        }
	        if (!('throttle' in params) || !params.throttle) {
	            _.throttle = initialThrottle;
	        }
	
	        var key;
	        if ('session' in params) {
	            for (key in session) {
	                delete session[key];
	            }
	        }
	        _.extend(session, initialSession);
	        if ('config' in params) {
	            for (key in config) {
	                delete config[key];
	            }
	            _.extend(config, initialConfig);
	        }
	        if ('translateParameters' in params) {
	            for (key in core._t.database.parameters) {
	                delete core._t.database.parameters[key];
	            }
	            _.extend(core._t.database.parameters, initialParameters);
	        }
	
	        $('body').off('DOMNodeInserted.removeSRC');
	        $('body').removeClass('debug');
	        $('.blockUI').remove();
	
	        widgetDestroy.call(this);
	    };
	
	    // Dispatch service calls
	    // Note: some services could call other services at init,
	    // Which is why we have to init services after that
	    var services = {};
	    testUtilsMock.intercept(widget, 'call_service', function (ev) {
	        var args, result;
	        if (services[ev.data.service]) {
	            var service = services[ev.data.service];
	            args = (ev.data.args || []);
	            result = service[ev.data.method].apply(service, args);
	        } else if (ev.data.service === 'ajax' && ev.data.method === 'rpc') {
	            // use ajax service that is mocked by the server
	            var route = ev.data.args[0];
	            args = ev.data.args[1];
	            result = mockServer.performRpc(route, args);
	        }
	        ev.data.callback(result);
	    });
	
	    testUtilsMock.intercept(widget, 'load_action', function (event) {
	        mockServer.performRpc('/web/action/load', {
	            kwargs: {
	                action_id: event.data.actionID,
	                additional_context: event.data.context,
	            },
	        }).then(function (action) {
	            event.data.on_success(action);
	        });
	    });
	
	    testUtilsMock.intercept(widget, "load_views", function (event) {
	        mockServer.performRpc('/web/dataset/call_kw/' + event.data.modelName, {
	            args: [],
	            kwargs: {
	                context: event.data.context,
	                options: event.data.options,
	                views: event.data.views,
	            },
	            method: 'load_views',
	            model: event.data.modelName,
	        }).then(function (views) {
	            views = _.mapObject(views, function (viewParams) {
	                return fieldsViewGet(mockServer, viewParams);
	            });
	            event.data.on_success(views);
	        });
	    });
	
	    testUtilsMock.intercept(widget, "get_session", function (event) {
	        event.data.callback(session);
	    });
	
	    testUtilsMock.intercept(widget, "load_filters", function (event) {
	        if (params.debug) {
	            console.log('[mock] load_filters', event.data);
	        }
	        event.data.on_success([]);
	    });
	
	    // make sure all Odoo events bubbling up are intercepted
	    if ('intercepts' in params) {
	        _.each(params.intercepts, function (cb, name) {
	            testUtilsMock.intercept(widget, name, cb);
	        });
	    }
	
	    // Deploy services
	    var done = false;
	    var servicesToDeploy = _.clone(params.services);
	    if (!servicesToDeploy.ajax) {
	        services.ajax = null; // use mocked ajax from mocked server
	    }
	    while (!done) {
	        var serviceName = _.findKey(servicesToDeploy, function (Service) {
	            return !_.some(Service.prototype.dependencies, function (depName) {
	                return !_.has(services, depName);
	            });
	        });
	        if (serviceName) {
	            var Service = servicesToDeploy[serviceName];
	            var service = services[serviceName] = new Service(widget);
	            delete servicesToDeploy[serviceName];
	
	            testUtilsMock.intercept(service, "get_session", function (event) {
	                event.data.callback(session);
	            });
	
	            service.start();
	        } else {
	            var serviceNames = _.keys(servicesToDeploy);
	            if (serviceNames.length) {
	                console.warn("Non loaded services:", serviceNames);
	            }
	            done = true;
	        }
	    }
	
	    return mockServer;
	}
	
	/**
	 * performs a fields_view_get, and mocks the postprocessing done by the
	 * data_manager to return an equivalent structure.
	 *
	 * @param {MockServer} server
	 * @param {Object} params
	 * @param {string} params.model
	 * @returns {Object} an object with 3 keys: arch, fields and viewFields
	 */
	function fieldsViewGet(server, params) {
	    var fieldsView = server.fieldsViewGet(params);
	    // mock the structure produced by the DataManager
	    fieldsView.viewFields = fieldsView.fields;
	    fieldsView.fields = server.fieldsGet(params.model);
	    return fieldsView;
	}
	
	testUtilsMock.addMockEnvironment = addMockEnvironment;
	
	return testUtilsMock;
	
});