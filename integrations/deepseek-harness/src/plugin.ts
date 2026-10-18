/** DeepSeek Harness Cordis tool adapter.
 * Copy through scripts/prepare-deepseek.mjs to substitute the local runtime URL.
 * Uses the official DSH defineTool API; user has ultimate authority over sensitive actions.
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { BrokerClient } from '__HANDOFFGLASS_RUNTIME__'

export const name = 'handoffglass-cordis'
export const inject = ['tools']

export function apply(ctx: Context) {
  // A single client instance scopes ownership to this plugin. Reload creates a new owner.
  const bridge = new BrokerClient()
  ctx.tools.register(defineTool({
    name: 'handoffglass_guide',
    description: 'Show grounded visual guidance on the human local desktop. Human may refuse. Never invent screen coordinates or click on their behalf.',
    parameters: {
      title: { type: 'string', required: true, description: 'Short guidance title' },
      message: { type: 'string', required: true, description: 'Context and decision consequence' },
      x: { type: 'number', description: 'Verified global DIP x; omit if no grounded location' },
      y: { type: 'number', description: 'Verified global DIP y; omit if no grounded location' },
      handoff: { type: 'boolean', description: 'When true, request an explicit human completion/decline decision' },
      requestId: { type: 'string', description: 'Unique idempotency key of 8-96 characters' }
    },
    output: { schema: { type:'string' }, render: (_args, value) => [{type:'text',text:value}] },
    async execute(args) {
      if ((args.x===undefined)!==(args.y===undefined)) return JSON.stringify({error:'Supply both grounded coordinates or neither'});
      if (!args.handoff && args.x===undefined) return JSON.stringify({error:'Unlocated guidance requires a human handoff; never fabricate coordinates'});
      const result = await bridge.present(args.handoff ? 'handoff' : 'guide', {
        title:args.title,message:args.message,
        ...(args.x===undefined ? {} : {x:args.x,y:args.y}),
        ...(args.requestId ? {requestId:args.requestId} : {})
      })
      return JSON.stringify({sessionId:result.session?.id,status:result.session?.status,verified:false,visible:result.visible})
    }
  }))
  ctx.tools.register(defineTool({
    name: 'handoffglass_check',
    description: 'Read the human handoff outcome. completed means USER REPORTED completion, not external application verification.',
    parameters: {sessionId:{type:'string',required:true,description:'Previous handoff session ID'}},
    output: {schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},
    async execute(args) {
      const result=await bridge.status(args.sessionId)
      return JSON.stringify({status:result.session?.status||'not_found',verified:false,sessionId:args.sessionId})
    }
  }))
}
