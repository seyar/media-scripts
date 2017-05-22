#!/usr/bin/env node

'use strict';
var programm = require('commander');
var packageJson = require('./package.json');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

var REGEX = /jpe?g$/i;
var MONTHS = [
    '-',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'November',
    'December'
];

var DEFAULT_DEST = '/photos/';
var destination = DEFAULT_DEST;
var source = process.cwd();
programm
    .version(packageJson.version)
    .description('sort and compress photos')
    .usage('<source> <destination>')
    .arguments('<source> <destination>')
    .action((s, d) => {
        source = s;
        destination = d + destination;
    })
    .parse(process.argv);

class Sorter {
    constructor(source, destination) {
        this._source = source;
        this._destination = destination;

        this._entries = getEntries(source)
            .catch(console.log);
    }

    compress() {
        return this._entries
            .then((files) => this._chunkify(files, compress))
            .catch(console.log)
            .then(() => {
                console.log('Files compressed');
            });
    }

    sort() {
        return this._entries
            .then((files) => {
                var handler = (source) => {
                    return getExifInfo(source)
                        .then((exifInfo) => {
                            var savePath = generatePath(exifInfo, this._destination);
                            if (savePath) {
                                return copy(source, savePath);
                            }
                        });
                };
                return this._chunkify(files, handler)
                    .then((result) => result ? files.map(this._normalizePath.bind(this)) : [])
                    .catch(console.log);
            })
            .then(removeFiles)
            .catch(console.log)
            .then(() => {
                console.log('Done copying');
            });
    }

    _chunkify(files, handler) {
        files = files.slice();
        var paths = files.map(this._normalizePath.bind(this));
        var compressCount = 10;

        return Promise.all(paths.slice(0, compressCount).map(handler.bind(this)))
            .then(() => {
                files.splice(0, compressCount);
                if (files.length > 0) {
                    return this._chunkify(files, handler);
                } else {
                    return true;
                }
            })
            .catch(console.log);
    }

    _normalizePath(file) {
        return path.normalize([this._source, file].join(path.sep));
    }
}

function getEntries(path) {
    return new Promise((resolve, reject) =>
        fs.readdir(path, (err, files) => {
            if (err) {
                reject(err)
            }

            resolve(files.filter((filename) => REGEX.test(filename)));
        })
    );
}

function compress(filePath) {
    console.log('Compressing %s', filePath);

    return new Promise((resolve, reject) => {
        var spawn = require('child_process').spawn;

        var params = [
            '-quality', 75,
            '-interlace', 'none',
            '-colorspace', 'sRGB',
            filePath
        ];

        // mogrify -quality 82 -interlace none -colorspace sRGB some.jpg
        var child = spawn('mogrify', params);
        child.on('exit', (code, signal) =>
            code > 0 && reject('Process exited with code = ' + code + ', SIGNAL = ' + signal)
        );

        child.on('close', (code) => {
            if (code === 0) {
                resolve(filePath);
            } else {
                reject('Process exited with code = ' + code);
            }
        });
    });
}

function getExifInfo(filePath) {
    return new Promise((resolve, reject) => {
        var spawn = require('child_process').spawn;

        var params = [
            '-format', '"%[EXIF:Date*]%[EXIF:Model*]"',
            filePath
        ];

        // identify -format "%[EXIF:Date*]%[EXIF:Model*]" some.jpg
        var child = spawn('identify', params);

        var info = {};
        child.stdout.on('data', (chunk) => {
            var output = chunk.toString().replace(/\"/g, '');
            if (output) {
                info.filePath = filePath;
                output.split(/\n/).map((line) => {
                    var key = line.slice(line.indexOf(':') + 1, line.indexOf('='));
                    var value = line.slice(line.indexOf('=') + 1);

                    if (key && value) {
                        info[key] = value;
                    }
                });
            }
        });
        child.on('exit', (code, signal) =>
            code > 0 && reject('Process exited with code = ' + code + ', SIGNAL = ' + signal)
        );

        child.on('close', (code) => {
            if (code === 0) {
                resolve(info);
            } else {
                reject('Process exited with code = ' + code);
            }
        });
    });
}

function copy(source, destination) {
    console.log('Copying %s -> %s ', source, destination);

    var destinationDir = path.dirname(destination);
    return new Promise((resolve, reject) => {
        mkdirp(destinationDir, (err) => {
            if (err) {
                reject(err);
            }

            var readStream = fs.createReadStream(source);
            readStream.once('error', (err) => reject(err));
            readStream.pipe(fs.createWriteStream(destination));

            resolve(source);
        });
    });
}

function removeFiles(files) {
    console.log('Removing %s', files);

    files.forEach((file) => fs.unlink(file));
}

/**
 * @param {Object} entry
 * @param {String} destination
 * @returns {String|Boolean}
 */
function generatePath(entry, destination) {
    var dateString = entry.DateTimeOriginal ?
        entry.DateTimeOriginal : entry.DateTimeDigitized ?
            entry.DateTimeDigitized : entry.DateTime;

    if (!dateString) {
        return false;
    }

    var parsed = dateString.match(/(\d{4}):(\d{2}):(\d{2})/);
    var date = new Date(parsed[1], parsed[2], parsed[3]);

    if (!date) {
        return false;
    }

    var monthNumber = date.getMonth();

    return path.normalize([destination, date.getFullYear(), monthNumber + '-' + MONTHS[monthNumber], entry.Model,
        path.basename(entry.filePath)].join(path.sep));
}

if (!source || !destination || destination === DEFAULT_DEST) {
    console.log('no source="%s" or destination="%s"', source, destination);
    return;
}

var sorter = new Sorter(source, destination);
sorter
    .compress()
    .then(sorter.sort.bind(sorter));
