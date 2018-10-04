// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as githubIssuesDialog from './dialogs/githubIssuesDialog';

const { ActivityTypes } = require('botbuilder');

const { LuisRecognizer } = require('botbuilder-ai');

const { TextPrompt, DialogSet } = require('botbuilder-dialogs');

// State Accessor Properties
const DIALOG_STATE_PROPERTY = 'dialogState';

async function noMatch(turnContext) {
  await turnContext.sendActivity(`No LUIS intents were found.
    \nThis sample is about identifying two user intents:
    \n - 'Get issues'
    \n - 'Get PRs'
    \nTry typing 'Add Event' or 'Show me tomorrow'.`);
}

/**
 * Demonstrates the following concepts:
 *  Displaying a Welcome Card, using Adaptive Card technology
 *  Use LUIS to model Greetings, Help, and Cancel interations
 *  Use a Waterflow dialog to model multi-turn conversation flow
 *  Use custom prompts to validate user input
 *  Store conversation and user state
 *  Handle conversation interruptions
 */
export default class OrbyBot {
  /**
   * Creates a OrbyBot.
   *
   * @param {ConversationState} conversationState property accessor
   * @param {UserState} userState property accessor
   * @param {BotConfiguration} botConfig contents of the .bot file
   */
  constructor(
    conversationState,
    userState,
    application,
    luisPredictionOptions,
  ) {
    this.luisRecognizer = new LuisRecognizer(
      application,
      luisPredictionOptions,
      true,
    );

    this.dialogState = conversationState.createProperty(DIALOG_STATE_PROPERTY);
    const prompt = 'textPrompt';
    this.dialogs = new DialogSet(this.dialogState);
    this.dialogs.add(new TextPrompt(prompt));
    this.dialogs.add(githubIssuesDialog.dialog(prompt));

    this.conversationState = conversationState;
    this.userState = userState;
  }

  /**
   * Driver code that does one of the following:
   * 1. Display a welcome message upon startup
   * 2. Start a greeting dialog
   * 3. Optionally handle Cancel or Help interruptions
   *
   * @param {Context} context turn context from the adapter
   */
  async onTurn(turnContext) {
    const dc = await this.dialogs.createContext(turnContext);
    // By checking the incoming Activity type, the bot only calls LUIS in appropriate cases.
    if (turnContext.activity.type === ActivityTypes.Message) {
      // Perform a call to LUIS to retrieve results for the user's message.
      const results = await this.luisRecognizer.recognize(turnContext);
      // Since the LuisRecognizer was configured to include the raw results, get the `topScoringIntent` as specified by LUIS.
      const topIntent = results.luisResult.topScoringIntent;

      const dialogResult = await dc.continueDialog();

      console.log('Continue Dialog: ', dialogResult);

      // If no one has responded,
      if (!dc.context.responded) {
        if (topIntent.score < 0.3) {
          await noMatch(turnContext);
        } else {
          switch (topIntent.intent) {
            case githubIssuesDialog.INTENT:
              await dc.beginDialog(githubIssuesDialog.INTENT);
              break;
            case 'None': {
              await noMatch(turnContext);
              break;
            }
            default: {
              console.log('Top intent: ', topIntent);
              await turnContext.sendActivity(
                `LUIS Top Scoring Intent: ${topIntent.intent}, Score: ${
                  topIntent.score
                }`,
              );
              break;
            }
          }
        }
      }
    } else if (
      turnContext.activity.type === ActivityTypes.ConversationUpdate &&
      turnContext.activity.recipient.id !==
        turnContext.activity.membersAdded[0].id
    ) {
      // If the Activity is a ConversationUpdate, send a greeting message to the user.
      await turnContext.sendActivity(
        'Welcome to the NLP with LUIS sample! Send me a message and I will try to predict your intent.',
      );
    } else if (turnContext.activity.type !== ActivityTypes.ConversationUpdate) {
      // Respond to all other Activity types.
      await turnContext.sendActivity(
        `[${turnContext.activity.type}]-type activity detected.`,
      );
    }
    // Make sure to persist state at the end of a turn.
    await this.userState.saveChanges(turnContext);
    await this.conversationState.saveChanges(turnContext);
  }
}
