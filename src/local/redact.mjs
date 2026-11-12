/** Bounded, local sanitization. Suspected secrets become hashes, never log values. */
import {createHash} from 'node:crypto';
const patterns=[
  /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g,
  /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  /\bBearer\s+[A-Za-z0-9._~+\/-]{8,}={0,2}/gi,
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|验证码|密码)["']?\s*[=:：]\s*["']?[^\s"',;]{3,}/gi
];
export function redact(value,max=240){
  if(typeof value!=='string')throw new TypeError('Summary must be text');
  let text=value.slice(0,8192),redacted=false;
  for(const pattern of patterns)text=text.replace(pattern,secret=>{redacted=true;return '[已脱敏:sha256:'+createHash('sha256').update(secret).digest('hex')+']';});
  return {text:text.slice(0,max),redacted};
}
