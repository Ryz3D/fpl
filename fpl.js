const { existsSync, mkdirSync } = require('fs');
const { readFile, writeFile } = require('fs/promises');
const { exec } = require('node:child_process');

const templateFile = './template.tex';
const tempDir = './temp/';
const tempFile = 'temp';
const latexArgs = ['-halt-on-error', '--extra-mem-bot=320000000', '--extra-mem-top=320000000'];

const canvasWidth = 21 - 2, canvasHeight = 29.7 - 2.05;

if (!existsSync(tempDir)) {
    mkdirSync(tempDir);
}

function tikzToPdf(tikzCode, openPdf = false) {
    return new Promise((resolve, reject) => {
        readFile(templateFile)
            .then((read_data) => {
                write_data = read_data.toString().replace('%% CODE GOES HERE %%', tikzCode);
                writeFile(tempDir + tempFile + '.tex', write_data)
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
                                    .then((pdf_data) => {
                                        if (openPdf) {
                                            exec(tempFile + '.pdf', { cwd: tempDir });
                                        }
                                        resolve(pdf_data);
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
                console.error(`fs read error (${templateFile}): ${error}`);
                reject();
            });
    });
}

function getData(file) {
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

function timeToMinutes(t) {
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

function getAllTrains(line) {
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
            dep = timeToMinutes(f);
        }
        else {
            dep = timeToMinutes(f[0]);
        }
        zeiten = zeiten.map(e => [e[0], e[1] + dep, e[2] + dep]);

        trains.push({ ...newTrain, zeiten });
    }
    return trains;
}

class Tikz {
    static optStr(options) {
        return Object.entries(options).map(o => o[1] === true ? o[0] : `${o[0]}=${o[1]}`);
    }

    static draw(s, options = {}) {
        return `\\draw[${this.optStr(options)}]\n${s}\n;\n`;
    }

    static coord(x, y) {
        if (typeof y === 'undefined')
            return `(${x})\n`;
        else
            return `(${x},${y})\n`;
    }

    static line(text = undefined, options = {}) {
        if (typeof text === 'undefined')
            return '--';
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

/*
TODO:
- multipage? new tikzpicture -> Tikz.draw without return value
- absolute positioning on page
*/

class Fpl {
    constructor(json) {
        this.json = json;
        this.bfX = {};
    }

    generateHeader() {
        var s = '';
        for (var i in this.json.allgemein.bf) {
            const bf = this.json.allgemein.bf[i];
            const xRel = i / (this.json.allgemein.bf.length - 1);
            this.bfX[bf.kurz] = xRel * (canvasWidth - this.json.fpl.platzRechts);
            s += Tikz.coord(this.bfX[bf.kurz], -this.json.fpl.platzOben);
            s += Tikz.node(this.json.fpl.bfKurz ? bf.kurz : bf.name, {
                'below right': true,
                rotate: this.json.fpl.bfWinkel,
            });
        }
        s += Tikz.coord(0, 0);
        s += Tikz.line();
        s += Tikz.coord(canvasWidth, -canvasHeight);
        // TODO: custom time / station lines
        return Tikz.draw(s, {
            gray: true,
        });
    }

    generateTrains() {
        var s = '';
        for (var trains of this.json.allgemein.linien.map(l => getAllTrains(l))) {
            for (var t of trains) {
                var st = '';
                for (var timeIndex in t.zeiten) {
                    if (timeIndex == 0) {
                        st += Tikz.node(t.name, {
                            left: true,
                        });
                    }
                    else {
                        st += Tikz.line(t.name, {
                            sloped: true,
                            above: true,
                        });
                    }
                    const tToY = (m) => -m / 50;
                    st += Tikz.coord(this.bfX[t.zeiten[timeIndex][0]], tToY(t.zeiten[timeIndex][1]));
                    st += Tikz.line();
                    st += Tikz.coord(this.bfX[t.zeiten[timeIndex][0]], tToY(t.zeiten[timeIndex][2]));
                }
                const drawOptions = {};
                if (t.farbe)
                    drawOptions[t.farbe] = true;
                s += Tikz.draw(st, drawOptions);
            }
        }
        return s;
    }

    generateFull() {
        var s = '';
        s += this.generateHeader();
        s += this.generateTrains();
        return s;
    }
}

getData('./fpl.json')
    .then((data) => {
        const fpl = new Fpl(data);
        tikzToPdf(fpl.generateFull(), true).catch(() => { });
    });
