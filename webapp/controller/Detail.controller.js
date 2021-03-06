/*global location */
sap.ui.define([
	"pnp/survey/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"pnp/survey/model/formatter",
	"sap/ui/model/Filter"
], function (BaseController, JSONModel, formatter, Filter) {
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
			this.oSurveyModel = this.getOwnerComponent().getModel("SurveyModel");

			//initiate interaction with message manager	
			this.oMessageProcessor = new sap.ui.core.message.ControlMessageProcessor();
			this.oMessageManager = sap.ui.getCore().getMessageManager();
			this.oMessageManager.registerMessageProcessor(this.oMessageProcessor);

			//keep track that from now on detail controller is leading view controller
			this.getOwnerComponent().oLeadingViewController = this;

			//once-off preparation for first view display
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

			//local data declaration
			var aFilters = [];

			//remove all messages from the message manager
			this.oMessageManager.removeAllMessages();

			//get navigational input for survey display
			var oNavData = oEvent.getParameter("data");

			//create filter array for survey retrieval
			for (var property in oNavData) {
				aFilters.push(new Filter({
					path: property,
					operator: "EQ",
					value1: oNavData[property]
				}));
			}

			//bind detail view to selected survey
			this.oSurveyModel.metadataLoaded().then(function () {

				//set view model to busy
				this.oViewModel.setProperty("/busy", true);

				//construct object key for this survey
				var sSurveyKey = this.oSurveyModel.createKey("Surveys", oNavData);

				//construct survey details for rendering
				this.oSurveyModel.read("/" + sSurveyKey, {

					//url parameters
					urlParameters: {
						"$expand": "toQuestions,toQuestions/toAnswers,toAnswerTemplates,toAnswerTemplates/toAnswerTemplateOptions"
					},

					//filters
					filters: aFilters,

					//success callback handler
					success: function (oData, oResponse) {

						//local data declaration
						var iQuestionNumber = 0;

						//construct suitable JSON model
						var oSurvey = {
							SurveyID: oData.SurveyID,
							TopicID: oData.TopicID,
							TopicTypeID: oData.TopicTypeID,
							AnchorID: oData.AnchorID,
							AnchorTypeID: oData.AnchorTypeID,
							ParticipantID: oData.ParticipantID,
							ParticipantTypeID: oData.ParticipantTypeID,
							TopicText: oData.TopicText,
							AnchorText: oData.AnchorText,
							isEditable: oData.isEditable,
							isPersisted: oData.isPersisted,
							iOptional: oData.isOptional,
							isSelfSurvey: oData.isSelfSurvey
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

										//format answer template attributes
										oAnswerTemplate.AnswerRangeTo = Number(oAnswerTemplate.AnswerRangeTo);
										oAnswerTemplate.AnswerRangeFrom = Number(oAnswerTemplate.AnswerRangeFrom);
										oAnswerTemplate.AnswerRangeIncrement = Number(oAnswerTemplate.AnswerRangeIncrement);

										//merge with rating previously provided
										if (oQuestion.toAnswers) {

											//where answers have been provided
											if (oQuestion.toAnswers.results.length > 0) {

												//adopt answers
												oQuestion.toAnswers = oQuestion.toAnswers.results;

												//format answers
												oQuestion.toAnswers.forEach(function (oAnswer) {
													oAnswer.AnswerOptionValue = Number(oAnswer.AnswerOptionValue);
													oAnswer.bGiven = true;
												});

											}

										}

										//no answers have previously been provided
										if (!oQuestion.toAnswers || (oQuestion.toAnswers.results && oQuestion.toAnswers.results.length === 0)) {

											//construct initial answer from template
											oQuestion.toAnswers = [{
												SurveyID: oSurvey.SurveyID,
												QuestionID: oQuestion.QuestionID,
												AnswerID: this.getUUID(),
												AnchorID: oSurvey.AnchorID,
												AnchorTypeID: oSurvey.AnchorTypeID,
												TopicID: oSurvey.TopicID,
												TopicTypeID: oSurvey.TopicTypeID,
												ParticipantID: oSurvey.ParticipantID,
												ParticipantTypeID: oSurvey.ParticipantTypeID,
												AnswerOptionValue: oAnswerTemplate.AnswerRangeFrom,
												isPersisted: false
											}];

										}

									}

								}

							}.bind(this));

						}.bind(this));

						//set model to view
						this.oSubmissionModel = new JSONModel(oSurvey);
						this.getView().setModel(this.oSubmissionModel, "SubmissionModel");

						//bind view to object instance
						this.getView().bindElement({
							path: "/",
							model: "SubmissionModel"
						}, {});

						//force refresh of UI binding
						this.getModel("SubmissionModel").refresh(true);

						//set enabled state of survey UI input controls 
						this.oViewModel.setProperty("/isEditable", oSurvey.isEditable);

						//set enabled state of survey UI input controls 
						this.oViewModel.setProperty("/isSubmitEnabled", false);

						//set message where survey no longer editable
						if (!oSurvey.isEditable) {

							//inform that this survey can't be edited
							this.setEntityMessages([{
								MessageText: this.getResourceBundle().getText("messageSurveyNoLongerEditable"),
								MessageType: "Information"
							}]);

						}

						//set the layout property of flexible column layout control to show two columns
						this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");

						//set view model to no longer busy
						this.oViewModel.setProperty("/busy", false);

					}.bind(this),

					//error callback handler
					error: function (oError) {

						//render error to detail message page
						this.renderODataErrorResponseToDetailMessagePage(oError);

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

			//get state of whether flexible layout control is in fullscreen 
			var bFullScreen = this.getModel("appView").getProperty("/actionButtonsInfo/midColumn/fullScreen");

			//toggle fullscreen button according to current state
			this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", !bFullScreen);

			//toggle view layout
			if (!bFullScreen) {

				// store current layout and go full screen
				this.getModel("appView").setProperty("/previousLayout", this.getModel("appView").getProperty("/layout"));
				this.getModel("appView").setProperty("/layout", "MidColumnFullScreen");

				// reset to previous layout				
			} else {

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

			//flag this question as answered
			oQuestion.toAnswers.forEach(function (oAnswer) {
				oAnswer.bGiven = true;
			});

			//force refresh of submission model bindings
			this.getModel("SubmissionModel").refresh(true);

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
					if (!oAnswer.bGiven) {
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

			//cleanup of changes remaining from previous submission attempt
			if (this.oSurveyModel.hasPendingChanges()) {
				this.oSurveyModel.resetChanges();
			}

			//get survey being filled in
			var oSurvey = this.getView().getBindingContext("SubmissionModel").getObject();

			//for each question in this survey
			oSurvey.toQuestions.forEach(function (oQuestion) {

				//check whether all questions have been answered
				oQuestion.toAnswers.forEach(function (oAnswer) {

					/*format answer option value to string where applicable.
					  This is required for NW Gateway type compliance*/
					if (typeof oAnswer.AnswerOptionValue !== 'string') {
						oAnswer.AnswerOptionValue = oAnswer.AnswerOptionValue.toString();
					}

					//Create or change answer depending on persistance state
					switch (oAnswer.isPersisted) {

						//answer previously persisted
					case true:

						//create key for each answer in survey OData model
						var sAnswerKey = this.oSurveyModel.createKey("Answers", oAnswer);

						//adopt answer attribute for create
						for (var sProperty in oAnswer) {
							if (sProperty !== "__metadata" && sProperty !== "bGiven") {
								this.oSurveyModel.setProperty("/" + sAnswerKey + "/" + sProperty, oAnswer[sProperty]);
							}
						}

						//no further processing here
						break;

						//answer not previously persisted
					case false:

						//delete client answer entity attribute 'bGiven'
						delete oAnswer.bGiven;

						//create entry for submission to backend
						this.oSurveyModel.createEntry("Answers", {
							properties: oAnswer
						});

					}

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

					//clear master list selection state
					this.getOwnerComponent().oListSelector.clearMasterListSelection();
					this.getOwnerComponent().oListSelector.refreshMasterListBinding();

					//set view to no longer busy
					this.oViewModel.setProperty("/busy", false);

					//message handling: successfully submitted
					this.getRouter().getTargets().display("detailObjectMessage", {
						messageText: this.getResourceBundle().getText("messageSurveySubmittedSuccessfully"),
						messageType: "Success"
					});

				}.bind(this),

				//success callback function
				error: function (oError) {

					//render OData error response
					this.renderODataErrorResponseToMessagePopoverButton(oError);

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

		},

		//controller decision whether to handle an OData service error
		delegatesODataErrorHandling: function (sStatusCode) {

			//all OData service errors handled in this controller
			return false;

		}

	});

});