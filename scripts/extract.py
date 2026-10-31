"""Read workbook cells as data; generate the public atlas dataset."""
import collections
import hashlib
import json
import pathlib
import re
import xml.etree.ElementTree as E
import zipfile

BASE = pathlib.Path(__file__).resolve().parents[1]
SOURCE = BASE.parent / 'VQ4Rec_论文与基线引用.xlsx'
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
z = zipfile.ZipFile(SOURCE)
strings = [''.join(x.itertext()) for x in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)] if 'xl/sharedStrings.xml' in z.namelist() else []
rels = {x.attrib['Id']: x.attrib['Target'] for x in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
sheets = {}
for sh in E.fromstring(z.read('xl/workbook.xml')).find('m:sheets', NS):
    name = sh.attrib['name']
    if name not in ['论文目录', '引用关系', '原始实验', '基线引用核对', '新增基线BibTeX']:
        continue
    target = rels[sh.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
    rows = []
    for row in E.fromstring(z.read(target.lstrip('/') if target.startswith('/') else 'xl/' + target)).findall('.//m:sheetData/m:row', NS):
        values = {}
        for c in row:
            v = c.findtext('m:v', default='', namespaces=NS)
            if c.attrib.get('t') == 's':
                v = strings[int(v)] if v else ''
            elif c.attrib.get('t') == 'inlineStr':
                v = ''.join(c.find('m:is', NS).itertext())
            values[''.join(filter(str.isalpha, c.attrib['r']))] = v
        rows.append(values)
    headers = rows[0]
    sheets[name] = [{h: r.get(c, '') for c, h in headers.items()} for r in rows[1:]]

papers = []
for p in sheets['论文目录']:
    papers.append(dict(id=p['id'], label=p['label'], title=p['title'], year=int(float(p['year'])), venue=p['venue'], applications=json.loads(p['applications'] or '[]'), url=p['source_url'], summary=p['summary']))
ids = {p['id'] for p in papers}
refs = {(r['source'], r['target']): r for r in sheets['引用关系']}
counts = collections.Counter(r['target'] for r in sheets['引用关系'])
for p in papers:
    p['citations'] = counts[p['id']]
edges = collections.defaultdict(list)
edge_evidence = {}
audit = {(r['来源论文ID'], r['基线原名']): r for r in sheets['基线引用核对']}
bib = {r['引用键']: r for r in sheets['新增基线BibTeX']}
external = {}
unmatched = 0
for r in sheets['原始实验']:
    method = r.get('method_paper_id') or r['paper_id']
    baseline = r['baseline_paper_id']
    if method not in ids or method == baseline:
        continue
    citation = refs.get((method, baseline))
    match = audit.get((r['paper_id'], r['baseline_name']))
    if baseline not in ids:
        if not match or not match['引用键'] or not match['引用论文标题']:
            continue
        key = match['引用键']
        # Merge only explicit bibliographic identities, never fuzzy baseline names.
        baseline = key if key in ids else 'baseline:' + key
        if baseline not in ids:
            entry = bib.get(key, {})
            year_match = re.search(r'year\s*=\s*[{\"](\d{4})', entry.get('BibTeX代码', ''))
            external.setdefault(baseline, dict(id=baseline, label=r['baseline_name'], title=match['引用论文标题'], year=int(year_match[1]) if year_match else None, venue='', applications=[], url='', summary='', citations=0, external=True, citationKey=key))
        citation = refs.get((method, baseline))
    if not citation and not (match and match['引用键']):
        unmatched += 1
        continue
    edge_evidence[(baseline, method)] = dict(reference=citation['source_locator'] if citation else 'Baseline bibliography mapping in the workbook; standalone citation relation not independently recorded.', referenceType='citation_relation' if citation else 'bibliography_mapping')
    def num(k):
        try:
            return float(r[k])
        except (ValueError, KeyError):
            return None
    mv, bv = num('method_value'), num('baseline_value')
    raw = (mv - bv) / bv if mv is not None and bv is not None and bv != 0 else num('原始相对变化')
    improvement = -raw if raw is not None and r['direction'] == 'lower' else raw
    edges[(baseline, method)].append(dict(id=r['id'], method=r['method_name'], baseline=r['baseline_name'], dataset=r['dataset'], metric=r['metric'], direction=r['direction'], methodValue=mv, baselineValue=bv, improvement=improvement, protocol=r['protocol'], unit=r['value_unit'], comparison=r['comparison_type'], attribution=r['attribution'], note=r['attribution_note'], url=r['source_url'], locator=r['source_locator'], verification=r['verification_status']))
papers.extend(external.values())
data = dict(papers=papers, edges=[dict(source=a, target=b, **edge_evidence[(a,b)], records=rs) for (a,b),rs in edges.items()], applications=sorted({a for p in papers for a in p['applications']}), metadata=dict(source=SOURCE.name, sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(), originalRecords=len(sheets['原始实验']), referenceCount=len(refs), excludedWithoutReference=unmatched, exported='2026-10-30', surveyPapers=179))
(BASE/'dist/data.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
print(json.dumps(dict(papers=len(papers), edges=len(edges), records=sum(map(len,edges.values())), groups=data['applications']), ensure_ascii=False))
