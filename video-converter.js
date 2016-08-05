#!/usr/bin/env node

// Events: end -> exit -> close

var readdirp = require('readdirp');
var vow = require('vow');
var fs = require('fs');
var path = require('path');

var SOURCE = '/Users/seyar/media/video';
//var SOURCE = '/Volumes/FAT/media/video';

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
        }.bind(this))
        .catch(function (e) {
            var currentFile = this._files[this._current];
            var dest = path.dirname(currentFile);
            fs.unlink(dest + '/' + path.basename(currentFile, path.extname(currentFile)) + '.mp4', function () {});
            throw new Error(e);
        }.bind(this))
        .then(function () {
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
                // Видео с айфона по-умолчанию поворачиваются на 90 градусов
                var rotate = false;
                if (model.indexOf('iPhone') !== -1) {
                    rotate = true;
                }
                // for debug not convert files
                // var destinationFile = dest + '/' + path.basename(this._files[i], path.extname(this._files[i])) + '.mp4';
                // return new Promise(function(resolve) {resolve({source: this._files[i], destination: dest, destinationFile: destinationFile})}.bind(this));
                return this._convert(this._files[i], dest, rotate);
            }.bind(this))
            .then(function (files) {
                return new Promise(function (resolve) {
                    // Проверка наличия обеих файлов
                    fs.stat(files.destinationFile, function (err, stats) {
                        if (err) {
                            throw new Error(err);
                        }
                        if (stats.isFile()) {
                            fs.stat(files.source, function (err, statsMov) {
                                if (err) {
                                    throw new Error(err);
                                }
                                if (statsMov.isFile()) {
                                    resolve({
                                        source: {
                                            path: files.source,
                                            size: statsMov.size
                                        },
                                        destination: files.destination,
                                        destinationFile: {
                                            path: files.destinationFile,
                                            size: stats.size
                                        }
                                    });
                                }
                            });
                        }
                    });
                });
            }.bind(this))
            .then(function(files) {
                return new Promise(function (resolve) {
                    // Источник MOV весит больше назначения mp4
                    if (files.source.size > files.destinationFile.size) {
                        // Удаленим файл MOV
                        console.log('delete %s', files.source.path);
                        fs.unlink(files.source.path, function () {
                            resolve(1);
                        });
                    } else {
                        // Скомпиленый mp4 весит больше чем MOV, удалим mp4, а потом скопирнем MOV -> mp4, а потом удалим исходный MOV
                        console.log('delete %s', files.destinationFile.path);
                        console.log('copy %s -> ', files.source.path, files.destinationFile.path);
                        fs.unlink(files.destinationFile.path, function () {
                            fs.createReadStream(files.source.path).pipe(fs.createWriteStream(files.destinationFile.path));
                            // удалим MOV чтобы не было дублей
                            fs.unlink(files.source.path, function () {
                                resolve(1);
                            });
                        });

                    }
                });
            })
            .then(function () {
                this._current++;
                if ($all === true && (this._current <= this._files.length - 1)) {
                    return this._convertRecursive();
                } else {
                    return new Promise(function (resolve) {
                        resolve();
                    });
                }
            }.bind(this));
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
        var destinationFile = destination + '/' + path.basename(source, path.extname(source)) + '.mp4';
        console.log('converting %s -> %s', source, destinationFile);
        var params = [
            '-i', source,
            '-o', destinationFile,
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

        return new Promise(function (resolve, reject) {
            if (rotate) {
                //params.push('--rotate');
                //params.push('4');

                // можно просто скопировать если не хочется париться с конвертирование iPhone видео
                fs.createReadStream(source).pipe(fs.createWriteStream(destinationFile));
                resolve({source: source, destination: destination, destinationFile: destinationFile});
            } else {
                var spawn = require('child_process').spawn;
                var child = spawn('HandBrakeCLI', params);

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
            }
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
            readdirp({root: root, entryType: entryType, fileFilter: ['*.mov', '*.MOV']})
                .on('data', function (entry) {
                    entries.push(entry.fullPath);
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

var c = new Converter();
