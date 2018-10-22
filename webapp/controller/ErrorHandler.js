sap.ui.define([
	"sap/ui/base/Object",
	"sap/m/MessageBox"
], function (UI5Object, MessageBox) {
	"use strict";

	return UI5Object.extend("pnp.survey.controller.ErrorHandler", {

		/**
		 * Handles application errors by automatically attaching to the model events and displaying errors when needed.
		 * @class
		 * @param {sap.ui.core.UIComponent} oComponent reference to the app's component
		 * @public
		 * @alias pnp.survey.controller.ErrorHandler
		 */
		constructor: function (oComponent) {

			//set instance attributes
			this._oResourceBundle = oComponent.getModel("i18n").getResourceBundle();
			this.oComponent = oComponent;
			this.oSurveyModel = oComponent.getModel("SurveyModel");
			this._bMessageOpen = false;
			this._sErrorText = this._oResourceBundle.getText("errorText");

			//attach error handler for metadata load failure
			this.oSurveyModel.attachMetadataFailed(function (oEvent) {
				var oParams = oEvent.getParameters();
				this._showServiceError(oParams.response);
			}, this);

			//attach error handler for unhandled OData service request errors
			this.oSurveyModel.attachRequestFailed(function (oEvent) {

				//get service request failure event
				var oParams = oEvent.getParameters();

				//decide whether to handle this error here
				var bHandledInViewController = false;
				if (this.oComponent.oLeadingViewController) {
					bHandledInViewController = this.oComponent.oLeadingViewController.isHandlingServiceError(oParams.response.statusCode);
				}

				//Render all errors not handled in view controllers
				if (!bHandledInViewController) {
					this._showServiceError(oParams.response);
				}

			}, this);

		},

		/**
		 * Shows a {@link sap.m.MessageBox} when a service call has failed.
		 * Only the first error message will be display.
		 * @param {string} sDetails a technical error to be displayed on request
		 * @private
		 */
		_showServiceError: function (sDetails) {
			if (this._bMessageOpen) {
				return;
			}
			this._bMessageOpen = true;
			MessageBox.error(
				this._sErrorText, {
					id: "serviceErrorMessageBox",
					details: sDetails,
					styleClass: this.oComponent.getContentDensityClass(),
					actions: [MessageBox.Action.CLOSE],
					onClose: function () {
						this._bMessageOpen = false;
					}.bind(this)
				}
			);
		}

	});

});