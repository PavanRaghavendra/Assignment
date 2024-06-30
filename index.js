require('dotenv').config();
const { App, ExpressReceiver } = require('@slack/bolt');
const express = require('express');
const helmet = require('helmet');

// Initialize the Slack app with ExpressReceiver
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
});
const expressApp = receiver.app;

// Middleware
expressApp.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
expressApp.use(express.json());
expressApp.set('trust proxy', 1);

// Handle the global shortcut
app.shortcut('send_message_shortcut', async ({ shortcut, ack, client }) => {
  try {
    await ack();
    const result = await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'send_message_modal',
        title: {
          type: 'plain_text',
          text: 'InternBit Assignment'
        },
        close: {
    type: "plain_text",
    text: "Cancel"
  },
        blocks: [
          {
            type: 'input',
            block_id: 'user_select',
            label: {
              type: 'plain_text',
              text: 'Select a user'
            },
            element: {
              type: 'users_select',
              action_id: 'selected_user'
            }
          },
          {
            type: 'input',
            block_id: 'message_input',
            label: {
              type: 'plain_text',
              text: 'Message'
            },
            element: {
              type: 'plain_text_input',
              action_id: 'message',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Write something... (Markdown supported)'
              }
            }
          }
        ],
        submit: {
          type: 'plain_text',
          text: 'Submit'
        }
      }
    });
    console.log('Modal opened successfully', { user: shortcut.user.id });
  } catch (error) {
    console.log('Error opening modal:', error);
  }
});

// Handle the modal submission
app.view('send_message_modal', async ({ ack, body, view, client }) => {
  try {
    await ack();
    const selectedUser = view.state.values.user_select.selected_user.selected_user;
    const message = view.state.values.message_input.message.value;

    // Send the message
    await client.chat.postMessage({
      channel: selectedUser,
      text: message
    });

    // Confirmation message
    await client.chat.postMessage({
      channel: body.user.id,
      text: `Your message has been sent to <@${selectedUser}>.`
    });

    console.log('Message sent successfully', { sender: body.user.id, recipient: selectedUser });
  } catch (error) {
    console.log('Error handling modal submission:', error);
    // Notify the user of the error
    await client.chat.postMessage({
      channel: body.user.id,
      text: "There was an error sending your message. Please try again later."
    });
  }
});

// Error handling middleware
expressApp.use((err, req, res, next) => {
  console.log('Unhandled error:', err);
  res.status(500).send('An unexpected error occurred');
});

// Set up the Express route to handle Slack events
expressApp.post('/slack/events', async (req, res) => {
  if (req.body.type === 'url_verification') {
    res.json({ challenge: req.body.challenge });
  } else {
    try {
      // Log the received payload for debugging
      console.log('Received Slack event:', JSON.stringify(req.body));

      // Check if the payload has an 'event' property
      if (req.body.event) {
        await app.event(req.body.event.type, async ({ event, body, say }) => {
          // Handle the event here
          console.log(`Received ${event.type} event`);
          // You can add specific event handling logic here
        })(req.body);
      } else {
        // If there's no 'event' property, try to process it as a general payload
        await app.handleIncomingEvent(req.body);
      }

      res.sendStatus(200);
    } catch (error) {
      console.log('Error processing event:', error);
      res.sendStatus(500);
    }
  }
});

// Start the Express server
const port = process.env.PORT || 3002;
expressApp.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Start the Slack app
(async () => {
  await app.start();
  console.log('Bolt app is running!');
})();