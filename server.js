const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

let express = require('express');
let app = express();

let mustache = require('mustache-express');

app.engine('mustache', mustache());

app.set('view engine', 'mustache');
app.set('views', __dirname + '/views');

app.use(express.static('public'));

require('./app/routes.js')(app);

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);