# Read-only UI Automation locator for the foreground window only. Never reads element Value or Password.
$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  Add-Type -MemberDefinition '[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();' -Name Foreground -Namespace HG
  $raw = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $hwnd = [HG.Foreground]::GetForegroundWindow()
  if ($hwnd -eq [IntPtr]::Zero) { throw 'No foreground window' }
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
  if ($null -eq $root) { throw 'No UI Automation root' }
  $proc = [System.Diagnostics.Process]::GetProcessById($root.Current.ProcessId)
  $app = [string]$raw.app
  $inspect = $raw.mode -eq 'inspect'
  if ($inspect) { $app = $proc.ProcessName }
  $expected = $app -replace '(?i)\.exe$', ''
  if (-not [string]::Equals($proc.ProcessName, $expected, [StringComparison]::OrdinalIgnoreCase)) {
    @{ error='Requested process is not foreground'; code='app_not_frontmost' } | ConvertTo-Json -Compress
    exit 0
  }
  $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
  $q = [System.Collections.Generic.Queue[object]]::new()
  $q.Enqueue(@($root,0))
  $found = [System.Collections.ArrayList]::new()
  $seen = 0
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $limit = if ($inspect) { 48 } else { 65 }
  $inspectRoles = @('button','menubaritem','menuitem','checkbox','radiobutton','popupbutton','tab','disclosuretriangle','link','hyperlink','switch','slider','splitbutton','tabitem')
  while ($q.Count -gt 0 -and $seen -lt 600 -and $found.Count -lt $limit) {
    $entry = $q.Dequeue(); $element = $entry[0]; $depth = [int]$entry[1]; $seen++
    try {
      $cur = $element.Current
      $role = $cur.ControlType.ProgrammaticName -replace '^ControlType\.', ''
      $matches = if ($inspect) { $inspectRoles -contains $role.ToLowerInvariant() -and $cur.Name.Length -gt 0 -and $cur.Name.Length -le 256 -and -not $cur.IsPassword } else { [string]::Equals($role, $raw.role, [StringComparison]::OrdinalIgnoreCase) -and $cur.Name -ceq $raw.name }
      if ($matches) {
        $r = $cur.BoundingRectangle
        if (-not $r.IsEmpty -and $r.Width -gt 0 -and $r.Height -gt 0) {
          $point = [System.Windows.Point]::new($r.X+$r.Width/2,$r.Y+$r.Height/2)
          $hit = [System.Windows.Automation.AutomationElement]::FromPoint($point)
          $clear = $false
          for ($i=0; $i -lt 16 -and $null -ne $hit; $i++) {
            if ($hit -eq $element) { $clear=$true;break }
            $hit = $walker.GetParent($hit)
          }
          $outRole = if ($inspect) { $role.ToLowerInvariant() } else { $raw.role }
          [void]$found.Add(@{app=$app;role=$outRole;name=$cur.Name;bounds=@{x=$r.X;y=$r.Y;width=$r.Width;height=$r.Height};observedAt=$now;enabled=$cur.IsEnabled;visible=(-not $cur.IsOffscreen);occluded=(-not $clear)})
        }
      }
      if ($depth -lt 8) {
        $child = $walker.GetFirstChild($element)
        $count = 0
        while ($null -ne $child -and $count -lt 120) {
          $q.Enqueue(@($child,$depth+1));$child=$walker.GetNextSibling($child);$count++
        }
      }
    } catch { continue } # UIA elements may disappear while the foreground application changes
  }
  if ([HG.Foreground]::GetForegroundWindow() -ne $hwnd) { throw 'Foreground changed during inspection' }
  $answer = @{candidates=@($found.ToArray())}
  if ($inspect) { $answer.app=$app; $answer.truncated=($q.Count -gt 0) }
  $answer | ConvertTo-Json -Depth 8 -Compress
} catch {
  @{error='UI Automation lookup unavailable or access denied';code='native_error'} | ConvertTo-Json -Compress
}
