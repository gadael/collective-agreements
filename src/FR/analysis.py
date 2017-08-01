
from nltk.tokenize import word_tokenize
from os import walk
import json
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

    return {
        'source': article.get('body'),
        'tokenized': word_tokenize(article.get('body'))
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


def transform():
    t = []
    for data in getData():
        t.append(getTransformedFile(data))
    return t


data = transform()
pprint(data[0])
