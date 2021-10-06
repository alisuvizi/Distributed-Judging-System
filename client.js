
const serverUrl = 'ws://localhost:8008';

const WebSocket = require('ws');

var socket = new WebSocket(serverUrl);
var active = false;

socket.addEventListener('open', function (e)
{
    console.log('connected to server');
    socket.send(JSON.stringify({ cmd: 100, status: 0 }));
});


socket.addEventListener('message', function (e)
{
    console.log('message is received: ',e.data);

    let message = JSON.parse(e.data);

    // evaluate
    if(message.cmd === 1 && active)
    {
        try {
            let code = message.data.code;
            let input = message.data.input;

            let run = code + ' main(' + `[${input}]` + ');';
            let output = eval(run);

            message.data.output = output;
            message.data.pass = (JSON.stringify(output) === JSON.stringify(message.data.result)) ? true : false;
            message.data.correct = (JSON.stringify(output) === JSON.stringify(message.data.result)) ? true : false;
            message.cmd = 2;
            message.status = 0;
            message.error = '';


        } catch (e)
        {

            message.cmd = 2
            message.data.correct = false;
            message.status = 1;
            message.error = e + '';
        }

        socket.send(JSON.stringify(message));

        console.log('response: ',message);
    }

    if(message.cmd === 300 && active)
    {
       // free up resources
       active = false;
    }

    if(message.cmd === 200 && !active)
    {

       active = true;
    }

});

socket.addEventListener('close', function (e)
{
    console.log('connection is closed');
});





