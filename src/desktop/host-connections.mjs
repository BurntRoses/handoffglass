/** Local UI actions; host trust and actual tool calls remain separate. */
export const MANAGED_HOSTS=Object.freeze(['codex','workbuddy','claude-code','deepseek','opencode','cursor','trae']);
export function connectionRuntimeHint(state,locale='zh-CN'){
  return state?.runtimeMode==='app-linked'?(locale==='zh-CN'?'此连接使用已安装的 HandoffGlass App。':'This connection uses the installed HandoffGlass App.') : '';
}
export function connectionHint(state,locale='zh-CN'){
  const zh=locale==='zh-CN';
  if(state?.nextAction==='review_hooks')return zh?'工具已连接，请在宿主设置中检查 HandoffGlass Hooks。':'Tools are connected. Review HandoffGlass Hooks in the host settings.';
  if(state?.hostVerified)return zh?'已收到此次接入的真实调用。':'A real call from this installation was received.';
  if(state?.enabled===false&&state?.installed)return zh?'此连接已停用。启用后重新加载宿主。':'This connection is disabled. Enable it, then reload the host.';
  if(state?.nextAction==='review_configuration')return zh?'配置已被修改。先查看连接管理中的保留内容。':'Configuration has changed. Review the retained content in connection management.';
  if(state?.nextAction==='configuration_path_required')return zh?'请在 TRAE 中打开 MCP 原始配置，再选择该文件。':'Open the MCP raw configuration in TRAE, then select that file.';
  if(state?.nextAction==='interactive_approval_required')return zh?'在交互式 Codex 会话中发起调用，并在出现工具审批时确认。':'Call the tool in an interactive Codex chat and review its approval request.';
  if(state?.launchCommand)return zh?'使用已生成的启动入口加载插件，然后在原会话检查连接。':'Load the plugin with the prepared launcher, then check the connection in your chat.';
  if(state?.installed&&!state?.hostVerified)return zh?'接入已写入。重新加载当前应用后，在原会话说“检查 HandoffGlass 连接”。':'Integration written. Reload this app, then ask “Check the HandoffGlass connection” in your chat.';
  return '';
}
export function connectionFailure(code,locale='zh-CN'){
  const zh=locale==='zh-CN';
  if(code==='cancelled')return zh?'已取消，配置未写入。':'Cancelled. Configuration was not written.';
  if(code==='configuration_path_required')return zh?'请先选择此应用的 MCP 配置文件。':'Choose this app’s MCP configuration file first.';
  if(code==='host_not_found')return zh?'未找到宿主命令。安装宿主后重试。':'Host command not found. Install the host and retry.';
  if(code==='already_running')return zh?'连接正在更新，请稍候。':'The connection is being updated. Please wait.';
  if(code==='host_install_failed')return zh?'安装未完成。查看连接管理，检查回滚结果后重试。':'Installation did not finish. Check connection management for rollback results, then retry.';
  if(code==='bundle_refused')return zh?'连接器文件已有改动。查看移除内容，保留修改后再生成。':'Connector files have changed. Review the removal preview and keep your edits before generating again.';
  return zh?'未能接入。请检查宿主是否已安装，以及配置是否有改动。':'Could not connect. Check the host installation and configuration changes.';
}

/** A displayed launcher is an explicit user command, never executed by the renderer. */
export function formatHostLauncher(state,platform='darwin'){
  const command=state?.launchCommand;
  if(!Array.isArray(command)||!command.length||command.some(value=>typeof value!=='string'||/[\r\n\0]/.test(value)))return '';
  const quote=value=>"'"+value.replaceAll("'",platform==='win32'?"''":"'\\''")+"'";
  const line=(platform==='win32'?'& ':'')+command.map(quote).join(' ');
  if(state?.launchEnv?.ELECTRON_RUN_AS_NODE!=='1')return line;
  return platform==='win32'?"& { $hgLaunchNode=$env:ELECTRON_RUN_AS_NODE; try { $env:ELECTRON_RUN_AS_NODE='1'; "+line+" } finally { $env:ELECTRON_RUN_AS_NODE=$hgLaunchNode } }":'env ELECTRON_RUN_AS_NODE=1 '+line;
}
