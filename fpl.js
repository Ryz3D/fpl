const { Helper, Tikz } = require('./helper');

function tToY(m, pageStart, pageEnd) {
    // -platzOben bis -27
    return (m - pageStart) / (pageEnd - pageStart) * -24 - 3;
}

function extraText(options, data) {
    var s = '';

    const qKeys = ['oben links', 'oben rechts', 'unten links', 'unten rechts'];
    const qCoords = ['north west', 'north east', 'south west', 'south east'];

    for (var i in qKeys) {
        var t = options[qKeys[i]];
        if (t) {
            s += Tikz.coord('current page.' + qCoords[i]);
            t = t.replace('SEITENZAHL', data.page + 1);
            t = t.replace('SEITENANZAHL', data.pageCount);
            s += Tikz.node(t, { anchor: qCoords[i], ...options.optionen });
        }
    }

    return Tikz.draw(s);
}

class Fpl {
    constructor(json) {
        this.json = json;
        this.bfX = {};
    }

    pageStart(page) {
        return 400 + page * 300;
    }

    pageEnd(page) {
        return this.pageStart(page) + 300;
    }

    tToY(m, page) {
        return tToY(m, this.pageStart(page), this.pageEnd(page));
    }

    generateHeader(page) {
        var s = '';
        var s1 = '';

        s1 += Tikz.coord(0, 0);
        s1 += Tikz.line();
        s1 += Tikz.coord(Helper.canvasWidth(), -Helper.canvasHeight());
        s += Tikz.draw(s1, {
            white: true,
        });

        s1 = '';
        for (var i in this.json.allgemein.bf) {
            const bf = this.json.allgemein.bf[i];
            // TODO: platzLinks
            const xRel = i / (this.json.allgemein.bf.length - 1);
            this.bfX[bf.kurz] = this.json.fpl.platzLinks + xRel * (Helper.canvasWidth() - this.json.fpl.platzRechts - this.json.fpl.platzLinks);
            s1 += Tikz.coord(this.bfX[bf.kurz], -this.json.fpl.platzOben);
            if (this.json.fpl.textOptionen.bf !== false) {
                s1 += Tikz.node(this.json.fpl.bfKurz ? bf.kurz : bf.name, {
                    ...this.json.fpl.textOptionen.bf,
                });
            }
            s1 += Tikz.line();
            s1 += Tikz.coord(this.bfX[bf.kurz], -Helper.canvasHeight() + this.json.fpl.platzUnten);
        }
        s += Tikz.draw(s1, {
            gray: true,
            ...this.json.fpl.stilOptionen.bfLinien,
        });

        s1 = '';
        // TODO: customize time (major/minor) / station lines
        for (var t = 420; t <= 900; t += 60) {
            s1 += Tikz.coord(this.json.fpl.platzLinks, tToY(t, page));
            if (this.json.fpl.textOptionen.zeitLinks !== false) {
                s1 += Tikz.node(Helper.minutesToTime(t), {
                    left: true,
                    ...this.json.fpl.textOptionen.zeitLinks,
                });
            }
            s1 += Tikz.line();
            s1 += Tikz.coord(Helper.canvasWidth() - this.json.fpl.platzRechts, tToY(t, page));
            if (this.json.fpl.textOptionen.zeitRechts !== false) {
                s1 += Tikz.node(Helper.minutesToTime(t), {
                    right: true,
                    ...this.json.fpl.textOptionen.zeitRechts,
                });
            }
        }
        s += Tikz.draw(s1, {
            'gray!50!white': true,
            ...this.json.fpl.stilOptionen.zeitLinien,
        });
        return s;
    }

    generateTrains(page) {
        var s = '';
        for (var trains of this.json.allgemein.linien.map(l => Helper.getAllTrains(l))) {
            for (var t of trains) {
                if (t.zeiten[0][1] < this.pageStart(page) || t.zeiten[0][1] > this.pageEnd(page))
                    continue;

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
                    st += Tikz.coord(this.bfX[bf], tToY(t.zeiten[timeIndex][1], page));

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
                    st += Tikz.coord(this.bfX[bf], tToY(t.zeiten[timeIndex][2], page));

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
                s += Tikz.draw(st, {
                    ...this.json.fpl.stilOptionen.zug,
                    ...t.stil,
                });
            }
        }
        return s;
    }

    generateFull() {
        var s = '';

        for (var pageCount = 0; this.generateTrains(pageCount) !== ''; pageCount++);
        pageCount++;

        for (var page = 0; page < pageCount; page++) {
            var sp = '';
            sp += extraText({ ...this.json.allgemein.extraText, ...this.json.fpl.extraText }, {
                page,
                pageCount,
            });
            sp += this.generateHeader(page);
            sp += this.generateTrains(page);
            s += Tikz.tikz(sp);
        }
        return s;
    }
}

Helper.getData('./fpl.json')
    .then((data) => {
        const fpl = new Fpl(data);
        Helper.tikzToPdf(fpl.generateFull(), { pdfName: 'fpl.pdf' }).catch(() => { });
    });
