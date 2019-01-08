const User = require('../models/user');
const Video = require('../models/video');

function saveVideo(path, id)
{
	let command = 'ffmpeg -y -i ' + path + ' -s 1280x720 -c:a copy db/videos/' + id + '.mp4 -hide_banner';
	let proc = app._spawn(command);
	
	proc.stdout.on('data', (data) => {
		console.log(`stdout: ${data}`);
	});
	
	proc.stderr.on('data', (data) => {
		console.log(`stderr: ${data}`);
	});
	
	proc.on('close', (code) => {
		console.log(`child process exited with code ${code}`);
	});
}

function saveThumb(path, id)
{
	let command = 'ffmpeg -y -i ' + path + ' -s 1280x720 -vf thumbnail,scale=1280:720 -frames:v 1 public/images/thumbs/' + id + '.jpg -hide_banner';
	let proc = app._spawn(command);
	
	proc.stdout.on('data', (data) => {
		console.log(`stdout: ${data}`);
	});
	
	proc.stderr.on('data', (data) => {
		console.log(`stderr: ${data}`);
	});
	
	proc.on('close', (code) => {
		console.log(`child process exited with code ${code}`);
	});
}

exports.test = function(req, res)
{
	res.send('Controller `Video` works.');
};

exports.main = function(req, res)
{
	Video.find({}, function(err, docs)
	{
		let sections = {
			videos: {
				title: "Latest videos",
				videos: docs
			}
		};
		
		app._render(req, res, sections);
	});
};

exports.popular = function(req, res)
{
	Video.find({}, function(err, docs)
	{
		let sections = {
			videos: {
				title: "Popular videos",
				videos: docs
			}
		};
		
		app._render(req, res, sections);
	});
};

exports.create = function(req, res)
{
	let path = req.file.path;
	
	let video = new Video(
		{
			name: "Test video",
			user: req.user.id
        }
	);
	
	video.save(function(err, obj)
	{
		if(err)
		{
			return next(err);
		}
		
		saveVideo(path, obj.id);
		saveThumb(path, obj.id);
		
        app._render(req, res);
	});
};

exports.video = function(req, res)
{
	Video.findById(req.params.videoId, function(err, doc)
	{
		let sections = {
			video: {
				title: "Video",
				video: doc
			}
		};
		
		app._render(req, res, sections);
	});
};

exports.upload = function(req, res)
{
	let sections = {
		upload: {
			title: "Upload video"
		}
	};
	
	app._render(req, res, sections);
};

exports.stream = function(req, res)
{
	let fs = require('fs');
	const path = 'db/videos/' + req.params.videoId + '.mp4';
	const stat = fs.statSync(path);
	const fileSize = stat.size;
	const range = req.headers.range;
	
	if(range)
	{
		const parts = range.replace(/bytes=/, "").split("-");
		const start = parseInt(parts[0], 10);
		
		const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
		
		const chunksize = (end - start) + 1;
		const file = fs.createReadStream(path, {start, end});
		
		const head = {
			'Content-Range': `bytes ${start}-${end}/${fileSize}`,
			'Accept-Ranges': 'bytes',
			'Content-Length': chunksize,
			'Content-Type': 'video/mp4'
		};
		
		res.writeHead(206, head);
		file.pipe(res);
	}
	else
	{
		const head = {
			'Content-Length': fileSize,
			'Content-Type': 'video/mp4'
		};
		
		res.writeHead(200, head);
		fs.createReadStream(path).pipe(res);
	}
};