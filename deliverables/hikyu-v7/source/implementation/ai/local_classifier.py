"""Small supervised local model. Synthetic demonstration, not a bank decision model."""
import collections, hashlib, json, math, pathlib, re, sys
ROOT=pathlib.Path(__file__).parent
DATA={
'card_access':['My card is locked and purchases are blocked','I cannot unlock my debit card','The card lock control does not change','My credit card appears locked','Card purchases fail after locking the card','Please explain my locked card status','My debit card is unavailable','I need help with card access'],
'payment_tracking':['My transfer receipt is missing','The payment status is unclear','I cannot find the bill payment receipt','A transfer to another person is missing','My payment confirmation has not appeared','The bill payment history is confusing','Please check this transfer status','Where is the payment receipt'],
'general_support':['Please explain my transaction category','I need help finding a transaction','How do I filter transaction dates','The transaction note is incorrect','Please explain this account statement','I need help understanding my balance','The spending category is confusing','How do I download a statement']}
HOLDOUT=[('My card remains locked','card_access'),('I cannot find my transfer receipt','payment_tracking'),('Please explain the statement category','general_support'),('Purchases are blocked on my debit card','card_access'),('Where is my bill payment confirmation','payment_tracking'),('How do I filter transactions','general_support')]
def tokens(s): return re.findall(r'[a-z]+',s.lower())
def train():
 vocab=sorted({t for docs in DATA.values() for s in docs for t in tokens(s)})
 m={'version':'synthetic-nb-v1','algorithm':'multinomial_naive_bayes','training_examples':24,'vocabulary':vocab,'classes':{}}
 for label,docs in DATA.items():
  c=collections.Counter(t for s in docs for t in tokens(s)); total=sum(c.values())+len(vocab)
  m['classes'][label]={'prior':math.log(len(docs)/24),'likelihood':{t:math.log((c[t]+1)/total) for t in vocab}}
 (ROOT/'model.json').write_text(json.dumps(m,indent=2))
 return m

def infer(payload,m):
 if not isinstance(payload,dict) or set(payload)!={'description'}: raise ValueError('Expected description only')
 s=payload['description']
 if not isinstance(s,str) or not 3<=len(s.strip())<=2000: raise ValueError('Description must have 3-2000 characters')
 ts=tokens(s); scores={k:v['prior']+sum(v['likelihood'].get(t,0) for t in ts) for k,v in m['classes'].items()}
 mx=max(scores.values()); probs={k:math.exp(v-mx) for k,v in scores.items()}; total=sum(probs.values()); probs={k:v/total for k,v in probs.items()}
 label=max(probs,key=probs.get); known=sum(t in m['vocabulary'] for t in ts)
 return {'category':label if known else 'unclassified','confidence':round(probs[label],6),'needs_human_review':True,'model_version':m['version'],'known_tokens':known}
if __name__=='__main__':
 if '--train' in sys.argv:
  m=train(); results=[{'text':s,'expected':e,'actual':infer({'description':s},m)['category']} for s,e in HOLDOUT]
  print(json.dumps({'training_examples':24,'holdout_examples':len(results),'correct':sum(r['expected']==r['actual'] for r in results),'results':results},indent=2))
 else:
  m=json.loads((ROOT/'model.json').read_text()); print(json.dumps(infer(json.load(sys.stdin),m)))
