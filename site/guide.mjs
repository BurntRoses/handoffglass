import {installPrompts} from './install-prompts.mjs';
import {readLanguage, bindLanguages, bindCopy, setText} from './shared.mjs';

const words={
 en:{home:'Home',title:'Install',lead:'Send this to your agent.',codeLabel:'To your agent',useTitle:'Use',example:'Show me how to empty the Trash.',useBody:'During other tasks, your agent can also guide you when a step needs your input.',backHome:'Home',copy:'Copy',copied:'Copied'},
 zh:{home:'首页',title:'安装',lead:'把这句话发给你的 Agent。',codeLabel:'发送给 Agent',useTitle:'使用',example:'教我清空废纸篓。',useBody:'执行其他任务时，需要你亲手操作的地方，Agent 也可以在屏幕上指引你。',backHome:'返回首页',copy:'复制',copied:'已复制'},
 ja:{home:'ホーム',title:'インストール',lead:'エージェントに送ってください。',codeLabel:'エージェントへ',useTitle:'使い方',example:'ゴミ箱を空にする方法を教えて。',useBody:'他の作業中も、人の操作が必要になれば画面上で案内できます。',backHome:'ホームへ',copy:'コピー',copied:'コピー済み'}
};
let lang = readLanguage();
const button = document.getElementById('copyCode');
const content = document.getElementById('codeContent');
const fields = Object.keys(words.en).map(id => [document.getElementById(id), id]).filter(([node]) => node);
const resetCopy = bindCopy({button, text: () => content.textContent, words: () => words[lang]});
function paint(){
 const w=words[lang];
 document.documentElement.lang=lang==='zh'?'zh-CN':lang;
 document.title=w.title+' · HandoffGlass';
 for(const [node, key] of fields) setText(node, w[key]);
 setText(content, installPrompts[lang]);
 resetCopy();
}
bindLanguages(lang, next => { lang = next; paint(); });
paint();
