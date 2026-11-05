# Independent Windows remover: never deletes recursively or terminates a process.
param([Parameter(Mandatory=$true)][string]$PlanPath)
$ErrorActionPreference='Stop'
Write-Output 'remover_started'
$plan=Get-Content -LiteralPath $PlanPath -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Output 'plan_loaded'
[IO.File]::WriteAllText($plan.readyPath,'ready',[Text.UTF8Encoding]::new($false))
$deadline=[DateTime]::UtcNow.AddSeconds(30)
function Waiting { foreach($processId in $plan.waitPids) { if(Get-Process -Id $processId -ErrorAction SilentlyContinue) { return $true } };return $false }
while((Waiting) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 200 }
Write-Output 'shutdown_wait_finished'
$removed=[System.Collections.Generic.List[string]]::new()
$retained=[System.Collections.Generic.List[object]]::new()
foreach($entry in $plan.entries) {
  try {
    if(Waiting) { throw 'application_still_running' }
    if(-not (Test-Path -LiteralPath $entry.path)) { continue }
    $item=Get-Item -LiteralPath $entry.path -Force
    $parent=$item.Directory
    if($item.PSIsContainer) { $parent=$item.Parent }
    while($null -ne $parent) {
      if($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'symlink_parent' }
      $parent=$parent.Parent
    }
    if($entry.kind -eq 'directory') {
      if(-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'changed_by_user' }
      [IO.Directory]::Delete($entry.path,$false)
    } elseif($entry.kind -eq 'file') {
      if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'changed_by_user' }
      # Use .NET directly: an inherited PowerShell Core PSModulePath may hide
      # Windows PowerShell's Get-FileHash module.
      $hasher=[Security.Cryptography.SHA256]::Create()
      $stream=[IO.File]::OpenRead($entry.path)
      try { $hash=[BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
      finally { $stream.Dispose();$hasher.Dispose() }
      if($hash -ne $entry.digest) { throw 'changed_by_user' }
      [IO.File]::Delete($entry.path)
    } else { throw 'unsupported_link' }
    $removed.Add($entry.path)
  } catch { $retained.Add(@{path=$entry.path;reason=$_.Exception.Message}) }
}
foreach($item in $plan.priorRetained) { $retained.Add($item) }
$hostPending=@($plan.hostActions | Where-Object { $_.host -eq 'workbuddy' }).Count -gt 0
$result=@{complete=($retained.Count -eq 0 -and -not $hostPending);removed=$removed.ToArray();retained=$retained.ToArray();hostActions=$plan.hostActions;completedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()} | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($plan.resultPath,$result,[Text.UTF8Encoding]::new($false))
Write-Output 'result_written'
Remove-Item -LiteralPath $PlanPath -Force
