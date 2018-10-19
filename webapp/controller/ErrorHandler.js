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
			this._oResourceBundle = oComponent.getModel("i18n").getResourceBundle();
			this._oComponent = oComponent;
			this.oSurveyModel = oComponent.getModel("SurveyModel");
			this._bMessageOpen = false;
			this._sErrorText = this._oResourceBundle.getText("errorText");

			//attach error handler for metadata load failure
			this.oSurveyModel.attachMetadataFailed(function (oEvent) {
				var oParams = oEvent.getParameters();
				this._showServiceError(oParams.response);
			}, this);

			//attach error handler for service request error that is not handled with the application
			this.oSurveyModel.attachRequestFailed(function (oEvent) {

				//get service request failure event
				var oParams = oEvent.getParameters();

				/*Render all errors that are not classified as 'client errors'.
				  client errors are handled in controller callback functions*/
				if (!/^4/.test(oParams.response.statusCode) &&
					!/^5/.test(oParams.response.statusCode)) {
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
					styleClass: this._oComponent.getContentDensityClass(),
					actions: [MessageBox.Action.CLOSE],
					onClose: function () {
						this._bMessageOpen = false;
					}.bind(this)
				}
			);
		}

	});

});