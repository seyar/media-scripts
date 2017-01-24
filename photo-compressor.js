#!/usr/bin/env node

var readdirp = require('readdirp');
var fs = require('fs');
var path = require('path');

var source = '/Users/seyar/media';
var MIN_SIZE = 4194304; // 4mb

var all = false;
var verbose = false;
var showHelp = false;

process.argv.forEach(function (val) {
    if (val === '-a' || val === '--all') {
        all = true;
    }
    if (val === '-v' || val === '--verbose') {
        verbose = true;
    }
    if (val === '-h' || val === '--help') {
        showHelp = true;
    }
});

try {
    var source = fs.realpathSync(process.argv[process.argv.length -1]);    
} catch (e) {}

var Compressor = function () {
    this._current = 0;
    this._files = [];

    getEntries(source)
        .then(function (files) {
            this._files = files;
            return this._convertRecursive();
        }.bind(this))
        .catch(function (e) {
            var currentFile = this._files[this._current];
            var dest = path.dirname(currentFile);
            //fs.unlink(dest + '/' + path.basename(currentFile, path.extname(currentFile)) + '.mp4', function () {});
            throw new Error(e);
        }.bind(this))
        .then(function () {
            if (verbose) {
                console.log('Files converted');
            }
        });
};

Compressor.prototype._convertRecursive = function () {
    var i = this._current;
    if (!this._files[i] || !this._files) {
        return true;
    }

    var dest = path.dirname(this._files[i]);
    return convert(this._files[i], dest)
        .then(function(){
            this._current++;
            if (all === true && (this._current <= this._files.length - 1)) {
                return this._convertRecursive();
            } else {
                return new Promise(function (resolve) {
                    resolve();
                });
            }
        }.bind(this));
};

/**
 * Converts photo file.
 *
 * @param {String} source /Volumes/FAT/some.MOV
 * @param {String} destination /Volumes/FAT/converted
 * @returns {Promise}
 */
function convert(source, destination) {
    return new Promise(function (resolve, reject) {
        var spawn = require('child_process').spawn;
        var destinationFile = source;

        if (verbose) {
            console.log('converting %s -> %s', source, destinationFile);
        }

        var params = [
            '-strip',
            '-quality', 
            '75%',
            source
        ];

        // convert -strip -interlace Plane -gaussian-blur 0.05 -quality 85% DSC_6332.JPG some.jpg
        // mogrify -strip -quality 75%
        var child = spawn('mogrify', params);

        child.stdout.on('data', function (chunk) {
            if (verbose) {
                var output = chunk.toString();
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
}

/**
 * Find list of files or directiories
 *
 * @param {String} root folder
 * @param {files|directories} entryType
 * @returns {Promise}
 */
function getEntries(root) {
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
                entries.sort(sortFunction);
                resolve(entries);
            }.bind(this))
            .on('error', reject);
    });
}

/**
 * Ascending sort function. For creating folders by depth
 *
 * @param {String} a
 * @param {String} b
 * @returns {Number}
 */
function sortFunction(a, b) {
    return b.length - a.length;
}

if (showHelp) {
    console.log('Compressor for photos. Compress photo more than 4mb. Usage:');
    console.log('You can pass a path in last param. Example: ./photo-compressor.js -v ~/photo-import');
    console.log('Default path is /Users/seyar/media');
    console.log('-a, --all  Compress all files in folder.');
    console.log('-v, --verbose  Show progress.');
    console.log('-h, --help  Show help.');
} else {
    var c = new Compressor();
}
