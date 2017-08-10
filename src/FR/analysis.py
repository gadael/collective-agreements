
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
    sentences = sent_tokenize(body)
    taggedSentences = []

    for sent in sentences:
        tags = tagSentence(sent)
        taggedSentences.append({
            'sentence': sent,
            'tags': tags
        })

    return taggedSentences

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


def matchList(str, ls):
    for keywords in ls:
        if keywords in str:
            return True
    return False


def tagSentence(str):
    """get list of tags for one sentence"""
    tags = set()


    if matchList(str, [
    'fractionnement des congés',
    'fractionnement du congé',
    'jours supplémentaires pour fractionnement',
    'jours de fractionnement',
    'fractionnement de la période de 4 semaines']):
        tags.add('splitting')

    if 'repos compensateur' in str:
        tags.add('RTT')

    if 'moyenne de 35 heures' in str:
        tags.add('RTT')

    if matchList(str, [
    'durée des congés payés',
    'la période normale des congés payés',
    'cinq semaines de congés payés',
    'congé annuel est payé',
    'congé annuel est fixé',
    'congé de 2,5 jours ouvrables par mois',
    'semaines de congés payés par année de référence',
    'période des congés principaux est fixée du',
    'droits au congé annuel',
    'durée des congés annuels',
    'période normale des congés annuels',
    'Ce droit est égal à 25 jours ouvrés']):
        tags.add('annual-leave')


    if 'congés d\'ancienneté' in str:
        tags.add('seniority')

    if 'congé supplémentaire pour ancienneté' in str:
        tags.add('seniority')

    if matchList(str, ['absent pour cause de maladie', 'absence pour maladie']):
        tags.add('illness')

    if matchList(str, ['congé exceptionnel', 'Congés exceptionnels pour événements']):
        tags.add('exceptions')

    if matchList(str, ['CET', 'épargne-temps']):
        tags.add('CET')

    if 'congés individuels de formation' in str:
        tags.add('training')

    if 'congés de validation des acquis' in str:
        tags.add('training')

    # TODO remove duplicated tags

    return tags



def transform():
    t = []
    for data in getData():
        t.append(getTransformedFile(data))
    return t

def test():
    data = getData()
    return getTransformedFile(data[0])


def getAgreementTags(agreement):
    tags = set()
    for sentences in agreement.get('articles'):
        for sent in sentences:
            tags.update(sent.get('tags'))
    return tags

def tagsByAgreements():
    for data in getData():
        agreement = getTransformedFile(data)
        print('{0:15} {1}'.format(agreement.get('number'), ', '.join(getAgreementTags(agreement))))


tagsByAgreements()
