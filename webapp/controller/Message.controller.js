sap.ui.define([
	"pnp/survey/controller/BaseController",
	"sap/ui/model/json/JSONModel",
], function (BaseController, JSONModel) {
	"use strict";

	return BaseController.extend("pnp.survey.controller.Message", {

		//initialize this controller
		onInit: function () {

			//create view model and set on view
			this.oViewModel = new JSONModel({});
			this.getView().setModel(this.oViewModel, "MessageModel");

			//attach display event handler
			this.getRouter().getTarget("detailObjectMessage").attachDisplay(this._onMessageDisplayed, this);

		},

		//display message page
		_onMessageDisplayed: function (oEvent) {

			//local data declaration
			var sMessageIcon;

			//adopt message text from navigation
			var oNavData = oEvent.getParameter("data");

			//set view model message text attribute
			this.oViewModel.setProperty("/sMessageText", oNavData.messageText);

			//derive message icon
			switch (oNavData.messageType) {
			case "Error":
				sMessageIcon = "sap-icon://message-error";
				break;
			case "Warning":
				sMessageIcon = "sap-icon://message-warning"
				break;
			case "Information":
				sMessageIcon = "sap-icon://message-information";
				break;
			}

			//set view model message icon attribute
			this.oViewModel.setProperty("/sMessageIcon", sMessageIcon);

		}

	});

});