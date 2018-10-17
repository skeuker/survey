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
			this.getRouter().getTarget("detail").attachDisplay(this.onDisplay, this);

			//keep track of OData model
			this.oSurveyModel = this.getOwnerComponent().getModel("SurveyModel")

			//initiate interaction with message manager	
			this.oMessageProcessor = new sap.ui.core.message.ControlMessageProcessor();
			this.oMessageManager = sap.ui.getCore().getMessageManager();
			this.oMessageManager.registerMessageProcessor(this.oMessageProcessor);

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

			//remove all messages from the message manager
			this.oMessageManager.removeAllMessages();

			//bind detail view to selected survey
			var oNavData = oEvent.getParameter("data");
			this.oSurveyModel.metadataLoaded().then(function () {

				//construct object key for this survey
				var sSurveyKey = this.oSurveyModel.createKey("Surveys", oNavData);

				//construct survey details for rendering
				this.oSurveyModel.read("/" + sSurveyKey, {

					//url parameters
					urlParameters: {
						"$expand": "toQuestions,toQuestions/toAnswers,toAnswerTemplates,toAnswerTemplates/toAnswerTemplateOptions"
					},

					//success callback handler
					success: function (oData, oResponse) {

						//local data declaration
						var iQuestionNumber = 0;

						//construct suitable JSON model
						var oSurvey = {
							SurveyID: oData.SurveyID,
							TopicID: oData.TopicID,
							AnchorID: oData.AnchorID,
							ParticipantID: oData.ParticipantID,
							TopicText: oData.TopicText,
							AnchorText: oData.AnchorText,
							isEditable: oData.isEditable,
							isPersisted: oData.isPersisted
						};

						//questions are available
						if (oData.toQuestions) {
							oSurvey.toQuestions = oData.toQuestions.results;
						}

						//answerTemplates are available
						if (oData.toAnswerTemplates) {
							oSurvey.toAnswerTemplates = oData.toAnswerTemplates.results;
						}

						//formatting of answertemplate options
						if (oSurvey.toAnswerTemplates.length > 0) {
							oSurvey.toAnswerTemplates.forEach(function (oAnswerTemplate) {
								if (oAnswerTemplate.toAnswerTemplateOptions) {
									oAnswerTemplate.toAnswerTemplateOptions = oAnswerTemplate.toAnswerTemplateOptions.results;
								}
							});
						}

						//construct answers for each question
						oSurvey.toQuestions.forEach(function (oQuestion) {

							//do question numbering
							oQuestion.QuestionNumber = ++iQuestionNumber;

							//for each answer template
							oSurvey.toAnswerTemplates.forEach(function (oAnswerTemplate) {

								//answer template of question matches this answer template
								if (oQuestion.AnswerTemplateID === oAnswerTemplate.AnswerTemplateID) {

									//keep track of answer template
									oQuestion.toAnswerTemplate = oAnswerTemplate;

									//for answer template of type 'Range'
									if (oAnswerTemplate.AnswerTypeID === "Range") {

										//merge with rating previously provided
										if (oQuestion.toAnswers) {

											//where answers have been provided
											if (oQuestion.toAnswers.results.length > 0) {

												//adopt answers
												oQuestion.toAnswers = oQuestion.toAnswers.results;

												//format answers
												oQuestion.toAnswers.forEach(function (oAnswer) {
													oAnswer.AnswerOptionValue = Number(oAnswer.AnswerOptionValue);

												});

											}

										}

										//no answers have previously been provided
										if (!oQuestion.toAnswers || (oQuestion.toAnswers.results && oQuestion.toAnswers.results.length === 0)) {

											//construct initial answer from template
											oQuestion.toAnswers = [{
												AnswerOptionValue: null
											}];

										}

									}

								}

							});

						});

						//set model to view
						this.oSubmissionModel = new JSONModel(oSurvey);
						this.getView().setModel(this.oSubmissionModel, "SubmissionModel");

						//bind view to object instance
						this.getView().bindElement({
							path: "/",
							model: "SubmissionModel"
						}, {});

						//set enabled state of survey UI input controls and submit button
						this.oViewModel.setProperty("/isEditable", oSurvey.isEditable);
						this.oViewModel.setProperty("/isSubmitEnabled", this.isSurveyAnsweredCompletely());

						//set message where survey no longer editable
						if (!oSurvey.isEditable) {

							//inform that this survey can't be edited
							this.setEntityMessages([{
								MessageText: this.getResourceBundle().getText("messageSurveyNoLongerEditable"),
								MessageType: "Information"
							}]);

						}

						//set view model to no longer busy
						this.oViewModel.setProperty("/busy", false);

					}.bind(this)

				});

			}.bind(this));

		},

		//on change of detail view binding
		_onBindingChange: function () {

			//get view and view 'element binding'
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

		//handler for MetadataLoaded event
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

			//return to full screen master display
			this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", false);
			// No item should be selected on master after detail page is closed
			this.getOwnerComponent().oListSelector.clearMasterListSelection();
			this.getRouter().getTarget("master").display();

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
		},

		//on press show legend
		onPressShowLegend: function (oEvent) {

			//get related question
			var oPanel = oEvent.getSource().getParent().getParent();
			var oQuestion = oPanel.getBindingContext("SubmissionModel").getObject();
			var oLegendModel = new JSONModel(oQuestion.toAnswerTemplate);

			//create legend popover
			var oLegendPopover = sap.ui.xmlfragment("pnp.survey.fragment.AnswerLegendPopover", this);
			oLegendPopover.setModel(oLegendModel, "LegendModel");
			oLegendPopover.attachAfterClose(function () {
				oLegendPopover.destroy();
			});
			this.getView().addDependent(oLegendPopover);

			// delay because addDependent will do a async rerendering 
			var oSubmitSurveyButton = oEvent.getSource();
			jQuery.sap.delayedCall(0, this, function () {
				oLegendPopover.openBy(oSubmitSurveyButton);
			});

		},

		//upon using a slider to answer a question
		onSliderSetAnswer: function (oEvent) {

			//keep track that answer option value was set
			var oQuestion = oEvent.getSource().getBindingContext("SubmissionModel").getObject();

			//set enabled state of submit button
			this.oViewModel.setProperty("/isSubmitEnabled", this.isSurveyAnsweredCompletely());

		},

		//inspect whether survey is answered completely
		isSurveyAnsweredCompletely: function (oEvent) {

			//local data declaration
			var bAllQuestionsAnswered = true;

			//get survey being filled in
			var oSurvey = this.getView().getBindingContext("SubmissionModel").getObject();

			//for each question in this survey
			oSurvey.toQuestions.forEach(function (oQuestion) {

				//check whether all questions have been answered
				oQuestion.toAnswers.forEach(function (oAnswer) {
					if (oAnswer.AnswerOptionValue === null) {
						bAllQuestionsAnswered = false;
					}
				});

			});

			//feedback to caller
			return bAllQuestionsAnswered;

		},

		//event handler for button press to submit survey
		onPressSubmitSurvey: function () {

			//set view to busy
			this.oViewModel.setProperty("/busy", true);

			//get survey being filled in
			var oSurvey = this.getView().getBindingContext("SubmissionModel").getObject();

			//for each question in this survey
			oSurvey.toQuestions.forEach(function (oQuestion) {

				//check whether all questions have been answered
				oQuestion.toAnswers.forEach(function (oAnswer) {

					//create key for each answer in survey OData model
					var sAnswerKey = this.oSurveyModel.createKey("Answers", oAnswer);

					//create entry for submission to backend
					this.oSurveyModel.createEntry(sAnswerKey, {
						properties: oAnswer
					});

				}.bind(this));

			}.bind(this));

			//submit changes to the backend
			this.oSurveyModel.submitChanges({

				//success callback function
				success: function (oData) {

					//inspect batchResponses for errors and visualize
					if (this.hasODataBatchErrorResponse(oData.__batchResponses)) {
						return;
					}

					//set survey persisted property to update object page status
					this.oSubmissionModel.setProperty("/isPersisted", true);

					//message handling: survey submitted successfully
					this.setEntityMessages([{
						MessageText: this.getResourceBundle().getText("messageSurveySubmittedSuccessfully"),
						MessageType: "Success"
					}]);

					//disable form entry
					this.oViewModel.setProperty("/isSubmitEnabled", false);
					this.oViewModel.setProperty("/isEditable", false);

					//set view to no longer busy
					this.oViewModel.setProperty("/busy", false);

				}.bind(this)

			});

		},

		//on press show navigator
		onPressNavigateSurvey: function (oEvent) {

			//get related question
			var oSurvey = this.getView().getBindingContext("SubmissionModel").getObject();
			var oNavigateModel = new JSONModel(oSurvey);

			//create navigate popover
			var oNavigatePopover = sap.ui.xmlfragment("pnp.survey.fragment.SurveyNavigatePopover", this);
			oNavigatePopover.setModel(oNavigateModel, "NavigateModel");
			oNavigatePopover.attachAfterClose(function () {
				oNavigatePopover.destroy();
			});
			this.getView().addDependent(oNavigatePopover);

			//delay because addDependent will do a async rerendering 
			var oNavigateSurveyButton = oEvent.getSource();
			jQuery.sap.delayedCall(0, this, function () {
				oNavigatePopover.openBy(oNavigateSurveyButton);
			});

		},

		//on press navigate to questions
		onPressNavigateToQuestion: function (oEvent) {

			//get survey grid content
			var aGridContent = this.getView().byId("gridSurvey").getContent();

			//get number of selected question
			var aMatchGroups = /(\d)/.exec(oEvent.getSource().getText());

			//derive panel ID in this view
			var iPanelIndex = aMatchGroups[0] - 1;
			var sPageID = '#' + "detailPage";

			//set focus on requested question
			$(sPageID).scrollTop(10);

		}

	});

});