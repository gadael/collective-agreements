'use strict';

const scrapeIt = require("scrape-it");
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



function getAgreementPage(link) {

    const headtext = 'En savoir plus sur cet article...';

    return scrapeIt(link, {
        title: '.contexte + .titreArt',
        articles: {
            listItem: "a[id] + div",
            data: {
                title: {
                    selector: '.titreArt',
                    convert: x => {
                        let pos = x.indexOf(headtext);
                        if (-1 !== pos) {
                            return x.substr(0, pos-1);
                        }
                        return x;
                    }
                },

                permalink: {
                    selector: '.titreArt a',
                    attr: 'href',
                    convert: absolutize
                },

                body: {
                    selector: '.corpsArt'
                }
            }
        },
        links: {
            listItem: ".right a",
            data: {
                url: {
                    attr: 'href',
                    convert: absolutize
                }
            }
        }
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

            // if we have 2 links, the next page is the first link
            if (4 !== page.links.length || maxpages <= 0) {
                return content;
            }

            return loop(page.links[0].url);
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
.then(filterArticlesAboutLeaves)
.then(pages => {
    console.log(JSON.stringify(pages, null, 4));
})
.catch(console.error);
