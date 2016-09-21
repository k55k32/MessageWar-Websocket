var express = require('express')
var qs = require('querystring')
var http = require('http')
var url = require('url')
var bodyParser = require('body-parser')
var smslist = require('./smslist')
var WebSocketServer  = require('ws').Server
var wss = new WebSocketServer({ port: 9001 });
var wsClients = {}
var onlineUser = {}
var nicknameMap = {}
console.log('websocket listening at ', 9001);

wss.on('connection', function (ws) {
  var sid = ws.upgradeReq.headers['sec-websocket-key']
  wsClients[sid] = ws
  sendMessage('allUser', onlineUser)
  sendMessage('sid', sid)
  ws.on('message', function (message) {
    parseMessage(message)
  });
  ws.on('close', function (close){
    userExit(sid)
  })
  ws.on('error', () => {
    userExit(sid)
  })
  var taskList = {}
  function sendMessage (type, data) {
    sendMessageOne(type, data, sid)
  }

  function parseMessage (message) {
    console.log('rcv message:', message)
    var msg = JSON.parse(message)
    var data = msg.data
    switch (msg.type) {
      case 'newOne' :
        onlineUser[sid] = data
        data.sid = sid
        sendMessageAll('new-user', data)
        break
      case 'nickname' :
        var user = onlineUser[sid]
        if (user) {
          user.nickname = data
          sendMessageAll('changename', {
            sid: sid,
            nickname: data
          })
        }
        break
      case 'mode':
        var user = onlineUser[sid]
        user.msgMode = data
        sendMessageAll('changemode', {
          sid:sid,
          msgMode: data
        })
        break
      case 'userMsg' :
        if (data.content) {
          sendUserMessage(data)
        } else {
          console.log('user msg is empty')
        }
        break
      default :
        console.log('unknow message type', msg)
        sendLog('unknow Message: ' + JSON.stringify(msg))
        break
    }
    function sendUserMessage (data) {
      data.from = sid
      data.time = new Date().getTime()
      var to  = data.to
      var sendClients = {}
      if (typeof to === 'string' && to === 'all') {
        sendClients = wsClients
      } else if (typeof to === 'object' && to.length) {
          Object.keys(wsClients).map(k => {
            if (to.indexOf(k) >= 0) {
              sendClients[k] = wsClients[k]
            }
          })
      }
      sendMessageAll('userMsg', data, sendClients)
    }
    function sendLog(msg) {
      sendMessage('log', msg)
    }
    function execTask (phone) {
      var source = taskList[phone]
      source.map(function (tag) {
        var keyObj = smslist[tag] || {}
        var sendFunction = keyObj[1]
        if (typeof sendFunction === 'function') {
          sendFunction(phone).then((result) => {
            sendMessage('result', {
              phone: phone,
              type: tag,
              data: result,
              success: true
            })
            var index = source.indexOf(tag);
            if (index > -1) {
                source.splice(index, 1);
            }
          })
        } else {
          sendMessage('result', {phone: phone, type: tag, success: false, msg: 'not that type of source'})
        }
        console.log(tag)
      })
    }
  }
});

function userExit(sid) {
  delete wsClients[sid]
  delete onlineUser[sid]
  sendMessageAll('exit', sid)
}

function sendMessageOne (type, data, sid) {
  var ws = wsClients[sid]
  var msgObject = {type: type, data: data}
  var toMsg = JSON.stringify(msgObject)
  try {
    ws.send(toMsg)
  } catch(e) {
    userExit(sid)
    console.error('send message error' , e);
  }
}

function sendMessageAll (type, data, clients) {
  setTimeout(() => {
    clients =  clients || wsClients || {}
    Object.keys(clients).map(k => {
      sendMessageOne(type, data, k)
    })
  }, 1)
}


var app = express()

app.use(bodyParser.json())
app.all('*', (request, response, next) => {
  console.log('requestpath:', request.path)
  console.log('requestbody:', request.body)
  next()
})

app.post('/github/webhook', function (req, res) {
  var body = req.body
  console.log(body)
  res.end()
})

var server = app.listen(9000, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('app listening at http://%s:%s', host, port);
});
