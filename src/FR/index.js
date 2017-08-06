'use strict';

const request = require('request');
const scrapeIt = require("scrape-it");
const cheerio = require('cheerio');
const fs = require('fs');
const keywords = ['congés', 'vacances'];

function absolutize(url) {
    return "https://www.legifrance.gouv.fr/"+url;
}


function containKeyword(str) {
    for (let i=0; i<keywords.length; i++) {
        if (-1 !== str.indexOf(keywords[i])) {
            return true;
        }
    }
    return false;
}



/**
 * @param {String} cont     ID from the agreements list ex KALICONT000005635995
 * @return {Promise}
 */
function getAgreementLinks(cont) {
    let url = "https://www.legifrance.gouv.fr/affichIDCC.do?idConvention="+cont;
    return scrapeIt(url, {
        number: '.contexte>.soustitre',
        links: {
            listItem: ".lien_texte div>a",
            data: {
                url: {
                    attr: 'href',
                    convert: absolutize
                }
            }
        }

    }).then(page => {

        const links = page.links.map(x => x.url);
        const uniqueLinks = links.reduce(function(accum, current) {
            if (accum.indexOf(current) < 0) {
                accum.push(current);
            }
            return accum;
        }, []);


        if (undefined === page.number) {
            throw new Error('Collective agreement not found, check '+url);
        }

        return {
            number: page.number,
            links: uniqueLinks
        };
    });
}


function loadPage(link) {
    return new Promise((resolve, reject) => {
        request(link, function (error, response, body) {
            if (error) {
                return reject(error);
            }
            resolve(cheerio.load(body));
        });
    });
}



function filterOrFind(set, selector) {
    let f = set.filter(selector);
    if (f.length) {
        return f;
    }

    return set.find(selector);
}



function getAgreementPage(link) {


    return loadPage(link)
    .then($ => {

        let page = {
            title: $('.contexte + .titreArt').text().trim(),
            articles: [],
            next: null
        };

        $('a[id]').each((i, anchor) => {

            let article = $(anchor).nextUntil('a[id]');

            // permalink is mandatory
            let permalink = article.find('.titreArt a').attr('href');

            if (undefined === permalink) {
                return;
            }

            page.articles.push({
                title: filterOrFind(article, '.titreArt').contents().filter(function() {
                    return this.nodeType === 3;
                }).text().trim(),
                status: filterOrFind(article, '.etatArt, .center').text().trim(),
                permalink: absolutize(permalink),
                body: filterOrFind(article, '.corpsArt').text().trim()
            });
        });

        $('.right a').each((i, a) => {
            const ca = $(a);
            const at = ca.text();
            const url = ca.attr('href');

            if (url && (url.indexOf('javascript') === -1) && at === 'Bloc suivant >>') {
                page.next = absolutize(url);
            }
        });


        return page;

    });
}



/**
 * Get all pages for one link with a 10 pages limit
 * @param {string} link
 * @return {Promise}
 */
function getAgreementContent(link) {
    let content = [];
    let maxpages = 10;

    /**
     * @return {Promise}
     */
    function loop(loopurl) {
        return getAgreementPage(loopurl)
        .then(page => {
            content.push(page);
            maxpages--;

            if (null === page.next || maxpages <= 0) {
                return content;
            }

            return loop(page.next);
        });
    }

    return loop(link);
}




/**
 * @return {Promise}
 */
function getAgreements() {
    return scrapeIt("https://www.legifrance.gouv.fr/initRechConvColl.do", {
        agreements: {
            listItem: ".selectCode > option",
            data: {
                name: {},
                cont: {
                    attr: 'value',
                    convert: x => x.split('#')[0]
                },
                text: {
                    attr: 'value',
                    convert: x => x.split('#')[1]
                }
            }
      }
    }).then(page => {
        return page.agreements.filter(a => {
            return (a.text !== undefined);
        });
    });
}



/**
 * If page titlt contain a keyword, all articles remains,
 * otherwise only articles with keyword remains in a page
 * @param {Array} pages
 * @return {Array}
 */
function filterArticlesAboutLeaves(pages) {
    return pages.map(page => {
        if (containKeyword(page.title)) {
            return page;
        }

        page.articles = page.articles.filter(article => {
            return (containKeyword(article.title) || containKeyword(article.body));
        });

        return page;
    })
    .filter(page => {
        return (page.articles.length > 0);
    });
}


function saveAgreement(linkNumber, name) {
    let number;
    return getAgreementLinks(linkNumber)
    .then(page => {

        number = page.number;
        return Promise.all(page.links.map(getAgreementContent));
    })
    .then(pages => {
        const mergedPages = pages.reduce(
            (p1, p2) => p1.concat(p2),
            []
        );



        return mergedPages.reduce(function(accum, current) {
            const accTitles = accum.map(p => p.title);
            if (accTitles.indexOf(current.title) < 0) {
                accum.push(current);
            }
            return accum;
        }, []);
    })
    .then(filterArticlesAboutLeaves)
    .then(pages => {

        let data = JSON.stringify({
            number: number,
            cont: linkNumber,
            lastModified: new Date(),
            name: name,
            pages: pages
        }, null, 4);

        return new Promise(function(resolve, reject) {

            let filename;
            if ('TI' === number) {
                filename = 'TI.json';
            } else {
                filename = number.split(' ')[1]+".json";
            }


            console.log(filename);
            fs.writeFile("data/"+filename, data, 'UTF-8', err => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    });
}




/**
 * Load exising files from the data folder with the last modified date
 */
function getExistingFiles() {
    return new Promise((resolve, reject) => {
        fs.readdir('data/', (err, files) => {
            const existingFiles = files.map(file => {
                const data = require('./data/'+file);
                return {
                    filename: file,
                    lastModified: data.lastModified,
                    cont: data.cont
                };
            });
            resolve(existingFiles);
        });
    });

}


function getContextIndex(existingFiles) {
    let obj = {};
    existingFiles.forEach(f => {
        obj[f.cont] = f.lastModified;
    });

    return obj;
}



function sortAgreements(agreements, existingFiles) {
    const contIndex = getContextIndex(existingFiles);
    function getLm(a) {
        return contIndex[a.cont];
    }

    return agreements.sort((a1, a2) => {
        if (!a1.cont || !getLm(a1)) {
            return -1;
        }

        if (!a2.cont || !getLm(a2)) {
            return 1;
        }
    });
}



Promise.all([
    getAgreements(),
    getExistingFiles()
])
.then(all => {

    const agreements = sortAgreements(all[0], all[1]);


    let p = Promise.resolve();
    agreements.forEach(agreement => {

        p = p.then(function(){
            return saveAgreement(agreement.cont, agreement.name);
        });
    });

    return p;
})
.catch(err => {
    console.error(err.stack);
});
