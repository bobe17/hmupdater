<?php

error_reporting(0);

$url  = !empty($_GET['url']) ? trim($_GET['url']) : '';
$data = !empty($_GET['data']) ? trim($_GET['data']) : '';

if( !preg_match('#^[a-z][a-z0-9+.-]*://[^\s<>"{}|\\^[\]`]+$#', $url) ) {
	header('Bad Request', true, 400);
	echo "Your browser sent a request that this server could not understand.";
	exit;
}

/*
$content  = sprintf("url: %s\n", $url);
$content .= sprintf("data: %s\n", $data);

$filename = 'trace/'.date('Y-m-d_H:i:s').'.data';
file_put_contents($filename, $content); chmod($filename, 0777);
*/

$version = '1.0';
if( preg_match('/<headers[^>]+version\s*=\s*("|\')([0-9]+\.[0-9]+)\\1/', $data, $match) ) {
	$version = $match[1];
}

$charset = 'UTF-8';
if( preg_match('/<\?xml[^>]+encoding\s*=\s*("|\')([^"\']+)\\1/', $data, $match) ) {
	$charset = $match[2];
}

$headers = array();
$headers['Date']          = gmdate(DATE_RFC1123);
$headers['Accept']        = 'text/xml,application/xml,text/html,text/plain,*/*';
$headers['X-Handler']     = 'HMUpdater';
$headers['User-Agent']    = sprintf('HMUpdater/%s via Webnaute.Hordes.Proxy/1.0', $version);
$headers['Cache-Control'] = 'no-cache';
$headers['Content-Type']  = sprintf('application/xml; charset=%s', $charset);

$headers_txt = '';
foreach( $headers as $name => $value ) {
	$headers_txt .= sprintf("%s: %s\r\n", $name, $value);
}
unset($headers);

$context = stream_context_create(array(
	'http' => array(
		'header'  => $headers_txt,
		'method'  => 'POST',
		'content' => $data
	)
));

$data = file_get_contents($url, false, $context);

//
// Traitement de la réponse
//
$errorCode = 2;

if( $data !== false ) {
	$doc = new DOMDocument();
	if( $doc->loadXML($data) ) {
		$xpath  = new DOMXPath($doc);
		$result = $xpath->evaluate('/hordes/error/@code');
		
		if( $result->length == 1 && $result->item(0)->value == 'ok' ) {
			$errorCode = 1;
		}
	}
}

//
// Envoie de l'image de réponse
//
header('Content-Type: image/png');
header('Last-Modified: ' . gmdate(DATE_RFC1123));
header('Expires: ' . gmdate(DATE_RFC1123));
header('Cache-Control: no-store, no-cache, must-revalidate, private, pre-check=0, post-check=0, max-age=0');
header('Pragma: no-cache');

$img = imagecreate($errorCode, 1);
$black = imagecolorallocate($img, 0, 0, 0);
imagefill($img, 0, 0, $black);

imagepng($img);
imagedestroy($img);

