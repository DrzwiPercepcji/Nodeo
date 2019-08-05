const fs = require('fs');

const User = require('../models/user');
const Video = require('../models/video');

const encryption = require('../modules/encryption');

function saveVideo(path, id) {
    let command = 'ffmpeg -y -i ' + path + ' -s 1280x720 -c:a copy ' + APP_DATA + 'videos/' + id + '.mp4 -hide_banner';
    let process = app._spawn(command);

    attachLogToProcess(process);

    process.on('close', (code) => {
        encryption.encryptFile(APP_DATA + 'videos/' + id + '.mp4', '1234123412341234');
    });
}

function saveThumb(path, id) {
    let command = 'ffmpeg -y -i ' + path + ' -s 1280x720 -vf thumbnail,scale=1280:720 -frames:v 1 ' + APP_DATA + 'videos/thumbs/' + id + '.jpg -hide_banner';
    let process = app._spawn(command);

    attachLogToProcess(process);
}

function attachLogToProcess(process) {
    process.stdout.on('data', (data) => {
        console.log(`FFmpeg out: ${data}`);
    });

    process.stderr.on('data', (data) => {
        console.log(`FFmpeg error: ${data}`);
    });

    process.on('close', (code) => {
        console.log(`Child process exited with code ${code}.`);
    });
}

exports.test = function (req, res) {
    res.send('Controller `Video` works.');
};

exports.main = function (req, res) {
    Video.find({}, function (err, docs) {
        let sections = {
            videos: {
                title: 'Latest videos',
                videos: docs
            }
        };

        app._render(req, res, sections);
    });
};

exports.popular = function (req, res) {
    Video.find({}, function (err, docs) {
        let sections = {
            videos: {
                title: 'Popular videos',
                videos: docs
            }
        };

        app._render(req, res, sections);
    });
};

exports.create = function (req, res) {
    let path = req.file.path;

    let video = new Video(
        {
            name: 'Test video',
            user: req.user.id
        }
    );

    video.save(function (err, obj) {
        if (err) {
            return next(err);
        }

        saveVideo(path, obj.id);
        saveThumb(path, obj.id);

        app._render(req, res);
    });
};

exports.video = function (req, res) {
    Video.findById(req.params.videoId, function (err, doc) {
        let sections = {
            video: {
                title: 'Video',
                video: doc
            }
        };

        app._render(req, res, sections);
    });
};

exports.upload = function (req, res) {
    let sections = {
        upload: {
            title: 'Upload video'
        }
    };

    app._render(req, res, sections);
};

exports.stream = function (req, res) {
    const path = APP_DATA + 'videos/' + req.params.videoId + '.mp4';
    const stat = fs.statSync(path);
    const fileSize = stat.size;

    const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
    };

    res.writeHead(200, head);

    encryption.decryptFile(path, '1234123412341234', 0, fileSize - 1, res);
};

exports.thumb = function (request, response) {
    try {
        let image = fs.readFileSync(APP_DATA + 'videos/thumbs/' + request.params.thumbName);
        response.writeHead(200, { 'Content-Type': 'image/jpeg' });
        response.end(image, 'binary');
        return;
    } catch (error) {
    }

    response.writeHead(404);
};