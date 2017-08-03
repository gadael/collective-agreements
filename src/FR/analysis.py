
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

    wd = []
    for s in sent:
        wd.append(matchDuration(s))

    return {
        'source': article.get('body'),
        'tokenized': sent,
        'with_duration': wd
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


def transform():
    t = []
    for data in getData():
        t.append(getTransformedFile(data))
    return t

def test():
    data = getData()
    return getTransformedFile(data[0])


data = test()
pprint(data)
