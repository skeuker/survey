/*global location */
sap.ui.define([
	"pnp/survey/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"pnp/survey/model/formatter"
], function (BaseController, JSONModel, formatter) {
	"use strict";

	return BaseController.extend("pnp.survey.controller.Detail", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {

			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			this.oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				lineItemListTitle: this.getResourceBundle().getText("detailLineItemTableHeading")
			});
			this.setModel(this.oViewModel, "detailView");

			//attach to display event for survey detail
			this.getRouter().getTarget("object").attachDisplay(this.onDisplay, this);

			//keep track of OData model
			this.oSurveyModel = this.getOwnerComponent().getModel("SurveyModel")

			this.getOwnerComponent().getModel("SurveyModel").metadataLoaded().then(this._onMetadataLoaded.bind(this));
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Event handler when the share by E-Mail button has been clicked
		 * @public
		 */
		onSendEmailPress: function () {
			var oViewModel = this.getModel("detailView");

			sap.m.URLHelper.triggerEmail(
				null,
				oViewModel.getProperty("/shareSendEmailSubject"),
				oViewModel.getProperty("/shareSendEmailMessage")
			);
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		onDisplay: function (oEvent) {

			//format master detail view display
			this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");

			//bind detail view to selected survey
			var oNavData = oEvent.getParameter("data");
			this.oSurveyModel.metadataLoaded().then(function () {

				//construct object key for this survey
				var sSurveyKey = this.oSurveyModel.createKey("Surveys", oNavData);

				//construct survey details for rendering
				this.oSurveyModel.read("/" + sSurveyKey, {

					//url parameters
					urlParameters: {
						"$expand": "toQuestions,toAnswerTemplates,toAnswerTemplateOptions,toSubmissions"
					},

					//success callback handler
					success: function (oData, oResponse) {

						//construct suitable JSON model
						var oSurvey = {
							SurveyID: oData.SurveyID,
							TopicID: oData.TopicID,
							AnchorID: oData.AnchorID,
							TopicText: oData.TopicText,
							ParticipantID: oData.ParticipantID
						};

						//questions are available
						if (oData.toQuestions) {
							oSurvey.toQuestions = oData.toQuestions.results;
						}

						//answerTemplates are available
						if (oData.toAnswerTemplates) {
							oSurvey.toAnswerTemplates = oData.toAnswerTemplates.results;
						}

						//answerTemplateOptoins are available
						if (oData.toAnswerTemplateOptions) {
							oSurvey.toAnswerTemplateOptions = oData.toAnswerTemplateOptions.results;
						}

						//submissions are available
						if (oData.toSubmissions) {
							oSurvey.toSubmissions = oData.toSubmissions.results;
						}

						//construct answers for each question
						oSurvey.toQuestions.forEach(function (oQuestion) {

							//for each answer template
							oSurvey.toAnswerTemplates.forEach(function (oAnswerTemplate) {

								//answer template of question matches this answer template
								if (oQuestion.AnswerTemplateID === oAnswerTemplate.AnswerTemplateID) {

									//for answer template of type 'Range'
									if (oAnswerTemplate.AnswerTypeID === "Range") {

										//construct answer
										oQuestion.toAnswer = {
											AnswerRangeFrom: oAnswerTemplate.AnswerRangeFrom,
											AnswerRangeTo: oAnswerTemplate.AnswerRangeTo
										}

										//provide legend for answer options
										if (oSurvey.toAnswerTemplateOptions) {

											//initialize this answers options
											oQuestion.toAnswer.toAnswerOptions = [];

											//for each answer template option
											oSurvey.toAnswerTemplateOptions.forEach(function (oOption) {

												//matching this answer template
												if (oOption.AnswerTemplateID === oAnswerTemplate.AnswerTemplateID) {
													oQuestion.toAnswer.toAnswerOptions.push({
														AnswerOptionID: oOption.AnswerOptionID,
														AnswerOptionHint: oOption.AnswerOptionHint
													});
												}

											});

										}

									}

								}

							});

						});

						//set model to view
						this.oSubmissionModel = new JSONModel(oSurvey);
						this.getView().setModel(this.oSubmissionModel, "SubmissionModel");

						//set view model to no longer busy
						this.oViewModel.setProperty("/busy", false);

					}.bind(this)

				});

			}.bind(this));

		},

		_onBindingChange: function () {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("detailObjectNotFound");
				// if object could not be found, the selection in the master list
				// does not make sense anymore.
				this.getOwnerComponent().oListSelector.clearMasterListSelection();
				return;
			}

			var sPath = oElementBinding.getPath(),
				oResourceBundle = this.getResourceBundle(),
				oObject = oView.getModel("SurveyModel").getObject(sPath),
				sObjectId = oObject.SurveyID,
				sObjectName = oObject.TopicID,
				oViewModel = this.getModel("detailView");

			this.getOwnerComponent().oListSelector.selectAListItem(sPath);

			oViewModel.setProperty("/shareSendEmailSubject",
				oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
			oViewModel.setProperty("/shareSendEmailMessage",
				oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
		},

		_onMetadataLoaded: function () {

			// Store original busy indicator delay for the detail view
			var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
				oViewModel = this.getModel("detailView");

			// Make sure busy indicator is displayed immediately when
			// detail view is displayed for the first time
			oViewModel.setProperty("/delay", 0);
			oViewModel.setProperty("/lineItemTableDelay", 0);

			// Binding the view will set it to not busy - so the view is always busy if it is not bound
			oViewModel.setProperty("/busy", true);
			// Restore original busy indicator delay for the detail view
			oViewModel.setProperty("/delay", iOriginalViewBusyDelay);

		},

		/**
		 * Set the full screen mode to false and navigate to master page
		 */
		onCloseDetailPress: function () {
			this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", false);
			// No item should be selected on master after detail page is closed
			this.getOwnerComponent().oListSelector.clearMasterListSelection();
			this.getRouter().navTo("master");
		},

		/**
		 * Toggle between full and non full screen mode.
		 */
		toggleFullScreen: function () {
			var bFullScreen = this.getModel("appView").getProperty("/actionButtonsInfo/midColumn/fullScreen");
			this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", !bFullScreen);
			if (!bFullScreen) {
				// store current layout and go full screen
				this.getModel("appView").setProperty("/previousLayout", this.getModel("appView").getProperty("/layout"));
				this.getModel("appView").setProperty("/layout", "MidColumnFullScreen");
			} else {
				// reset to previous layout
				this.getModel("appView").setProperty("/layout", this.getModel("appView").getProperty("/previousLayout"));
			}
		}
	});

});