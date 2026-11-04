import { heading, escape } from '../components/ui.js';
import { accountCard, showAccount } from '../components/accounts.js';
import { mountBanking } from './banking-view.js';
import { mountTransfers } from './transfers-view.js';

export const SECTIONS = {
 'pay-transfer': {title:'Pay & Transfer', description:'Move money and manage the people and billers you pay.', tabs:{internal:'Between my accounts',peer:'To another person',payees:'Saved recipients',bill:'Bill Pay'}},
 accounts: {title:'Accounts & Cards',description:'Manage your accounts, card controls and credit payments.',tabs:{accounts:'Your accounts',cards:'Cards'}},
 insights: {title:'Financial Insights',description:'Plan category budgets and explore your spending with the Hikyu assistant.',tabs:{budgets:'Budgets',assistant:'AI assistant'}},
 demo: {title:'Demo Tools',description:'Simulation only. No real money is moved.',tabs:{purchase:'Simulate purchase'}},
};
export function legacyBankingRoute(tab) {
 return {bill:'pay-transfer?tab=bill',payees:'pay-transfer?tab=payees',cards:'accounts?tab=cards',repayment:'accounts?tab=repayment',budgets:'insights?tab=budgets',purchase:'demo?tab=purchase'}[tab]||'demo';
}
export function mountBankingSection(root,route,accounts,mountAssistant) {
 const section=SECTIONS[route],params=new URLSearchParams(location.hash.split('?')[1]||'');
 let tab=params.get('tab')||Object.keys(section.tabs)[0];
 if(!Object.hasOwn(section.tabs,tab)&&!(route==='accounts'&&tab==='repayment'))tab=Object.keys(section.tabs)[0];
 root.innerHTML=heading('PERSONAL BANKING',section.title,section.description)+`<div role="navigation" class="section-tabs" aria-label="${escape(section.title)} sections">${Object.entries(section.tabs).map(([key,label])=>`<a class="secondary-button" href="#${route}?tab=${key}" ${key===tab?'aria-current="page"':''}>${label}</a>`).join('')}</div><div class="section-content"></div>`;
 const content=root.querySelector('.section-content');
 if(tab==='accounts'){
  content.innerHTML=`<div class="overview-accounts">${accounts.map(accountCard).join('')}</div><p class="muted">Select an account to view its details, transactions and available actions.</p>`;
  content.querySelectorAll('[data-account]').forEach(button=>button.onclick=()=>showAccount(button.dataset.account));return ()=>{};
 }
 if(tab==='assistant')return mountAssistant(content);
 if(tab==='internal'||tab==='peer')return mountTransfers(content,{mode:tab,recipient:params.get('recipient')});
 return mountBanking(content,{tab});
}
