var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io')(server),
    bodyParser = require('body-parser'),
    morgan = require('morgan'),
    formidable = require('formidable'),
    fs = require('fs'),
    cups = require("cupsidity");

port = process.env.PORT || 3000;

server.listen(port, function () {
    console.log('Server listening at port %d', port);
});

app.use(bodyParser.json());
app.use(morgan('dev'));

var dest = cups.getDefault(); // TODO config
var currentJobs = [];

function sendJobs (socket) {
    var jobs = cups.getJobs({
        dest: dest,
        mine: false
    });

    socket.emit('jobs', jobs);
}

function jobUpdater () {
    if (!currentJobs.length) {
        setTimeout(jobUpdater, 1000);
        return;
    }

    var jobs = cups.getJobs({
        dest: dest,
        mine: false
    });

    var needUpdate = false;
    for (var i = 0; i < currentJobs.length; i++) {
        var current = currentJobs[i];
        for (var j = 0; j < jobs.length; j++) {
            var job = jobs[j];
            if (job.id == current.id && job.state != current.state) {
                needUpdate = true;
                if( job.state == 'completed' || job.state == 'cancelled' || job.state == 'aborted' ) {
                    var toDelete = current.path;
                    setTimeout(function() {
                        fs.unlink(toDelete);
                    }, 1000); // need to wait a bit because cups take some time to release the file
                    currentJobs.splice(i, 1);
                }
            }
        }
    }

    if( needUpdate ){
        sendJobs(io.to('clients'));
    }

    setTimeout(jobUpdater, 1000);
}
jobUpdater();

io.on('connection', function (socket) {
    socket.join('clients');

    socket.on('cancel', function(data){
        cups.cancelJob({
            id: data.id,
            dest : dest
        });
        console.log('cancel' + data.id);
    });

    socket.on('disconnect', function () {
        console.log('a user disconnect');
    });

    sendJobs(socket);
    console.log('a user connect');
});


app.post('/printMe', function (req, res) {
    var uploadDir = '/tmp/42printing';  // TODO config
    try {
        fs.mkdirSync(uploadDir);
    }
    catch (e) {
        if (e.code != 'EEXIST') {
            throw e;
        }
    }

    var form = new formidable.IncomingForm();
    form.uploadDir = uploadDir;
    form.maxFieldsSize = 4 * 1024 * 1024;   // 4MB max

    form.parse(req, function (err, fields, files) {
        var id = cups.printFile({
            dest: dest,
            title: files.file.name,
            filename: files.file.path
        });
        currentJobs.push({id: id, path: files.file.path, state: 'pending'});

        sendJobs(io.to('clients'), true); // update clients

        res.status(200).end();
    });
});

app.use(express.static(__dirname + '/public'));

app.use(function logErrors (err, req, res, next) {
    console.error(err.stack);
    next(err);
});

app.use(function clientErrorHandler (err, req, res, next) {
    if (req.xhr) {
        res.status(500).send({ error: 'Something blew up!' });
    } else {
        next(err);
    }
});

app.use(function errorHandler (err, req, res, next) {
    res.status(500);
    res.render('error', { error: err });
});

