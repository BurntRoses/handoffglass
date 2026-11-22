import test from 'node:test';
import assert from 'node:assert/strict';
import {InMemoryTransport} from '@modelcontextprotocol/server';
import {Client} from '@modelcontextprotocol/client';
import {makeServer} from '../src/mcp.mjs';
import {ScreenshotShare,validateScreenshotApp} from '../src/local/screenshot-share.mjs';
import {layoutSignature} from '../src/native/calibration.mjs';
import {observedRegion} from '../src/visual/observed-region.mjs';

const display={id:'6',x:-800,y:0,width:800,height:600,scaleFactor:2};
const {id,...bounds}=display;
const image={displayId:id,width:1600,height:1200,bounds,data:'/9j/2Q=='};
const appBundleId='dev.handoffglass.fixture';

test('screenshot shares require approval and deliver image bytes with the exact drawing frame through MCP',async t=>{
  const share=new ScreenshotShare();
  let publish;
  const requestSent=new Promise(resolve=>{publish=resolve;});
  const broker={capture:args=>share.request(args,[display],publish,new AbortController().signal)};
  const server=makeServer({broker});
  const client=new Client({name:'screenshot-test',version:'1.0.0'});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  t.after(async()=>{share.cancel();await client.close();await server.close();});
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const response=client.callTool({name:'screen_capture',arguments:{appBundleId}});
  const {captureId}=await requestSent;
  assert.throws(()=>share.accept({captureId,...image,capturedAt:Date.now()},[display]),{code:'capture_not_approved'});
  share.approve(captureId);
  share.accept({captureId,...image,capturedAt:Date.now()},[display]);
  const result=await response;
  assert.deepEqual(result.content[0],{type:'image',mimeType:'image/jpeg',data:image.data});
  assert.equal(result.structuredContent.data,undefined);
  const {frame}=result.structuredContent;
  assert.equal(frame.layoutSignature,layoutSignature([display]));
  assert.deepEqual(observedRegion({x:100,y:100,width:80,height:40},frame,[display]),{x:-730,y:60,width:40,height:20});
  assert.throws(()=>share.approve(captureId),{code:'capture_not_pending'});
});

test('protected apps, cancelled shares and changed display layouts cannot return an image',async()=>{
  for(const target of ['com.openai.codex','COM.OPENAI.CHAT','com.tencent.workbuddy.mac'])
    assert.throws(()=>validateScreenshotApp(target),{code:'protected_application'});
  const share=new ScreenshotShare(),controller=new AbortController();
  let pending;
  const response=share.request({appBundleId},[display],event=>{pending=event;},controller.signal);
  controller.abort();
  await assert.rejects(response,{code:'capture_cancelled'});
  assert.throws(()=>share.approve(pending.captureId),{code:'capture_not_pending'});
  const moved=share.request({appBundleId},[display],event=>{pending=event;},new AbortController().signal);
  share.approve(pending.captureId);
  share.accept({captureId:pending.captureId,...image,capturedAt:Date.now()},[{...display,x:0}]);
  await assert.rejects(moved,{code:'layout_changed'});
});
