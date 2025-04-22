/*global QUnit*/

sap.ui.define([
	"com/invoicecreationairdit/invoicecreationairdit/controller/InvoiceLists.controller"
], function (Controller) {
	"use strict";

	QUnit.module("InvoiceLists Controller");

	QUnit.test("I should test the InvoiceLists controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
