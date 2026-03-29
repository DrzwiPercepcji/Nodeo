const User = require('../models/user');
const Video = require('../models/video');

exports.main = function (req, res) {
    Video.find({ user: req.user.id }, function (err, docs) {
        let sections = {
            profile: {
                title: 'User profile'
            },
            videos: {
                title: 'User videos',
                videos: docs
            }
        };

        app._render(req, res, sections);
    });
};

exports.admin = function (req, res) {
    Video.find({}, function (videoErr, videoDocs) {
        User.find({}, function (userErr, userDocs) {
            let sections = {
                adminVideos: {
                    title: 'Manage Videos',
                    videos: videoDocs
                },
                adminUsers: {
                    title: 'Manage Users',
                    users: userDocs
                }
            };

            app._render(req, res, sections);
        });
    });
};

exports.removeVideo = function (req, res) {
    Video.remove({ _id: req.params.videoId }, function (err) {
        if (err) {
            console.log(err);
        }
    });
    Video.find({}, function (videoErr, videoDocs) {
        User.find({}, function (userErr, userDocs) {
            let sections = {
                adminVideos: {
                    title: 'Manage Videos',
                    videos: videoDocs
                },
                adminUsers: {
                    title: 'Manage Users',
                    users: userDocs
                }
            };

            app._render(req, res, sections);
        });
    });
};

exports.removeUser = function (req, res) {
    User.remove({ _id: req.params.userId }, function (err) {
        if (err) {
            console.log(err);
        }
    });

    Video.find({}, function (videoErr, videoDocs) {
        User.find({}, function (userErr, userDocs) {
            let sections = {
                adminVideos: {
                    title: 'Manage Videos',
                    videos: videoDocs
                },
                adminUsers: {
                    title: 'Manage Users',
                    users: userDocs
                }
            };

            app._render(req, res, sections);
        });
    });
};

exports.signup = function (req, res) {
    let sections = {
        signup: {
            title: 'Sign up to service'
        }
    };

    app._render(req, res, sections);
};

exports.login = function (req, res) {
    let sections = {
        login: {
            title: 'Login to service'
        }
    };

    app._render(req, res, sections);
};

exports.logout = function (req, res) {
    req.logout();

    let sections = {
        login: {
            title: 'Login to service'
        }
    };

    app._render(req, res, sections);
};