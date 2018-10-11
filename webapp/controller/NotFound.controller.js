sap.ui.define([
	"pnp/survey/controller/BaseController"
	], function (BaseController) {
		"use strict";

		return BaseController.extend("pnp.survey.controller.NotFound", {

			onInit: function () {
				this.getRouter().getTarget("notFound").attachDisplay(this._onNotFoundDisplayed, this);
			},

			_onNotFoundDisplayed : function () {
					this.getModel("appView").setProperty("/layout", "OneColumn");
			}
		});
	}
);