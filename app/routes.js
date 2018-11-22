module.exports = function(app)
{
	app.get('/', function(req, res)
	{
		res.render('layout', {
			title: 'Hello World!', videos: { thumbs: ['0', '1', '2', '3', '4', '5']}
		});
	});
	
	app.get('/upload', function(req, res)
	{
		res.render('layout', {
			title: 'Hello World!', upload: true
		});
	});
	
	app.get('/video', function(req, res)
	{
		res.render('layout', {
			title: 'Hello World!', video: ['0']
		});
	});
};