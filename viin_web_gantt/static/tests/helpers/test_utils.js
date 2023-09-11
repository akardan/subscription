odoo.define('viin_web_gantt.test_utils', function (require) {
"use strict";

/**
 * Test Utils
 *
 * In this module, we define various utility functions to help simulate a mock
 * environment as close as possible as a real environment.  The main function is
 * certainly createView, which takes a bunch of parameters and give you back an
 * instance of a view, appended in the dom, ready to be tested.
 */

var testUtilsCreate = require('viin_web_gantt.test_utils_create');
var testUtils = require('web.test_utils');

testUtils.createViinGanttView = testUtilsCreate.createViinGanttView;
return testUtils;

});
