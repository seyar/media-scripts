#!/usr/bin/env node

var readdirp = require('readdirp');
var fs = require('fs');
var path = require('path');

var SOURCE = '/Users/seyar/media';
var MIN_SIZE = 4194304; // 4mb

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

var Compressor = function () {
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
            //fs.unlink(dest + '/' + path.basename(currentFile, path.extname(currentFile)) + '.mp4', function () {});
            throw new Error(e);
        }, this)
        .done(function () {
            console.log('Files converted');
        });
};

Compressor.prototype = {
    _convertRecursive: function () {
        if ($verbose) {
            console.log("this._files = ", this._files);
        }

        var i = this._current;

        if (!this._files[i] || !this._files) {
            return true;
        }

        var dest = path.dirname(this._files[i]);
        return this._convert(this._files[i], dest)
//            .then(function(files) {
//                var defer = vow.defer();
//console.log("files = ", files);
//                // Источник MOV весит больше назначения mp4
//                if (files.source.size > files.destinationFile.size) {
//                    // Удаленим файл MOV
//                    console.log('delete %s', files.source.path);
//                    //fs.unlink(files.source.path, function () {
//                    //    defer.resolve(1);
//                    //});
//                } else {
//                    // Скомпиленый mp4 весит больше чем MOV, удалим mp4, а потом скопирнем MOV -> mp4, а потом удалим исходный MOV
//                    console.log('delete %s', files.destinationFile.path);
//                    console.log('copy %s -> ', files.source.path, files.destinationFile.path);
//                    //fs.unlink(files.destinationFile.path, function () {
//                    //    fs.createReadStream(files.source.path).pipe(fs.createWriteStream(files.destinationFile.path));
//                    //    // удалим MOV чтобы не было дублей
//                    //    fs.unlink(files.source.path, function () {
//                    //        defer.resolve(1);
//                    //    });
//                    //});
//
//                }
//
//                return defer.promise();
//            })
            .then(function () {
                this._current++;
                if ($all === true && (this._current <= this._files.length - 1)) {
                    return this._convertRecursive();
                } else {
                    return new Promise(function (resolve) {
                        resolve();
                    });
                }
            }, this);
    },

    /**
     * Converts video file
     *
     * @param {String} source /Volumes/FAT/some.MOV
     * @param {String} destination /Volumes/FAT/converted
     * @returns {Promise}
     */
    _convert: function (source, destination) {
        return new Promise(function (resolve, reject) {
            var spawn = require('child_process').spawn;
            //var destinationFile = destination + '/' + path.basename(source, path.extname(source)) + '.mp4';
            var destinationFile = source;

            console.log('converting %s -> %s', source, destinationFile);

            var params = [
                '-strip',
                '-quality', '75%',
                source
            ];

            // convert -strip -interlace Plane -gaussian-blur 0.05 -quality 85% DSC_6332.JPG some.jpg
            // mogrify -strip -quality 75%
            var child = spawn('mogrify', params);

            child.stdout.on('data', function (chunk) {
                var output = chunk.toString();

                if ($verbose) {
                    console.log("output = ", output);
                }
            });

            child.on('exit', function (code, signal) {
                if (code > 0) {
                    reject('Process exited with code = ' + code + ', SIGNAL = ' + signal);
                }
            });

            child.on('close', function (code) {
                if (code === 0) {
                    resolve({source: source, destination: destination, destinationFile: destinationFile});
                } else {
                    reject('Process exited with code = ' + code);
                }
            });
        });
    },

    /**
     * Returns exiftool model data
     *
     * @param {String} source
     * @returns {Promise}
     */
    _getCameraModel: function (source) {
        return new Promise(function (resolve, reject) {
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
                    resolve(model);
                } else {
                    reject('_getCameraModel Process exited with code = ' + code);
                }
            });
        });
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
        return new Promise(function (resolve, reject) {
            var entries = [];
            readdirp({root: root, entryType: entryType, fileFilter: ['*.jpg', '*.JPG']})
                .on('data', function (entry) {
                    if (entry.stat.size >= MIN_SIZE) {
                        entries.push(entry.fullPath);
                    }
                }.bind(this))
                .on('end', function () {
                    entries.sort(this._sortFunction);
                    resolve(entries);
                }.bind(this))
                .on('error', reject);
        });
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

var c = new Compressor();
