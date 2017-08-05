
from nltk.tokenize import sent_tokenize
from nltk import pos_tag
from nltk.corpus import treebank
from os import walk
import json
import re
from pprint import pprint


def getFiles():
    f = []
    for (dirpath, dirnames, filenames) in walk('data'):
        f.extend(filenames)
        break
    return f


def getData():
    data = []
    for file in getFiles():
        with open('data/'+file) as data_file:
            data.append(json.load(data_file))
    return data


def tokenizeArticle(article):

    if 'body' not in article:
        return {}

    body = article.get('body')
    body = ' '.join(body.split())
    sent = sent_tokenize(body)

    parsed = []
    for s in sent:
        m = matchAnnualLeaveMonth(s)
        if None != m:
            parsed.append(m)

        m = matchAnnualLeavePeriod(s)
        if None != m:
            parsed.append(m)


    return {
    #    'sentences': sent,
        'parsed': parsed
    }

def getTransformedFile(data):

    if 'name' not in data:
        return {}

    articles = []

    for p in data.get('pages'):
        for a in p.get('articles'):
            articles.append(tokenizeArticle(a))



    return {
        'name': data.get('name'),
        'number': data.get('number'),
        'articles': articles
    }



def getMonthNumber(str):
    months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
    return (months.index(str) + 1)


def matchAnnualLeaveMonth(str):
    m = re.search('(\d|\d,\d+)\s+(jours\s+et\s+demi|jours).*mois', str)

    if None == m:
        return None

    qte = float(m.group(1).replace(',', '.'))
    if ('jours' != m.group(2)):
        qte = qte + 0.5;


    return {
        'sentence': str,
        'context': m.group(0),
        'quantity': qte,
        'unit': 'day'
    }


def matchAnnualLeavePeriod(str):

    day = '(\d+)[erm]{0,3}'
    month = '(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)'
    separator = '(?:-|au)'
    date = day+'\s+'+month
    # 12 mois de travail effectif au cours de l'année de référence (1er juin-31 mai)
    m = re.search('12\s+mois.*'+date+'\s*'+separator+'\s*'+date, str)

    if None == m:
        return None

    # make sure the interval is one year


    return {
        'sentence': str,
        'context': m.group(0),
        'from': (int(m.group(1)), getMonthNumber(m.group(2))),
        'to': (int(m.group(3)), getMonthNumber(m.group(4)))
    }


def matchDuration(str):
    # 2 jours et demi
    # 2 jours
    # 10 mois
    # 3 semaines successives

    all = re.findall('(\d+)\s((?:jour|moi|semaine)s+)', str)
    return {
        'sentence': str,
    #    'matches': list(map(lambda x: x.group(0), all))
        'matches': all
    }



def tagSentence(str):
    """get list of tags for one sentence"""
    tags = []
    if 'fractionnement' in str:
        tags.append('splitting')

    if 'repos compensateur' in str:
        tags.append('RTT')

    if 'moyenne de 35 heures' in str:
        tags.append('RTT')

    if 'durée des congés payés' in str:
        tags.append('annual-leave')




def transform():
    t = []
    for data in getData():
        t.append(getTransformedFile(data))
    return t

def test():
    data = getData()
    return getTransformedFile(data[0])


data = transform()
pprint(data)
