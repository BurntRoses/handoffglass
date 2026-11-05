# Persistent, read-only UI Automation helper. Never reads Value/Password or invokes controls.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
try {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  Add-Type -MemberDefinition '[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();' -Name Foreground -Namespace HG
} catch {
  @{error='UI Automation helper unavailable';code='helper_unavailable'} | ConvertTo-Json -Compress
  exit 1
}
$references = @{}
$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
function Read-Control($element, $appName, $roleName, $name, $hwnd, $token) {
  $cur = $element.Current
  if ($cur.IsPassword) { return $null }
  $r = $cur.BoundingRectangle
  if ($r.IsEmpty -or $r.Width -le 0 -or $r.Height -le 0) { return $null }
  $point = [System.Windows.Point]::new($r.X+$r.Width/2, $r.Y+$r.Height/2)
  $hit = [System.Windows.Automation.AutomationElement]::FromPoint($point)
  $clear = $false
  for ($i=0; $i -lt 16 -and $null -ne $hit; $i++) {
    if ($hit -eq $element) { $clear=$true; break }
    $hit = $walker.GetParent($hit)
  }
  if (-not $token) {
    if ($references.Count -ge 96) { $references.Clear() }
    $token = [Guid]::NewGuid().ToString()
    $references[$token] = @{element=$element;hwnd=$hwnd;processId=$cur.ProcessId;role=$roleName;name=$name}
  }
  return @{app=$appName;role=$roleName;name=$name;nativeRef=$token;scope=@{processId=$cur.ProcessId;windowId=$hwnd.ToInt64().ToString()};
    bounds=@{x=$r.X;y=$r.Y;width=$r.Width;height=$r.Height};observedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();
    enabled=$cur.IsEnabled;visible=(-not $cur.IsOffscreen);occluded=(-not $clear)}
}
while ($null -ne ($line = [Console]::In.ReadLine())) {
  try {
    if ($line.Length -gt 4096) { throw 'Input too large' }
    $raw = $line | ConvertFrom-Json
    if ($raw.mode -eq 'status') {
      # Windows has no single global AX grant. Availability does not imply access
      # to elevated applications or UAC's secure desktop.
      @{osPermission='available';available=$true;nativeEvents=$false} | ConvertTo-Json -Compress
      continue
    }
    $inspect = $raw.mode -eq 'inspect'
    if (-not $inspect -and (-not $raw.app -or -not $raw.role -or -not $raw.name)) {
      @{error='Exact target required';code='invalid_query'} | ConvertTo-Json -Compress
      continue
    }
    $hwnd = [HG.Foreground]::GetForegroundWindow()
    if ($hwnd -eq [IntPtr]::Zero) { throw 'No foreground window' }
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
    if ($null -eq $root) { throw 'No UI Automation root' }
    $proc = [System.Diagnostics.Process]::GetProcessById($root.Current.ProcessId)
    $appName = if ($inspect) { $proc.ProcessName } else { [string]$raw.app }
    $expected = $appName -replace '(?i)\.exe$', ''
    if (-not [string]::Equals($proc.ProcessName, $expected, [StringComparison]::OrdinalIgnoreCase)) {
      @{error='Requested process is not foreground';code='app_not_frontmost'} | ConvertTo-Json -Compress
      continue
    }
    if ($raw.scope -and ($raw.scope.processId -ne $proc.Id -or $raw.scope.windowId -ne $hwnd.ToInt64().ToString())) {
      @{error='Target window changed; observe it again';code='target_scope_changed'} | ConvertTo-Json -Compress
      continue
    }
    if ($raw.nativeRef) {
      $saved = $references[[string]$raw.nativeRef]
      if (-not $saved -or $saved.hwnd -ne $hwnd -or $saved.processId -ne $proc.Id -or $saved.name -cne $raw.name -or $saved.role -cne $raw.role) {
        @{error='Native reference expired; observe it again';code='target_ref_expired'} | ConvertTo-Json -Compress
        continue
      }
      try {
        $cur = $saved.element.Current
        $role = $cur.ControlType.ProgrammaticName -replace '^ControlType\.', ''
        if ($cur.Name -cne $saved.name -or -not [string]::Equals($role,$saved.role,[StringComparison]::OrdinalIgnoreCase)) { throw 'Control changed' }
        $hit = Read-Control $saved.element $appName $raw.role $raw.name $hwnd $raw.nativeRef
        if ([HG.Foreground]::GetForegroundWindow() -ne $hwnd) { throw 'Foreground changed' }
        if ($null -eq $hit) {
          @{error='Referenced control unavailable';code='target_not_found'} | ConvertTo-Json -Compress
        } else {
          @{candidates=@($hit);truncated=$false;nativeEvents=$false} | ConvertTo-Json -Depth 8 -Compress
        }
      } catch [System.Windows.Automation.ElementNotAvailableException] {
        @{error='Referenced control no longer exists';code='target_not_found'} | ConvertTo-Json -Compress
      } catch {
        @{error='Native reference changed; observe it again';code='target_ref_expired'} | ConvertTo-Json -Compress
      }
      continue
    }
    $q = [System.Collections.Generic.Queue[object]]::new()
    $q.Enqueue(@($root,0))
    $found = [System.Collections.ArrayList]::new()
    $seen = 0; $cut = $false
    $limit = if ($inspect) { 48 } else { 65 }
    $inspectRoles = @('button','menubaritem','menuitem','checkbox','radiobutton','popupbutton','tab','disclosuretriangle','link','hyperlink','switch','slider','splitbutton','tabitem')
    while ($q.Count -gt 0 -and $seen -lt 600 -and $found.Count -lt $limit) {
      $entry = $q.Dequeue(); $element = $entry[0]; $depth = [int]$entry[1]; $seen++
      try {
        $cur = $element.Current
        $role = $cur.ControlType.ProgrammaticName -replace '^ControlType\.', ''
        $matches = if ($inspect) { $inspectRoles -contains $role.ToLowerInvariant() -and $cur.Name.Length -gt 0 -and $cur.Name.Length -le 256 -and -not $cur.IsPassword } else { [string]::Equals($role, $raw.role, [StringComparison]::OrdinalIgnoreCase) -and $cur.Name -ceq $raw.name -and -not $cur.IsPassword }
        if ($matches) {
          $outRole = if ($inspect) { $role.ToLowerInvariant() } else { $raw.role }
          $hit = Read-Control $element $appName $outRole $cur.Name $hwnd $null
          if ($null -ne $hit) { [void]$found.Add($hit) }
        }
        $child = $walker.GetFirstChild($element)
        if ($depth -lt 8) {
          $count = 0
          while ($null -ne $child -and $count -lt 120) {
            $q.Enqueue(@($child,$depth+1));$child=$walker.GetNextSibling($child);$count++
          }
          if ($null -ne $child) { $cut=$true }
        } elseif ($null -ne $child) { $cut=$true }
      } catch { $cut=$true } # A changing UI is not a complete absence observation.
    }
    if ([HG.Foreground]::GetForegroundWindow() -ne $hwnd) { throw 'Foreground changed during inspection' }
    $answer = @{candidates=@($found.ToArray());truncated=($cut -or $q.Count -gt 0);nativeEvents=$false}
    if ($inspect) { $answer.app=$appName }
    $answer | ConvertTo-Json -Depth 8 -Compress
  } catch {
    @{error='UI Automation lookup unavailable or access denied';code='native_error'} | ConvertTo-Json -Compress
  }
}
