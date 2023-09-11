odoo.define('viin_web_gantt.test_utils_create', function (require) {
"use strict";

/**
 * Create Test Utils
 *
 * This module defines various utility functions to help creating mock widgets
 *
 * Note that all methods defined in this module are exported in the main
 * testUtils file.
 */
var concurrency = require('web.concurrency');
var dom = require('web.dom');
var testUtilsMock = require('viin_web_gantt.test_utils_mock');
var Widget = require('web.Widget');
var testUtilsCreate = require('web.test_utils_create');


/**
 * Similar as createView, but specific for calendar views. Some calendar
 * tests need to trigger positional clicks on the DOM produced by fullcalendar.
 * Those tests must use this helper with option positionalClicks set to true.
 * This will move the rendered calendar to the body (required to do positional
 * clicks), and wait for a setTimeout(0) before returning, because fullcalendar
 * makes the calendar scroll to 6:00 in a setTimeout(0), which might have an
 * impact according to where we want to trigger positional clicks.
 *
 * @param {Object} params see @createView
 * @param {Object} [options]
 * @param {boolean} [options.positionalClicks=false]
 * @returns {Promise<CalendarController>}
 */
async function createViinGanttView(params, options) {
    var viin_gantt = await testUtilsCreate.createView(params);
    if (!options || !options.positionalClicks) {
        return viin_gantt;
    }
    var $view = $('#qunit-fixture').contents();
    $view.prependTo('body');
    var destroy = viin_gantt.destroy;
    viin_gantt.destroy = function () {
        $view.remove();
        destroy();
    };
    await concurrency.delay(0);
    return viin_gantt;
}

testUtilsCreate.createViinGanttView = createViinGanttView;
return testUtilsCreate;

});
