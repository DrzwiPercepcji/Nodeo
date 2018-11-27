module.exports = function(app)
{
	let multer  = require('multer')
	let upload = multer({ dest: 'uploads/' })
	
	const { spawn } = require('child_process');
	
	function render(res, sections = null)
	{
		res.render('layout', {
			sections: sections
		});
	}
	
	function spawnProcess(str)
	{
		let parts = str.split(" ");
		
		let command = parts[0];
		let params = parts.slice(1);
		
		return process = spawn(command, params);
	}
	
	function saveVideo(path)
	{
		let command = 'ffmpeg -y -i ' + path + ' -s 1280x720 -c:a copy db/videos/test.mp4 -hide_banner';
		let process = spawnProcess(command);
		
		process.stdout.on('data', (data) => {
			console.log(`stdout: ${data}`);
		});
		
		process.stderr.on('data', (data) => {
			console.log(`stderr: ${data}`);
		});
		
		process.on('close', (code) => {
			console.log(`child process exited with code ${code}`);
		});
	}
	
	function saveThumb(path)
	{
		let command = 'ffmpeg -y -i ' + path + ' -s 1280x720 -vf thumbnail,scale=1280:720 -frames:v 1 public/images/thumbs/test.jpg -hide_banner';
		let process = spawnProcess(command);
		
		process.stdout.on('data', (data) => {
			console.log(`stdout: ${data}`);
		});
		
		process.stderr.on('data', (data) => {
			console.log(`stderr: ${data}`);
		});
		
		process.on('close', (code) => {
			console.log(`child process exited with code ${code}`);
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
		let path = req.file.path;
		
		saveVideo(path);
		saveThumb(path);
		
		render(res);
	});
};