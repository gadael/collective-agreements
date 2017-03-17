'use strict';

const request = require('request');
const scrapeIt = require("scrape-it");
const cheerio = require('cheerio');
const keywords = ['congé', 'absence'];

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
    return scrapeIt("https://www.legifrance.gouv.fr/affichIDCC.do?idConvention="+cont, {
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
        return page.links.map(x => x.url);
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




function getAgreementPage(link) {


    return loadPage(link)
    .then($ => {

        let page = {
            title: $('.contexte + .titreArt').text(),
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
                title: article.find('.titreArt').contents().filter(function() {
                    return this.nodeType === 3;
                }).text(),
                permalink: absolutize(permalink),
                body: article.find('.corpsArt').text()
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
        return page.agreements;
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






/*
getAgreements()
.then(console.log);
*/

getAgreementLinks('KALICONT000005635995')
.then(links => {
    return Promise.all(links.map(getAgreementContent));
})
.then(pages => {
    return pages.reduce(
        (p1, p2) => p1.concat(p2),
        []
    );
})
//.then(filterArticlesAboutLeaves)
.then(pages => {
    console.log(JSON.stringify(pages, null, 4));
})
.catch(err => {
    console.error(err.stack);
});
