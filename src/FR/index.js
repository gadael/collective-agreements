'use strict';

const scrapeIt = require("scrape-it");


/**
 * @param {String} cont     ID from the agreements list ex KALICONT000005635995
 * @return {Promise}
 */
function getLinks(cont) {
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
        return page.links;
    });
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



getLinks('KALICONT000005635995')
.then(console.log);
