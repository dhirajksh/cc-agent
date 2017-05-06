var express = require('express'),
  twilio = require('twilio'),
  cfenv = require('cfenv'),
  speech = require('../lib/speech.js'),
  conversation = require('../lib/libConversation.js'),
  log = require('loglevel')
var url = cfenv.getAppEnv().url || 'localhost:3000'
var service = cfenv.getAppEnv().getService('twilio')
if(service == null) {
  service = {'credentials':{'accountSID':'AC4e26c9002783072ece845d15741803a7', 'authToken':'88c42dc337a7620037f84f665ffb5812'}};
}
var twilio_auth_token = service.credentials.authToken
var client = twilio(service.credentials.accountSID, service.credentials.authToken)

var router = express.Router()

// Used to store a map from call_ssid -> answers
var answers = {};
var contexts = {};

// Callback soup stitching together API services used to
// convert between an audio recording -> text -> watson answer.
var enqueue_question = function (recording) {
  var audio_location = recording.RecordingUrl,
    call_ssid = recording.CallSid

  speech.text(audio_location, function (question) {
    log.info(call_ssid + ' QUESTION: ' + question)
    conversation.doConversation(question, contexts[call_ssid], function (res) {
      log.info(call_ssid + ' ANSWER: ' + res.output.text[0]);
      answers[call_ssid] = res.output.text[0];
      contexts[call_ssid] = res.context;

      var forward_to = url + '/calls/answer'
      client.calls(call_ssid).update({
        // BUG: HTTPS locations are getting a 403 sent back...
        url: forward_to.replace('https', 'http')
      })
    })
  })
}

// Twilio callback handling. Set up routes for different parts of the phone
// call.
router.post('/', twilio.webhook(twilio_auth_token), function (req, res) {
  log.info(req.body.CallSid + '-> calls/')
  log.debug(req.body)

  var twiml = new twilio.TwimlResponse();
  twiml.say('Hello this is Watson Car assistant, how can I help you? Press any key after you have finished speaking')
    .record({timeout: 120, action: '/calls/recording'})
 
  res.send(twiml)
})

router.post('/holding', twilio.webhook(twilio_auth_token), function (req, res) {
  log.info(req.body.CallSid + '-> calls/holding')
  log.debug(req.body)

  var twiml = new twilio.TwimlResponse()
  twiml.pause({length: 5})
    .say("I'm still thinking")
    .redirect('/calls/holding')

  res.send(twiml)
})

router.post('/recording', twilio.webhook(twilio_auth_token), function (req, res) {
  log.info(req.body.CallSid + '-> calls/recording')
  log.debug(req.body)

  var twiml = new twilio.TwimlResponse()

  enqueue_question(req.body)

  twiml.say('Let me think about that.').redirect('/calls/holding')
  res.send(twiml)
})

router.post('/answer', twilio.webhook(twilio_auth_token), function (req, res) {
  log.info(req.body.CallSid + '-> calls/answer')
  log.debug(req.body)

  var twiml = new twilio.TwimlResponse()

  twiml.say(answers[req.body.CallSid])
    .say('Is there anything else I can help you with?')
    .record({timeout: 120, action: '/calls/recording'})

  res.send(twiml)
})

module.exports = router
