
const WSPort = 8008;
const ServerWebPort = 8000;


const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const webSession = [];

const wss = new WebSocket.Server({ port: WSPort });

const wsClients = [];

const userList = [
    { id: 1, name: 'admin', username: 'admin', password: '1234', active: true, admin: true },
    { id: 2, name: 'user1', username: 'user1', password: '123', active: true, admin: false },
    { id: 3, name: 'user2', username: 'user2', password: '123', active: true, admin: false }
];

const competitionList = [
    { id: 1, title: 'competition 1', time: 15, input: [1,2,3,4,5], result: [1,3,2,5,4], active: true, description: '' },
    { id: 2, title: 'competition 2', time: 5, input: [1,2,3], result: [1,1,1], active: true, description: '' },
    { id: 3, title: 'competition 3', time: 6, input: [3,3,3], result: [6,6], active: true, description: '' }
];

const userCompetition = [
    { id: 1, userId: 2, competitionId: 1, code: '', output:[], correct: false, status: 1, error: '', start: '2020-01-01 10:10:00', end: '2020-01-01 10:11:15' },
    { id: 2, userId: 2, competitionId: 2, code: '', output:[], correct: false, status: 1, error: '', start: '2020-01-01 10:10:00', end: '2020-01-01 10:11:16' },
    { id: 3, userId: 3, competitionId: 3, code: '', output:[], correct: false, status: 1, error: '', start: '2020-01-01 10:10:00', end: '2020-01-01 10:11:19' }
];

const userCompetitionTemp = [
    { userId:0, start: '', competitionId: 0 },
];

var ClientTaskTurn = 0;

const TaskList =
[
    { id:0, ucId:0, send: true,  received: false, code: '', input: '', result: '', status: 0, error: '', correct: false }
];


const TaskManagement =
    {
        sendTask: function (ucId, code, input, result)
        {
            let task = TaskManagement.findTask(ucId);

            console.log('send Task >>> ' ,task);

            if(!task)
            {
                let id = Math.max.apply(null, TaskList.map(function (e) {
                    return e.id;
                })) + 1;

                task = { id: id, ucId: ucId, send: false, received: false, input: input, code: code, result: result, status: 0, error: '', pass: false };


                let clients = wsClients;

               // console.log('wss clients ',clients);

                if(clients && clients.length > 0)
                {
                    try
                    {
                        // wakeup;
                        clients[ClientTaskTurn % clients.length].send(JSON.stringify({ cmd: 200, data: {} }));

                        clients[ClientTaskTurn % clients.length].send(JSON.stringify({ cmd: 1, data: task }));

                        // sleep
                        let hastask = TaskList.findIndex(r => r.send == false);
                        if(hastask < 0)
                           clients[ClientTaskTurn % clients.length].send(JSON.stringify({ cmd: 300, data: {} }));


                        task.send = true;
                        ClientTaskTurn++;

                    } catch (e)
                    {
                        console.log('exception send client ', e);
                    }
                }

                TaskList.push(task);

            }
        },

        update: function(task)
        {
           let index = TaskList.findIndex(r => r.id == task.id);

           console.log('task mgnt >> ',task,index);

           if(index >= 0)
           {
               task.received = true;
               TaskList[index] = task;
           }

           return task;
        },

        findTask: function (ucid)
        {
            let index = TaskList.findIndex(r => r.ucId == ucid);

            return index >= 0 ? TaskList[index] : undefined;
        },

        find: function (id)
        {
            let index = TaskList.findIndex(r => r.id == id);

            return index >= 0 ? TaskList[index] : undefined;

        },

        sendSleepAll: function()
        {
            let clients = wsClients;
            let msg = { cmd: 200 };

            for(var c of clients)
              c.send(JSON.stringify(msg));
        },

        sendWakeup: function()
        {
            let clients = wsClients;
            let msg = { cmd: 300 };

            for(var c of clients)
              c.send(JSON.stringify(msg));
        },

        sendAll: function ()
        {
            let clients = wss.clients;

            for(var task of TaskList)
            {


                if(clients && clients.length > 0 && !task.send)
                {
                    try
                    {
                        clients[ClientTaskTurn % clients.length].send(JSON.stringify({cmd:1, data:task}));
                        task.send = true;
                        ClientTaskTurn++;

                    } catch (e)
                    {

                    }
                }
            }

        }
    };

const userCompetitionManagement =
    {

      view: function(list)
      {
          let result = [];

          for(var l of list)
          {

              ui = userList.findIndex(r => r.id == l.userId);
              ci = competitionList.findIndex(r => r.id == l.competitionId);

              let user = userList[ui];
              let comp = competitionList[ci];

              let diff = Math.round((new Date(l.end) - new Date(l.start)) / 1000);
              let time = ('0' + Math.round(diff/60)).slice(-2) + ":" + ('0' + (diff % 60)).slice(-2);

              result.push({id: l.id, user: user.name, userid: l.userId, competitionId: l.competitionId, competition: comp.title, output: l.output, correct: l.correct, error: l.error, code: l.code, time: time});

          }

          return result;
      },

      register: function (userid, competitionid, code, start) {

          let id = Math.max.apply(null, userCompetition.map(function(e) { return e.id; })) + 1;

          let data = {id: id, userId: userid, competitionId: competitionid, code: code, output:[], correct: false, status: 1, error: '', runtime: -1, start: start, end: Date.now() };

          userCompetition.push(data);

          return data;
      },

      start: function(userid, competitionid)
      {
          let index = userCompetitionTemp.findIndex(r => r.userId == userid);

          while(index >= 0)
          {
              userCompetitionTemp.splice(index,1);

              index = userCompetitionTemp.findIndex(r => r.userId == userid);
          }

          userCompetitionTemp.push({ userId: userid, start: Date.now(), competitionId: competitionid });

         // console.log('start>> ',userCompetitionTemp, userid, competitionid);
      },

      end: function(userid, code)
      {

            let index = userCompetitionTemp.findIndex(r => r.userId == userid);

           // console.log('end >>> ', index, userid, userCompetitionTemp);

            if(index >= 0)
            {
                let data = userCompetitionTemp[index];

                let d = userCompetitionManagement.register(userid, data.competitionId, code, data.start);
                let c = competitionManagement.find(data.competitionId);

                TaskManagement.sendTask(d.id, d.code, c.input, c.result);

                userCompetitionTemp.splice(index,1);
            }
      },

      update: function(task){

          let index = userCompetition.findIndex(r => r.id == task.ucId);

          console.log('udpate task>>>> ', task, index);

          if(index >= 0)
          {
              userCompetition[index].correct = task.correct;
              userCompetition[index].error = task.error;
              userCompetition[index].output = task.output;
              userCompetition[index].status = task.status;
          }

      }  ,

      remove: function(id)
      {
          let index = userCompetition.findIndex(r => r.id == id);

          if(index >= 0)
              userCompetition.splice(index,1);
      },

      removeByUserId: function(userid)
      {
          let index = userCompetition.findIndex(r => r.userId == userid);

          while(index >= 0)
          {
              userCompetition.splice(index,1);
              index = userCompetition.findIndex(r => r.userId == userid);
          }
      },

      removeByCompetitionId: function(competitionid)
      {
          let index = userCompetition.findIndex(r => r.competitionId == competitionid);

          while(index >= 0)
          {
              userCompetition.splice(index,1);
              index = userCompetition.findIndex(r => r.competitionId == competitionid);
          }
      },

      list: function () {
          return userCompetitionManagement.view( userCompetition );
      },

      listByUserId: function (userid)
      {
          return userCompetitionManagement.view( userCompetition.filter(r => r.userId == userid) );
      },

      listByCompetitionId: function (cid) {
          return userCompetitionManagement.view(userCompetition.filter(r => r.competitionId == cid));
      }
    };

const competitionManagement =
    {
        register: function(title, desc, time, input, result)
        {
            let id = Math.max.apply(null, competitionList.map(function(e) { return e.id })) + 1;

            competitionList.push({id: id, title: title, description: desc, time: time, input: input, result: result, active: true })
        },

        update: function(title,desc,time,input,result,id)
        {
            let index = competitionList.findIndex(r => r.id == id);

            if(index >= 0)
            {
                competitionList[index].result = result;
                competitionList[index].input = input;
                competitionList[index].time = time;
                competitionList[index].title = title;
                competitionList[index].description = desc;
            }

        },

        remove: function(id)
        {
            let index = competitionList.findIndex(r => r.id == id);

            if(index >= 0)
            {
                competitionList.splice(index, 1);
                userCompetitionManagement.removeByCompetitionId(id);
            }
        },

        list: function()
        {
            return competitionList;
        },

        find: function(cid)
        {
            let index = competitionList.findIndex(r => r.id == cid);

            return index >= 0 ? competitionList[index] : undefined;
        }
    };

const userManagement =
    {
      register: function(name,username,password)
      {
          let id = Math.max.apply(null, userList.map(function(e) { return e.id })) + 1;

          userList.push({id: id, name: name, username: username, password: password, active: true, admin: false});
      },

      find: function (username) {
          let index = userList.findIndex(r => r.username.toLowerCase() == username.toLowerCase());

          return index >= 0 ? userList[index] : undefined;
      },

      newUser: function(name,username,password,admin,active)
      {
          let id = Math.max.apply(null, userList.map(function(e) { return e.id })) + 1;

          userList.push({id: id, name: name, username: username, password: password, active: active, admin: admin});
      },

      update:  function(name,username,password,admin,active,id)
      {
          let index = userList.findIndex(r => r.id == id);

          if(index >= 0)
          {
              userList[index].username = username;
              userList[index].password = password;
              userList[index].active = active;
              userList[index].admin = admin;
              userList[index].name = name;
          }
      },

      remove: function(id)
      {
          let index = userList.findIndex(r => r.id == id);

          console.log('finduser >>> ',index ,id);

          if(index >= 0) {
              userList.splice(index, 1);

              userCompetitionManagement.removeByUserId(id);

              console.log('user list >>> ',userList);
          }
      },

      list: function()
      {
         return userList;
      }
    };


const WebAPI =
    {
        login: function (req,res)
        {

            let username = req.query.username;
            let password = req.query.password;
            let user = userManagement.find(username);
            let data = { status: 1, data : {}, sid: ''};

            //console.log('login>>> ',username,password,user);

            if(user && user.password == password && user.active)
            {
                var randomNumber=Math.random().toString();
                randomNumber=randomNumber.substring(2,randomNumber.length);


                data.sid = randomNumber;
                data.data = user;
                data.status = 0;

                webSession[data.sid] = user;

                res.status(200).send(JSON.stringify(data));

            } else
            {
                res.status(200).send(JSON.stringify(data));
            }
        },

        logout: function(req,res)
        {
            //req.session.destroy();
            let sid = req.query.sid;
            delete webSession[sid];

            let data = { status:0, data: { lock: 1} };

            res.status(200).send(JSON.stringify(data));
        },

        isLogin: function(req,res)
        {
            let sid = req.query.sid;
            let user = webSession[sid];

            //console.log('isLogin >>> ',user);

            return user && user.active;
        },

        isLoginAPI(req,res)
        {
            let sid = req.query.sid;
            let user = webSession[sid];
            let data = { status: 1, data: {}};

            if(user)
              data = { status: 0 , data: user};

            //console.log('isLoginAPI >>> ',user);

            let result = JSON.stringify(data);

            res.status(200).send(result);
        },

        isAdmin: function (req, res) {
            let sid = req.query.sid;
            let user = webSession[sid];

           // console.log('isAdmin>>> ', user, req.session);

            return user && user.active && user.admin;

        },

        registerUser: function (req,res) {

            let data = { status:0, data: {} };

            let name = req.query.name;
            let username = req.query.username;
            let password = req.query.password;

            userManagement.register(name, username, password);

            let list = userManagement.find(username);

            data.data = list;

            res.status(200).send(JSON.stringify(data));
        },

        updateUser: function(req,res)
        {
            let data = {status:1, data:{}};
            if(!WebAPI.isAdmin(req,res))
            {

            } else {

                let id = req.query.id;
                let name = req.query.name;
                let username = req.query.username;
                let password = req.query.password;
                let admin = req.query.admin == true;
                let active = req.query.active == true;

                userManagement.update(name,username,password,admin,active,id);

                let list = userManagement.list();

                data.status = 0;
                data.data = list;
            }

            res.status(200).send(JSON.stringify(data));
        },

        updateCompetition: function(req,res)
        {
            let data = {status:1, data:{}};
            if(!WebAPI.isAdmin(req,res))
            {

            } else {

                let id = req.query.id;
                let title = req.query.title;
                let desc = req.query.desc;
                let time = req.query.time;
                let input =  JSON.parse("["+ req.query.input + "]");
                let result = JSON.parse("["+ req.query.result + "]");

                competitionManagement.update(title,desc,time,input,result,id);

                let list = competitionManagement.list();

                data.status = 0;
                data.data = list;
            }

            res.status(200).send(JSON.stringify(data));
        },

        removeUser: function(req,res)
        {

            let data = {status:1, data:{}};

            if(!WebAPI.isAdmin(req,res))
            {

            } else
            {
                let id = req.query.id;
                userManagement.remove(id);

                let list = userManagement.list();

                data.status = 0;
                data.data = list;

            }

            res.send(200, JSON.stringify(data));
        },

        listUser: function(req,res)
        {
            let data = { status: 1, data: {} };

            if(!WebAPI.isAdmin(req,res))
            {

            } else
            {
                let users = userManagement.list();

                data.status = 0;
                data.data = users;

            }

            res.status(200).send(JSON.stringify(data));
        },

        start: function (req,res) {

            let data = {status: 1, data: {}};

            if(!WebAPI.isLogin(req,res))
            {

            } else
            {
                let cid = req.query.cid;
                let sid = req.query.sid;
                let uid = webSession[sid].id;  //req.session.user.id;

                userCompetitionManagement.start(uid,cid);

                data.status = 0;


            }

            res.send(200, JSON.stringify(data));
        },

        end: function(req, res)
        {
            let data = { status: 1, data: {}};

            if(!WebAPI.isLogin(req,res))
            {

            } else
            {
                let sid = req.query.sid;
                let user = webSession[sid];

                let uid = user.id;
                let b64 = req.query.code;
                let buff = new Buffer(b64, 'base64');
                let code = buff.toString('ascii');

                userCompetitionManagement.end(uid,code);

                data.status = 0;


            }

            res.send(200, JSON.stringify(data));
        },

        listUserCompetition: function (req,res)
        {
            let data = { status:1, data: {} };

            if(!WebAPI.isLogin(req,res))
            {

            } else
            {
                let sid = req.query.sid;
                let user = webSession[sid];
                let uid = user.id;



                let list = userCompetitionManagement.listByUserId(uid);

                if(WebAPI.isAdmin(req,res))
                    list = userCompetitionManagement.list();

                data.status = 0;
                data.data = list;
            }

            res.send(200, JSON.stringify(data));

        },

        listCompetition: function (req,res) {

            let data = { status:1, data: {} };

            if(!WebAPI.isLogin(req,res))
            {

            } else
            {
                //let uid = req.session.user.id;
                let list = competitionManagement.list();

                data.status = 0;
                data.data = list;


            }

            res.send(200, JSON.stringify(data));

        },

        registerCompetition: function (req,res) {

            let data = { status:1, data: {} };

            if(!WebAPI.isAdmin(req,res))
            {

            } else
            {
                let sid = req.query.sid;
                let user = webSession[sid];

                let uid = user.id;
                let title = req.query.title;
                let desc = req.query.desc;
                let time = req.query.time;
                let input =  JSON.parse("["+ req.query.input + "]");
                let result = JSON.parse("["+ req.query.result + "]");

                competitionManagement.register(title,desc,time,input,result);
                let list = competitionManagement.list();

                data.status = 0;
                data.data = list;

            }

            res.send(200, JSON.stringify(data));

        },

        removeCompetition: function (req,res)
        {
            let data = { status:1, data:{} };

            if(!WebAPI.isAdmin(req,res))
            {

            } else
            {
                let id = req.query.id;
                competitionManagement.remove(id);

                let list = competitionManagement.list();

                data.status = 0;
                data.data = list;

                res.send(200, JSON.stringify(data));
            }
        }

};



var server = express();


server.use(cookieParser());
server.use(session({secret: "session secret is good !#@"}));
server.use(cors());
server.use('/admin',express.static(__dirname + '/www'));
server.use('/user',express.static(__dirname + '/public'));

server.get('/api/user', function(req,res){

    let cmd = req.query.cmd;

    switch(cmd)
    {
        case 'login':
              WebAPI.login(req,res);
              break;

        case 'logout':
              WebAPI.logout(req,res);
              break;

        case 'register':
              WebAPI.registerUser(req,res);
              break;

        case 'list':
              WebAPI.listUser(req,res);
              break;

        case 'remove':
              WebAPI.removeUser(req,res);
              break;

        case 'start':
              WebAPI.start(req,res);
              break;

        case 'end':
              WebAPI.end(req,res);
              break;

        case 'competition':
              WebAPI.listUserCompetition(req,res);
              break;

        case 'islogin':
              WebAPI.isLoginAPI(req,res);
              break;

        case 'update':
              WebAPI.updateUser(req,res);
              break;

    }

});

server.get('/api/competition', function(req,res){

    let cmd = req.query.cmd;

    switch(cmd)
    {
        case 'register':
            WebAPI.registerCompetition(req,res);
            break;

        case 'list':
            WebAPI.listCompetition(req, res);
            break;

        case 'remove':
            WebAPI.removeCompetition(req,res);
            break;

        case 'update':
            WebAPI.updateCompetition(req,res);
            break;


    }

});

/*
setInterval(function () {

    wss.clients.forEach(function (client) {

        var message = {cmd:1 , codeId: 1, code: 'function main(input) { return [input[0], input[2], input[1], input[0] + input[3] ]; }', input: [1,2,3,4], result: [1,3,2,5] };

        client.send(JSON.stringify(message));
    })

},1000);*/

wss.on('connection', function connection(ws,req)
{
    console.log('new client is connected from ', req.socket.remoteAddress);

    wsClients.push(ws);

    ws.on('message', function incoming(message)
    {
        console.log('received: ', message);

        try {
            let msg = JSON.parse(message);

            if(msg.cmd == 2)
            {
                task = msg.data;

                let result = TaskManagement.update(task);

                if(result)
                {
                    userCompetitionManagement.update(task);
                }

            }

        } catch (e)
        {
            console.error('error in processing message ! ',e);
        }

    });

    ws.on('close', function (e) {

        console.log('client connection is closed !');
    });
});

server.listen(ServerWebPort);