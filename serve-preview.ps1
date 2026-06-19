Add-Type -AssemblyName System.Net.HttpListener
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://127.0.0.1:4174/')
$listener.Start()
while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
    $path = $context.Request.Url.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($path)) { $path = 'md-concept-preview.html' }
    $file = Join-Path 'D:\Labure-managemant\admin-owner' $path
    if (Test-Path $file) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      switch ([System.IO.Path]::GetExtension($file).ToLowerInvariant()) {
        '.html' { $context.Response.ContentType = 'text/html; charset=utf-8' }
        '.css' { $context.Response.ContentType = 'text/css; charset=utf-8' }
        '.js' { $context.Response.ContentType = 'application/javascript; charset=utf-8' }
        '.png' { $context.Response.ContentType = 'image/png' }
        '.jpg' { $context.Response.ContentType = 'image/jpeg' }
        '.jpeg' { $context.Response.ContentType = 'image/jpeg' }
        default { $context.Response.ContentType = 'application/octet-stream' }
      }
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $context.Response.StatusCode = 404
    }
    $context.Response.OutputStream.Close()
  } catch {
    break
  }
}
