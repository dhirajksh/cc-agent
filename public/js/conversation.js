// The ConversationPanel module is designed to handle
// all display and behaviors of the conversation column of the app.
/* eslint no-unused-vars: "off" */
/* global Api: true, Common: true*/

 // initial load
  var $userInput;
  $(document).ready(function() {
      $userInput = $('#textInput');
      $('.input-btn').click(conductConversation);
      /*$userInput.keyup(function(event){
          if(event.keyCode === 13) {
              conductConversation();
          }
      });*/
  });

  function conductConversation() {
	  var context;
      var latestResponse = Api.getResponsePayload();
      if (latestResponse) {
        context = latestResponse.context;
      }

      // Send the user message
      Api.sendRequest($userInput.val(), context);

      // Clear input box for further messages
      $userInput.val('');
  }


var ConversationPanel = (function() {
  var audio;
  var settings = {
    selectors: {
      chatBox: '#scrollingChat',
      fromUser: '.from-user',
      fromWatson: '.from-watson',
      latest: '.latest'
    },
    authorTypes: {
      user: 'user',
      watson: 'watson'
    }
  };

  // Publicly accessible methods defined
  return {
    init: init,
    inputKeyDown: inputKeyDown,
    startDictation: startDictation,
    conductConversation: conductConversation
	};

  // Initialize the module
  function init() {
    //***********************************************
    // Text to Speech Integration - START
    //***********************************************
    var voice = 'en-US_AllisonVoice';

    audio = $('.audio').get(0);

    //***********************************************
    // Text to Speech Integration - END
    //***********************************************
    chatUpdateSetup();
    Api.sendRequest( '', null );
    setupInputBox();
  }
  // Set up callbacks on payload setters in Api module
  // This causes the displayMessage function to be called when messages are sent / received
  function chatUpdateSetup() {
    var currentRequestPayloadSetter = Api.setRequestPayload;
    Api.setRequestPayload = function(newPayloadStr) {
      currentRequestPayloadSetter.call(Api, newPayloadStr);
	  displayMessage(JSON.parse(newPayloadStr), settings.authorTypes.user);
    };
    var currentResponsePayloadSetter = Api.setResponsePayload;
    Api.setResponsePayload = function(newPayloadStr) {
      currentResponsePayloadSetter.call(Api, newPayloadStr);
      displayMessage(JSON.parse(newPayloadStr), settings.authorTypes.watson);
    };
  }

  function setupInputBox() {
    var input = document.getElementById('textInput');
    var dummy = document.getElementById('textInputDummy');
    var padding = 3;

    if (dummy === null) {
      var dummyJson = {
        'tagName': 'div',
        'attributes': [{
          'name': 'id',
          'value': 'textInputDummy'
        }]
      };

      dummy = Common.buildDomElement(dummyJson);
      ['font-size', 'font-style', 'font-weight', 'font-family', 'line-height', 'text-transform', 'letter-spacing'].forEach(function(index) {
        dummy.style[index] = window.getComputedStyle( input, null ).getPropertyValue( index );
      });

      document.body.appendChild(dummy);
    }

    input.addEventListener('input', function() {
      if (this.value === '') {
        this.classList.remove('underline');
        this.setAttribute('style', 'width:' + '90%');
        this.style.width = '90%';
      } else {
        this.classList.add('underline');
        var txtNode = document.createTextNode(this.value);
        dummy.textContent = txtNode.textContent;
        var widthValue = ( dummy.offsetWidth + padding) + 'px';
        this.setAttribute('style', 'width:' + widthValue);
        this.style.width = widthValue;
      }
    });

    Common.fireEvent(input, 'input');
  }

  // Display a user or Watson message that has just been sent/received
  function displayMessage(newPayload, typeValue) {
    var isUser = isUserMessage(typeValue);
	
    var textExists = (newPayload.input && newPayload.input.text)
      || (newPayload.output && newPayload.output.text);
    if (isUser !== null && textExists) {
		if (!isUser) {
			text2Speech(newPayload.output.text);
		}
	  // Create new message DOM element
      var messageDivs = buildMessageDomElements(newPayload, isUser);
      var chatBoxElement = document.querySelector(settings.selectors.chatBox);
      var previousLatest = chatBoxElement.querySelectorAll((isUser
              ? settings.selectors.fromUser : settings.selectors.fromWatson)
              + settings.selectors.latest);
      // Previous "latest" message is no longer the most recent
      if (previousLatest) {
        Common.listForEach(previousLatest, function(element) {
          element.classList.remove('latest');
        });
      }
      messageDivs.forEach(function(currentDiv) {
        chatBoxElement.appendChild(currentDiv);
        // Class to start fade in animation
        currentDiv.classList.add('load');
      });
      // Move chat to the most recent messages when new messages are added
      scrollToChatBottom();
    }
  }

  // Checks if the given typeValue matches with the user "name", the Watson "name", or neither
  // Returns true if user, false if Watson, and null if neither
  // Used to keep track of whether a message was from the user or Watson
  function isUserMessage(typeValue) {
    if (typeValue === settings.authorTypes.user) {
      return true;
    } else if (typeValue === settings.authorTypes.watson) {
      return false;
    }
    return null;
  }

  // Constructs new DOM element from a message payload
  function buildMessageDomElements(newPayload, isUser) {
	  
    var textArray = isUser ? newPayload.input.text : newPayload.output.text;
    if (Object.prototype.toString.call( textArray ) !== '[object Array]') {
      textArray = [textArray];
    }
    var messageArray = [];

    textArray.forEach(function(currentText) {
      if (currentText) {
        var messageJson = {
          // <div class='segments'>
          'tagName': 'div',
          'classNames': ['segments'],
          'children': [{
            // <div class='from-user/from-watson latest'>
            'tagName': 'div',
            'classNames': [(isUser ? 'from-user' : 'from-watson'), 'latest', ((messageArray.length === 0) ? 'top' : 'sub')],
            'children': [{
              // <div class='message-inner'>
              'tagName': 'div',
              'classNames': ['message-inner'],
              'children': [{
                // <p>{messageText}</p>
                'tagName': 'p',
                'text': currentText
              }]
            }]
          }]
        };
		
        messageArray.push(Common.buildDomElement(messageJson));
      }
    });

    return messageArray;
  }

  // Scroll to the bottom of the chat window (to the most recent messages)
  // Note: this method will bring the most recent user message into view,
  //   even if the most recent message is from Watson.
  //   This is done so that the "context" of the conversation is maintained in the view,
  //   even if the Watson message is long.
  function scrollToChatBottom() {
    var scrollingChat = document.querySelector('#scrollingChat');

    // Scroll to the latest message sent by the user
    var scrollEl = scrollingChat.querySelector(settings.selectors.fromUser
            + settings.selectors.latest);
    if (scrollEl) {
      scrollingChat.scrollTop = scrollEl.offsetTop;
    }
  }

  // Handles the submission of input
  function inputKeyDown(event, inputBox) {
    // Submit on enter key, dis-allowing blank messages
    if (event.keyCode === 13 && inputBox.value) {
      // Retrieve the context from the previous server response
	  var context;
      var latestResponse = Api.getResponsePayload();
      if (latestResponse) {
        context = latestResponse.context;
      }
      // Send the user message
      Api.sendRequest(inputBox.value, context);
      // Clear input box for further messages
      inputBox.value = '';
      Common.fireEvent(inputBox, 'input');
    }
  }

  //***********************************************
  // Text to Speech Integration - START
  //***********************************************

  function synthesizeRequest(options, audio) {
      var sessionPermissions = 1;
      var downloadURL = '/api/synthesize' +
          '?voice=' + options.voice +
          '&text=' + encodeURIComponent(options.text) +
          '&X-WDC-PL-OPT-OUT=' +  sessionPermissions;
      //console.log(downloadURL);
	  if (options.download) {
          downloadURL += '&download=true';
          window.location.href = downloadURL;
          return true;
      }
      audio.pause();
      try {
          audio.currentTime = 0;
      } catch(ex) {
          // ignore. Firefox just freaks out here for no apparent reason.
      }
      audio.src = downloadURL;
      audio.play();
	  return true;
  }

  function text2Speech(text) {
    var utteranceOptions = {
        text: text,
        voice: 'en-US_AllisonVoice',
        sessionPermissions: 1
    };
    synthesizeRequest(utteranceOptions, audio);
  }

  
  function startDictation() {
    if (window.hasOwnProperty('webkitSpeechRecognition')) {

        $('#mic-img').attr("src", "img/mic-animate.gif");


        var recognition = new webkitSpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.lang = "en-US";
        recognition.start();

        recognition.onresult = function(e) {
            $('#mic-img').attr("src", "img/mic.gif");
            document.getElementById('textInput').value
                = e.results[0][0].transcript;
            recognition.stop();
           // document.getElementById('send-btn').submit();
            $('.input-btn').click();
           // $('#textInput').trigger(jQuery.Event('keypress', {which: 13}));
        };

        recognition.onerror = function(e) {
            $('#mic-img').attr("src", "img/mic.gif");
            recognition.stop();
        }


    }
  } 

  //***********************************************
  // Text to Speech Integration - END
  //**********************************************' 
  
}());
