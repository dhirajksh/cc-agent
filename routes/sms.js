var express = require('express'),
  twilio = require('twilio'),
  cfenv = require('cfenv'),
  log = require('loglevel')

var service = cfenv.getAppEnv().getService('twilio')
if(service == null) {
  service = {'credentials':{'accountSID':'AC4e26c9002783072ece845d15741803a7', 'authToken':'88c42dc337a7620037f84f665ffb5812'}};
}
var twilio_auth_token = service.credentials.authToken

var router = express.Router()

// Twilio callback handling. Set up routes for different parts of the phone
// call.
router.post('/', twilio.webhook(twilio_auth_token), function (req, res) {
  log.info(req.body.MessageSid + '-> sms/')

  var twiml = new twilio.TwimlResponse()

  log.info(req.body.MessageSid + ' QUESTION: ' + req.body.Body)
  doctor.ask(req.body.Body, function (answer) {
    log.info(req.body.MessageSid + ' ANSWER: ' + answer)

    twiml.message(answer)
    res.send(twiml)
  })

})

module.exports = router
