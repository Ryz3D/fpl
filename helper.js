const { existsSync, mkdirSync } = require('fs');
const { readFile, writeFile } = require('fs/promises');
const { exec } = require('node:child_process');

const tempDir = './temp/';
const tempFile = 'temp';
const latexArgs = ['-halt-on-error', '--extra-mem-bot=320000000', '--extra-mem-top=320000000'];

if (!existsSync(tempDir)) {
    mkdirSync(tempDir);
}

class Helper {
    static version = '1.0';

    static canvasWidth() {
        return 21 - 2;
    }

    static canvasHeight() {
        return 29.7 - 2.05;
    }

    static latexVersion() {
        return new Promise((resolve, reject) => {
            exec('pdflatex -version', {
                cwd: tempDir,
                timeout: 10000,
            }, (error, stdout, stderr) => {
                if (error) {
                    console.error(stdout.toString().split('\n').slice(-20, -3).join('\n'));
                    reject();
                }
                else {
                    resolve(stdout);
                }
            });
        });
    }

    static tikzToPdf(tikzCode, options = { pdfName: '', openPdf: true, templateFile: './template.tex' }) {
        options = {
            pdfName: '',
            openPdf: true,
            templateFile: './template.tex',
            ...options,
        };
        return new Promise((resolve, reject) => {
            readFile(options.templateFile)
                .then((templateData) => {
                    const texData = templateData.toString().replace('%% CODE GOES HERE %%', tikzCode);
                    writeFile(tempDir + tempFile + '.tex', texData)
                        .then(() => {
                            exec(['pdflatex', tempFile + '.tex', ...latexArgs].join(' '), {
                                cwd: tempDir,
                                timeout: 10000,
                            }, (error, stdout, stderr) => {
                                if (error) {
                                    console.error(stdout.toString().split('\n').slice(-20, -3).join('\n'));
                                    reject();
                                }
                                else {
                                    if (stderr) {
                                        console.error(`pdflatex stderr: ${stderr}`);
                                    }
                                    readFile(tempDir + tempFile + '.pdf')
                                        .then((pdfData) => {
                                            if (options.pdfName.length > 0) {
                                                writeFile(options.pdfName, pdfData)
                                                    .then(() => {
                                                        exec(options.pdfName);
                                                        resolve(pdfData);
                                                    })
                                                    .catch((error) => {
                                                        console.error(`fs write error (${options.pdfName}): ${error}`);
                                                        reject();
                                                    });
                                            }
                                            else if (openPdf) {
                                                exec(tempFile + '.pdf', { cwd: tempDir });
                                                resolve(pdfData);
                                            }
                                        })
                                        .catch((error) => {
                                            console.error(`fs read error (${tempDir + tempFile + '.pdf'}): ${error}`);
                                            reject();
                                        });
                                }
                            });
                        })
                        .catch((error) => {
                            console.error(`fs write error (${tempDir + tempFile + '.tex'}): ${error}`);
                            reject();
                        });
                })
                .catch((error) => {
                    console.error(`fs read error (${options.templateFile}): ${error}`);
                    reject();
                });
        });
    }

    static getData(file) {
        return new Promise((resolve, reject) => {
            readFile(file)
                .then((file_data) => {
                    resolve(JSON.parse(file_data));
                })
                .catch((error) => {
                    console.error(`fs read error data file (${file}): ${error}`);
                    reject();
                });
        });
    }

    static timeToMinutes(t) {
        const tSplit = t.toString().split(':');
        if (tSplit.length == 3) {
            return (60 * +tSplit[0]) + +tSplit[1] + (+tSplit[2] / 60);
        }
        else if (tSplit.length == 2) {
            return (60 * +tSplit[0]) + +tSplit[1];
        }
        else {
            return +tSplit;
        }
    }

    // TODO: select hours padding
    // TODO: select if seconds used
    static minutesToTime(mins, seconds = false) {
        const h = Math.floor(mins / 60.0);
        const m = Math.floor(mins % 60.0);
        const s = Math.floor((mins * 60.0) % 60.0);
        if (seconds)
            return `${h}:${m.toString().padStart(2, '0')}:${s.padStart(2, '0')}`;
        else
            return `${h}:${m.toString().padStart(2, '0')}`;
    }

    static getAllTrains(line) {
        const timesMinutes = [...line.optionen.zeiten];
        for (var i in timesMinutes) {
            if (typeof timesMinutes[i][1] === 'string') {
                timesMinutes[i][1] = this.timeToMinutes(timesMinutes[i][1]);
            }
            if (typeof timesMinutes[i][2] === 'string') {
                timesMinutes[i][2] = this.timeToMinutes(timesMinutes[i][2]);
            }
        }

        const trains = [];
        for (var f of line.fahrten) {
            var newTrain = { ...line.optionen };
            var times = [...timesMinutes];
            var tracks = [...(line.optionen.gleis || [])];
            var dep = 0;

            if (typeof f === 'object') {
                if (f.length > 1) {
                    const stil = { ...newTrain.stil, ...f[1].stil };
                    newTrain = { ...newTrain, ...f[1], stil };
                    if (f[1].zeiten) {
                        times = [];
                        var delay = 0;
                        for (var timeIndex in timesMinutes) {
                            const overrideIndex = f[1].zeiten.findIndex(p => timesMinutes[timeIndex][0] === p[0]);
                            if (overrideIndex > -1) {
                                if (typeof f[1].zeiten[overrideIndex][1] === 'string') {
                                    f[1].zeiten[overrideIndex][1] = this.timeToMinutes(f[1].zeiten[overrideIndex][1]);
                                }
                                if (typeof f[1].zeiten[overrideIndex][2] === 'string') {
                                    f[1].zeiten[overrideIndex][2] = this.timeToMinutes(f[1].zeiten[overrideIndex][2]);
                                }
                                times.push(f[1].zeiten[overrideIndex]);
                                delay = f[1].zeiten[overrideIndex][2] - timesMinutes[timeIndex][2];
                            }
                            else {
                                times.push([
                                    timesMinutes[timeIndex][0],
                                    timesMinutes[timeIndex][1] + delay,
                                    timesMinutes[timeIndex][2] + delay,
                                ]);
                            }
                        }
                    }
                    if (f[1].gleis) {
                        for (var trackIndex in tracks) {
                            const overrideIndex = f[1].gleis.findIndex(p => tracks[trackIndex][0] === p[0]);
                            if (overrideIndex > -1) {
                                tracks[trackIndex] = f[1].gleis[overrideIndex][1];
                            }
                        }
                    }
                }
            }

            if (typeof f === 'number') {
                dep = f;
            }
            else if (typeof f === 'string') {
                dep = this.timeToMinutes(f);
            }
            else {
                dep = this.timeToMinutes(f[0]);
            }
            times = times.map(e => [e[0], e[1] - times[0][2] + dep, e[2] - times[0][2] + dep]);

            trains.push({ ...newTrain, zeiten: times, gleis: tracks });
        }
        return trains;
    }

    static getVerbosity(argv) {
        return argv.map(s => s[0] === '-' && s.slice(1).match('[^v]') === null ? s.length - 1 : 0).reduce((a, b) => Math.max(a, b));
    }

    static verboseInfo(verbosity, json) {
        if (verbosity >= 1) {
            console.log(`fpl ${this.version} (node ${process.version})`);
            console.log(`canvas: ${Helper.canvasWidth()} x ${Helper.canvasHeight()}`);
        }
        if (verbosity >= 2) {
            console.log('trains:', json.allgemein.linien.map(l => Helper.getAllTrains(l)));
            Helper.latexVersion()
                .then(v => console.log(`latex: ${v}`));
        }
    }
}

class Tikz {
    static optStr(options) {
        return Object.entries(options).map(o => o[1] === true ? o[0] : `${o[0]}=${o[1]}`);
    }

    static tikz(s) {
        return `\\tikzenv{\n${s}}\n`;
    }

    static draw(s, options = {}) {
        return `\\draw[${this.optStr(options)}]\n${s};\n\n`;
    }

    static coord(x, y) {
        if (typeof y === 'undefined')
            return `(${x})\n`;
        else
            return `(${(+x).toPrecision(6)},${(+y).toPrecision(6)})\n`;
    }

    static coordRel(x, y) {
        return `++(${(+x).toPrecision(6)},${(+y).toPrecision(6)})\n`;
    }

    static line(text = undefined, options = {}) {
        if (typeof text === 'undefined')
            return '--\n';
        else
            return `to ${this.node(text, options)}`;
    }

    static node(text, options = {}) {
        var s = 'node';
        s += `[${this.optStr(options)}]`;
        s += `{${text}}\n`;
        return s;
    }
}

exports.Helper = Helper;
exports.Tikz = Tikz;
