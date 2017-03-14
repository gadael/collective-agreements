'use strict';

const scrapeIt = require("scrape-it");


function absolutize(relative) {
    return "https://www.legifrance.gouv.fr/"+relative.url;
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
                    attr: 'href'
                }
            }
        }

    }).then(page => {
        return page.links.map(absolutize);
    });
}



function getAgreementPage(link) {
    return scrapeIt(link, {
        content: {
            listItem:'.titreArt, .corpsArt'
        },
        links: {
            listItem: ".right a",
            data: {
                url: {
                    attr: 'href'
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

            content.push(page.content);
            maxpages--;

            // if we have 2 links, the next page is the first link
            if (4 !== page.links.length || maxpages <= 0) {
                return content;
            }

            return loop(absolutize(page.links[0]));
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



//getAgreementLinks('KALICONT000005635995')
//.then(console.log);

const agreementUrl = 'https://www.legifrance.gouv.fr/affichIDCC.do?idArticle=KALIARTI000005814996&idSectionTA=KALISCTA000005709156&cidTexte=KALITEXT000005665667&idConvention=KALICONT000005635995&dateTexte=29990101';

getAgreementContent(agreementUrl)
.then(x => {
    console.log(x);
})
.catch(console.error);
