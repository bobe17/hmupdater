<?php

header('Cache-Control: public, max-age=3600');

define('HMU_LAST_VERSION', '1.4');

$output = !empty($_GET['output']) ? trim($_GET['output']) : '';

switch( $output ) {
	case 'js':
		header('Content-Type: application/javascript');
		printf("const HMU_LAST_VERSION = '%s';\n", HMU_LAST_VERSION);
		break;
	
	case 'json':
		header('Content-Type: application/json');
		printf("{version: \"%s\"}\n", HMU_LAST_VERSION);
		break;
	
	case 'plain':
		header('Content-Type: text/plain');
		echo HMU_LAST_VERSION;
		break;
	
	default:
		header('Content-Type: text/plain');
		echo <<<OUT
Need 'output' param. Possible value are 'js', 'json' or 'plain'.
OUT;
		break;
}
