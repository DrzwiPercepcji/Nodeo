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
	
	app.post('/upload', upload.single('file'), function(req, res)
	{
		render(res);
	});
};