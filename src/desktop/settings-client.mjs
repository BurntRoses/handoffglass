/** Settings windows write through the single Broker, including the first-run wizard. */
export async function updateDesktopSettings(patch) {
  const response=await fetch(`http://127.0.0.1:${process.env.HANDOFFGLASS_PORT}/desktop/preferences`,{
    method:'POST',headers:{authorization:`Bearer ${process.env.HANDOFFGLASS_SECRET}`,'content-type':'application/json'},
    body:JSON.stringify(patch),signal:AbortSignal.timeout(4000)
  });
  if(!response.ok)throw Error('Could not save settings');
  return response.json();
}
