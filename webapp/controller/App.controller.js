sap.ui.define([
	"pnp/survey/controller/BaseController",
	"sap/ui/model/json/JSONModel"
], function (BaseController, JSONModel) {
	"use strict";

	return BaseController.extend("pnp.survey.controller.App", {

		//on initialization of this controller
		onInit: function () {

			//local data declaration
			var fnSetAppNotBusy,
				iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();

			//create a model to control UI behaviour
			this.oViewModel = new JSONModel({
				busy: true,
				delay: 0,
				layout: "OneColumn",
				previousLayout: "",
				actionButtonsInfo: {
					midColumn: {
						fullScreen: false
					}
				}
			});

			//set model to view
			this.setModel(this.oViewModel, "appView");

			//utility method to visualize view as no longer busy
			fnSetAppNotBusy = function () {
				this.oViewModel.setProperty("/busy", false);
				this.oViewModel.setProperty("/delay", iOriginalBusyDelay);
			}.bind(this);

			// since then() has no "reject"-path attach to the MetadataFailed-Event to disable the busy indicator in case of an error
			this.getOwnerComponent().getModel("SurveyModel").metadataLoaded().then(fnSetAppNotBusy);
			this.getOwnerComponent().getModel("SurveyModel").attachMetadataFailed(fnSetAppNotBusy);

			// apply content density mode to root view
			this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());

		}

	});
});