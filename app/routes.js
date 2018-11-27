module.exports = function(app)
{
	let multer  = require('multer')
	let upload = multer({ dest: 'uploads/' })
	
	function render(res, sections = null)
	{
		res.render('layout', {
			sections: sections
		});
	}
	
	function saveVideo(video)
	{
		console.log('gowno');
		video
		.setVideoSize('1280x?', true, true)
		.save('./db/videos/test.mp4', function (error, file)
		{
			if(error)
				console.log('Error:' + error);
				
			else
				console.log('Done.');
		});
	}
	
	app.get('/', function(req, res)
	{
		let sections = {
			videos: {
				title: "Latest videos",
				videos: [0, 1, 2, 3, 4, 5]
			}
		};
		
		render(res, sections);
	});
	
	app.get('/upload', function(req, res)
	{
		let sections = {
			upload: {
				title: "Upload video"
			}
		};
		
		render(res, sections);
	});
	
	app.get('/video', function(req, res)
	{
		render(res);
	});
	
	app.get('/stream', function(req, res)
	{
		let fs = require('fs');
		const path = 'db/videos/test.mp4';
		const stat = fs.statSync(path);
		const fileSize = stat.size;
		const range = req.headers.range;
		
		if (range)
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
	});
	
	app.post('/upload', upload.single('file'), function(req, res)
	{
		let command = 'ffmpeg -i ' + req.file.path + ' -s 640x480 -c:a copy db/videos/test.mp4';
		
		const { exec } = require('child_process');
		
		exec(command, function(code, stdout, stderr)
		{
			console.log('Exit code:', code);
			console.log('Program output:', stdout);
			console.log('Program stderr:', stderr);
		});
		
		render(res);
	});
};