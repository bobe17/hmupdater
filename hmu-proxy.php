<?php
/**
 * $Id$
 * Copyright (c) 2008-2010 Aurélien Maille
 * Released under the GPL license
 * 
 * Pseudo-proxy pour HMUpdater, pour les navigateurs qui ne permettent pas
 * les appels cross-domain avec GM_xmlhttpRequest()
 * 
 * @author  Aurélien Maille <bobe+hordes@webnaute.net>
 * @link    http://dev.webnaute.net/Applications/HMUpdater/
 * @license http://www.gnu.org/copyleft/gpl.html  GNU General Public License
 * @charset UTF-8
 */

error_reporting(0);

$url  = !empty($_GET['url']) ? trim($_GET['url']) : '';
$data = !empty($_GET['data']) ? trim($_GET['data']) : '';

if( !preg_match('#^[a-z][a-z0-9+.-]*://([a-zA-Z0-9._-]+)/[^\s<>"{}|\\^[\]`]*$#', $url, $match) ) {
	header('Bad Request', true, 400);
	echo "Your browser sent a request that this server could not understand.";
	exit;
}
/*
$filename = 'trace/'.$match[1].':%s:'.date('Y-m-d_H:i:s').'.dat';

$content  = sprintf("url: %s\n", $url);
$content .= sprintf("data: %s\n", $data);
file_put_contents(sprintf($filename, 'request'), $content);
*/
$version = '1.0';
$headers = array();

// xml mode
if( preg_match('/^<(?:\?xml|hordes)/', $data) ) {
	$xml_mode = true;
	if( preg_match('/<headers[^>]+version\s*=\s*("|\')([0-9]+\.[0-9]+)\\1/', $data, $match) ) {
		$version = $match[1];
	}
	
	$charset = 'UTF-8';
	if( preg_match('/<\?xml[^>]+encoding\s*=\s*("|\')([^"\']+)\\1/', $data, $match) ) {
		$charset = $match[2];
	}
	
	$headers['Content-Type']  = sprintf('application/xml; charset=%s', $charset);
}
// raw mode
else {
	$xml_mode = false;
	$headers['Content-Type']  = 'application/x-www-form-urlencoded';
}

$headers['Date']          = gmdate(DATE_RFC1123);
$headers['Accept']        = 'text/xml,application/xml,text/html,text/plain,*/*';
$headers['X-Handler']     = 'HMUpdater';
$headers['User-Agent']    = sprintf('HMUpdater/%s via Webnaute.Hordes.Proxy/1.0', $version);
$headers['Cache-Control'] = 'no-cache';

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

//file_put_contents(sprintf($filename, 'response'), $data);

//
// Traitement de la réponse
//
$errorCode = 2;

if( $xml_mode && $data !== false ) {
	$doc = new DOMDocument();
	if( $doc->loadXML($data) ) {
		$xpath  = new DOMXPath($doc);
		$result = $xpath->evaluate('/hordes/error/@code');
		
		if( $result->length == 1 && $result->item(0)->value == 'ok' ) {
			$errorCode = 1;
		}
	}
}

if( !$xml_mode ) {
	$errorCode = 1;
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

