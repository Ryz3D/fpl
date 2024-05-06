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
    static canvasWidth() {
        return 21 - 2;
    }

    static canvasHeight() {
        return 29.7 - 2.05;
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
                                        console.log(`pdflatex stderr: ${stderr}`);
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
        const trains = [];
        for (var f of line.fahrten) {
            var newTrain = { ...line.optionen };
            var zeiten = [...line.optionen.zeiten];
            var dep = 0;

            if (typeof f === 'object') {
                if (f.length > 1) {
                    newTrain = { ...newTrain, ...f[1] };
                    if (f[1].zeiten) {
                        zeiten = [];
                        var delay = 0;
                        for (var timeIndex in line.optionen.zeiten) {
                            const overrideIndex = f[1].zeiten.findIndex(p => line.optionen.zeiten[timeIndex][0] === p[0]);
                            if (overrideIndex > -1) {
                                zeiten.push(f[1].zeiten[overrideIndex]);
                                delay = f[1].zeiten[overrideIndex][2] - line.optionen.zeiten[timeIndex][2];
                            }
                            else {
                                zeiten.push([
                                    line.optionen.zeiten[timeIndex][0],
                                    line.optionen.zeiten[timeIndex][1] + delay,
                                    line.optionen.zeiten[timeIndex][2] + delay,
                                ]);
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
            zeiten = zeiten.map(e => [e[0], e[1] + dep, e[2] + dep]);

            trains.push({ ...newTrain, zeiten });
        }
        return trains;
    }
}

class Tikz {
    static optStr(options) {
        return Object.entries(options).map(o => o[1] === true ? o[0] : `${o[0]}=${o[1]}`);
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
