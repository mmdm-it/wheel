<?php
// Wheel probe drop box. Appends one JSON line per report to a log OUTSIDE
// the web root (~/wheel-probe.log). Nothing is served back; the log is read
// over ssh. Body capped, file capped, response 204.
$max_body = 64 * 1024;
$body = file_get_contents('php://input', false, null, 0, $max_body);
if ($body === false || $body === '') { http_response_code(400); exit; }

$decoded = json_decode($body, true);
$line = json_encode([
  't'  => gmdate('c'),
  'ip' => isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '',
  'ua' => isset($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 300) : '',
  'report' => is_array($decoded) ? $decoded : substr($body, 0, 2000)
]);

// public_html/mmdm/telemetry.php -> $HOME/wheel-probe.log (not web-accessible)
// The account's HOME, read off this file's own path. Counting directories up
// from here (as this did) lands inside a web root on one venue and outside
// the account on another (O-322).
$home = preg_match('#^(/home\d*/[^/]+)#', __DIR__, $m) ? $m[1] : dirname(__DIR__, 2);
$log = $home . '/wheel-probe.log';
$cap = 5 * 1024 * 1024;
if (!file_exists($log) || filesize($log) < $cap) {
  file_put_contents($log, $line . "\n", FILE_APPEND | LOCK_EX);
}
http_response_code(204);
