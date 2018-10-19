/*global history */
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/routing/History"
], function (Controller, History) {
	"use strict";

	return Controller.extend("pnp.survey.controller.BaseController", {
		/**
		 * Convenience method for accessing the router in every controller of the application.
		 * @public
		 * @returns {sap.ui.core.routing.Router} the router for this component
		 */
		getRouter: function () {
			return this.getOwnerComponent().getRouter();
		},

		/**
		 * Convenience method for getting the view model by name in every controller of the application.
		 * @public
		 * @param {string} sName the model name
		 * @returns {sap.ui.model.Model} the model instance
		 */
		getModel: function (sName) {
			return this.getView().getModel(sName);
		},

		/**
		 * Convenience method for setting the view model in every controller of the application.
		 * @public
		 * @param {sap.ui.model.Model} oModel the model instance
		 * @param {string} sName the model name
		 * @returns {sap.ui.mvc.View} the view instance
		 */
		setModel: function (oModel, sName) {
			return this.getView().setModel(oModel, sName);
		},

		/**
		 * Convenience method for getting the resource bundle.
		 * @public
		 * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
		 */
		getResourceBundle: function () {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		/**
		 * Event handler for navigating back.
		 * It there is a history entry we go one step back in the browser history
		 * If not, it will replace the current entry of the browser history with the master route.
		 * @public
		 */
		onNavBack: function () {
			var sPreviousHash = History.getInstance().getPreviousHash();

			if (sPreviousHash !== undefined) {
				history.go(-1);
			} else {
				this.getRouter().navTo("master", {}, true);
			}
		},

		/**
		 * Send message using message strip
		 * @private
		 */
		sendStripMessage: function (sText, sType) {

			//message handling
			this.oMessageStrip.setText(sText);
			this.oMessageStrip.setType(sType);
			this.oMessageStrip.setVisible(true);

		},

		//set entity messages
		setEntityMessages: function (aMessages) {

			//remove all messages from the message manager
			this.oMessageManager.removeAllMessages();

			//add messages to message popover
			aMessages.forEach(function (oMessage) {
				this.oMessageManager.addMessages(
					new sap.ui.core.message.Message({
						message: oMessage.MessageText,
						description: "Take note",
						code: oMessage.MessageCode,
						type: oMessage.MessageType,
						processor: this.oMessageProcessor
					})
				);
			}.bind(this));

		},

		//prepare message popover for display
		prepareMessagePopoverForDisplay: function () {

			//construct popover for message display
			var oMessagePopover = new sap.m.MessagePopover({

				//messages in item aggregation
				items: {
					path: "message>/",
					template: new sap.m.MessagePopoverItem({
						type: "{message>type}",
						title: "{message>message}",
						description: "{message>description}"
					})
				},

				//destroy after close
				afterClose: function () {
					oMessagePopover.destroy();
				}

			});

			//connect message model to message popover
			oMessagePopover.setModel(this.oMessageManager.getMessageModel(), "message");

			//feedback to caller
			return oMessagePopover;

		},

		/**
		 * Messages button press event handler
		 * @function
		 * @private
		 */
		onMessagesButtonPress: function (oEvent) {

			//initialize variables
			var oMessagesButton = oEvent.getSource();

			//prepare message popover for display
			var oMessagePopover = this.prepareMessagePopoverForDisplay();

			//toggle message popover display
			oMessagePopover.toggle(oMessagesButton);

		},

		//render OData error response to detail message page
		renderODataErrorResponseToDetailMessagePage: function (oError) {

			//for exception handling
			try {

				//parse error response		
				var oErrorText = JSON.parse(oError.responseText);

				//clear master list selection state
				this.getOwnerComponent().oListSelector.clearMasterListSelection();

				//error encountered
				this.getRouter().getTargets().display("detailObjectMessage", {
					messageText: oErrorText.error.message.value,
					messageType: "Error"
				});

				//set view to no longer busy
				this.oViewModel.setProperty("/busy", false);

				//exception handling
			} catch (exception) {
				//explicitly none
			}

		},

		//render OData error response to message popover button
		renderODataErrorResponseToMessagePopoverButton: function (oResponse) {

			//for exception handling
			try {

				//format response text for display in error message details
				var oResponseText = JSON.parse(oResponse.responseText);

				//adopt error attributes into message	
				var oMessage = {};
				oMessage.MessageText = oResponseText.error.message.value;
				oMessage.MessageType = "Error";

				//push to messages array
				var aMessages = [];
				aMessages.push(oMessage);

				//set message to message popover button
				this.setEntityMessages(aMessages);

				//set view to no longer busy
				this.oViewModel.setProperty("/busy", false);

				//exception handling
			} catch (exception) {
				//explicitly none
			}

		},

		//check for and visualize errors in BatchResponses
		hasODataBatchErrorResponse: function (aBatchResponses) {

			//local data declaration
			var oMessage = {};
			var aMessages = [];

			//no further processing where input not type compliant
			if (!Array.isArray(aBatchResponses)) {
				return false;
			}

			//for each batchResponse
			aBatchResponses.forEach(function (oBatchResponse) {

				//where a batchResponse is contained
				if (oBatchResponse.response) {

					//by type of HTTP ok code
					switch (oBatchResponse.response.statusCode) {

						//where HTTP ok code is 400 "Bad Request"
					case "400":

						//interprese backend error
						if (oBatchResponse.response.body) {

							//for exception handling
							try {

								//parse response body containing error
								var oResponseBody = JSON.parse(oBatchResponse.response.body);

								//construct message
								if (oResponseBody.error) {

									//adopt error attributes into message	
									oMessage.MessageText = oResponseBody.error.message.value;
									oMessage.MessageCode = oResponseBody.error.code;
									oMessage.MessageType = "Error";

									//push to messages array
									aMessages.push(oMessage);

								}

								//exception handling: failed to parse
							} catch (oException) {
								//explicitly none
							}

						}

					}

				}

			});

			//message handling
			if (aMessages.length > 0) {

				//set messages to message popover button
				this.setEntityMessages(aMessages);

				//set view to no busy
				this.oViewModel.setProperty("/busy", false);

				//feedback to caller: errors occured
				return true;

			}

			//feedback to caller: no errors occured
			return false;

		}

	});

});