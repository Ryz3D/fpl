const { Helper, Tikz } = require('./helper');

/*
TODO:
- multipage? new tikzpicture -> Tikz.draw without return value
- absolute positioning on page
*/

function tToY(m) {
    return -m / 50;
}

class Fpl {
    constructor(json) {
        this.json = json;
        this.bfX = {};
    }

    generateHeader() {
        var s = '';
        var s1 = '';
        for (var i in this.json.allgemein.bf) {
            const bf = this.json.allgemein.bf[i];
            // TODO: platzLinks
            const xRel = i / (this.json.allgemein.bf.length - 1);
            this.bfX[bf.kurz] = xRel * (Helper.canvasWidth() - this.json.fpl.platzRechts);
            s1 += Tikz.coord(this.bfX[bf.kurz], -this.json.fpl.platzOben);
            s1 += Tikz.node(this.json.fpl.bfKurz ? bf.kurz : bf.name, this.json.fpl.textOptionen.bf || {});
            s1 += Tikz.line();
            s1 += Tikz.coord(this.bfX[bf.kurz], -Helper.canvasHeight());
        }
        s1 += Tikz.coord(0, 0);
        s1 += Tikz.line();
        s1 += Tikz.coord(Helper.canvasWidth(), -Helper.canvasHeight());
        s += Tikz.draw(s1, {
            gray: true,
            ...this.json.fpl.stilOptionen.kopfzeile,
        });

        s1 = '';
        // TODO: custom time / station lines
        // beschriftung?
        for (var t = 420; t <= 840; t += 60) {
            s1 += Tikz.coord(0 /* this.json.fpl.platzLinks */, tToY(t));
            s1 += Tikz.line();
            s1 += Tikz.coord(Helper.canvasWidth(), tToY(t));
        }
        s += Tikz.draw(s1, {
            "gray!50!white": true,
            ...this.json.fpl.stilOptionen.kopfzeile,
        });
        return s;
    }

    generateTrains() {
        var s = '';
        for (var trains of this.json.allgemein.linien.map(l => Helper.getAllTrains(l))) {
            for (var t of trains) {
                var st = '';
                for (var timeIndex in t.zeiten) {
                    const bf = t.zeiten[timeIndex][0];

                    if (+timeIndex > 0) {
                        st += Tikz.line(t.name, {
                            sloped: true,
                            above: true,
                            ...this.json.fpl.textOptionen.zugFahrt,
                        });
                    }

                    // An
                    st += Tikz.coord(this.bfX[bf], tToY(t.zeiten[timeIndex][1]));

                    if (+timeIndex === 0) {
                        if (this.json.fpl.textOptionen.zugStart !== false) {
                            st += Tikz.node(t.name, {
                                left: true,
                                ...this.json.fpl.textOptionen.zugStart,
                            });
                        }
                    }

                    if (this.json.fpl.textOptionen.zugAn !== false && this.json.fpl.zeitenText[bf][0] !== false) {
                        st += Tikz.node(Helper.minutesToTime(t.zeiten[timeIndex][1]), {
                            left: true,
                            ...this.json.fpl.textOptionen.zugAn,
                            ...this.json.fpl.zeitenText[bf][0],
                        });
                    }

                    st += Tikz.line();

                    // Ab
                    st += Tikz.coord(this.bfX[bf], tToY(t.zeiten[timeIndex][2]));

                    if (this.json.fpl.textOptionen.zugAb !== false && this.json.fpl.zeitenText[bf][1] !== false) {
                        st += Tikz.node(Helper.minutesToTime(t.zeiten[timeIndex][2]), {
                            left: true,
                            ...this.json.fpl.textOptionen.zugAb,
                            ...this.json.fpl.zeitenText[bf][1],
                        });
                    }

                }
                if (this.json.fpl.textOptionen.zugEnde !== false) {
                    st += Tikz.node(t.name, {
                        right: true,
                        ...this.json.fpl.textOptionen.zugEnde,
                    });
                }
                const drawOptions = {};
                if (t.farbe)
                    drawOptions[t.farbe] = true;
                s += Tikz.draw(st, {
                    ...drawOptions,
                    ...this.json.fpl.stilOptionen.zug,
                });
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

Helper.getData('./fpl.json')
    .then((data) => {
        const fpl = new Fpl(data);
        Helper.tikzToPdf(fpl.generateFull(), { pdfName: 'fpl.pdf' }).catch(() => { });
    });
