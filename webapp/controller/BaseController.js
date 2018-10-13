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

		}

	});

});