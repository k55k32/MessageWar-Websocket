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
    console.error('send message error: ' , e);
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
