#!/usr/bin/env node

// Events: end -> exit -> close

var readdirp = require('readdirp');
var vow = require('vow');
var fs = require('fs');
var path = require('path');

var SOURCE = '/Volumes/FAT/media/video';

$all = false;
$verbose = false;
process.argv.forEach(function (val) {
    if (val === '-a' || val === '--all') {
        $all = true;
    }
    if (val === '-v' || val === '--verbose') {
        $verbose = true;
    }
});

var Converter = function () {
    this._current = 0;
    this._files = [];
    this._getEntries(SOURCE)
        .then(function (files) {
            this._files = files;
            return this._convertRecursive();
        }, this)
        .fail(function (e) {
            var currentFile = this._files[this._current];
            var dest = path.dirname(currentFile);
            fs.unlink(dest + '/' + path.basename(currentFile, path.extname(currentFile)) + '.mp4', function () {});
            throw new Error(e);
        }, this)
        .done(function () {
            console.log('Files converted');
        });
};

Converter.prototype = {
    _convertRecursive: function () {
        if ($verbose) {
            console.log("this._files = ", this._files);
        }

        var i = this._current;
        var dest = path.dirname(this._files[i]);
        return this._getCameraModel(this._files[i])
            .then(function (model) {
                var rotate = false;
                if (model.indexOf('iPhone') !== -1) {
                    rotate = true;
                }
                return this._convert(this._files[i], dest, rotate);
            }, this)
            .then(function () {
                var defer = vow.defer();
                fs.stat(dest  + '/' + path.basename(this._files[i], path.extname(this._files[i])) + '.mp4', function (err, stats) {
                    if (err) {
                        throw new Error(err);
                    }
                    if (stats.isFile()) {
                        fs.stat(this._files[i], function (err, statsMov) {
                            if (err) {
                                throw new Error(err);
                            }
                            if (statsMov.isFile()) {
                                fs.unlink(this._files[i], function () {
                                    defer.resolve(1);
                                });
                            }
                        }.bind(this));
                    }
                }.bind(this));
                return defer.promise();
            }, this)
            .then(function () {
                this._current++;
                if ($all === true && (this._current <= this._files.length - 1)) {
                    //var i = this._current;
                    //var dest = path.dirname(this._files[i]);
                    return this._convertRecursive();
                } else {
                    return vow.resolve();
                }
            }, this);
    },

    /**
     * Converts video file
     *
     * @param {String} source /Volumes/FAT/some.MOV
     * @param {String} destination /Volumes/FAT/converted
     * @param {Boolean} rotate
     * @returns {Promise}
     */
    _convert: function (source, destination, rotate) {
        var defer = vow.defer();
        var spawn = require('child_process').spawn;

        console.log('converting %s -> %s', source, destination + '/' + path.basename(source, path.extname(source)) +
            '.mp4');

        var params = [
            '-i', source,
            '-o', destination + '/' + path.basename(source, path.extname(source)) + '.mp4',
            //'-m',
            //'-E', 'copy',
            '--audio-copy-mask', 'ac3,dts,dtshd',
            '--audio-fallback', 'ffac3',
            //'-x', 'level=4.1:ref=4:b-adapt=2:direct=auto:me=umh:subq=8:rc-lookahead=50:psy-rd=1.0,0.15:deblock=-1,-1:vbv-bufsize=30000:vbv-maxrate=40000:slices=4',
            '-e', 'x264', // video codec x264/x265/mpeg4/mpeg2/VP8/theora
            '--quality', 20, // video quality
            '--ab', 160 // audio bitrate
            //'--keep-display-aspect'
        ];

        if (rotate) {
            //params.push('--rotate');
            //params.push('4');

            // можно просто скопировать если не хочется париться с конвертирование iPhone видео
            fs.createReadStream(source).pipe(fs.createWriteStream(destination + '/' + path.basename(source, path.extname(source)) + '.mp4'));
            return vow.resolve(1);
        } else {

            var child = spawn('HandBrakeCLI', params);

            var completed = false;
            child.stdout.on('data', function (chunk) {
                var output = chunk.toString();

                if ($verbose) {
                    console.log("output = ", output);
                }

                var o = output.replace(/\s/gi, '');
                if (o.indexOf('thismaytakeawhile') !== -1 || o.indexOf('ETA00h00m00s') !== -1) {
                    completed = true;
                }
            });

            child.on('exit', function (code, signal) {
                if (code > 0) {
                    defer.reject('Process exited with code = ' + code + ', SIGNAL = ' + signal);
                }
            });

            child.on('close', function (code) {
                if (code === 0) {
                    completed = false;
                    defer.resolve('complete ' + destination);
                } else {
                    defer.reject('Process exited with code = ' + code + ', but not completed');
                }
            });
        }

        return defer.promise();
    },

    /**
     * Returns exiftool model data
     *
     * @param {String} source
     * @returns {Promise}
     */
    _getCameraModel: function (source) {
        var defer = vow.defer();
        var spawn = require('child_process').spawn;

        var child = spawn('exiftool', [source]);
        var model = '';
            child.stdout.on('data', function (chunk) {
            var output = chunk.toString();
            var start = output.indexOf('Model');
            var end = output.indexOf('Software');
            model = output.substr(start, end - start);
        });

        child.on('close', function (code) {
            if (code === 0) {
                defer.resolve(model);
            } else {
                defer.reject('Process exited with code = ' + code + ', but not completed');
            }
        });

        return defer.promise();
    },

    /**
     * Find list of files or directiories
     *
     * @param {String} root folder
     * @param {files|directories} entryType
     * @returns {Promise}
     */
    _getEntries: function (root) {
        var entryType = 'files';
        var defer = vow.defer();
        var entries = [];
        readdirp({root: root, entryType: entryType, fileFilter: ['*.mov', '*.MOV']})
            .on('data', function (entry) {
                entries.push(entry.fullPath);
            }.bind(this))
            .on('end', function () {
                entries.sort(this._sortFunction);
                defer.resolve(entries);
            }.bind(this))
            .on('error', defer.reject);

        return defer.promise();
    },

    /**
     * Ascending sort function. For creating folders by depth
     *
     * @param {String} a
     * @param {String} b
     * @returns {Number}
     */
    _sortFunction: function (a, b) {
        return b.length - a.length;
    }
};

var c = new Converter();