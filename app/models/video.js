const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let VideoSchema = new Schema({
    name: {type: String, required: true, max: 100},
    private: {type: Boolean, required: false, default: true},
});

module.exports = mongoose.model('Video', VideoSchema);