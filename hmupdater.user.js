/**
 * $Id$
 * Copyright (c) 2008-2011 Aurélien Maille
 * Released under the GPL license 
 *
 * Remerciements :
 * Pata, Ma'chi et les utilisateurs pour leurs rapports de bogue et leurs nombreuses suggestions.
 * Nicolas Le Cam et Pierre Gotab pour leurs patchs pour pallier à la disparition du PC
 * 
 * @author  Aurélien Maille <bobe+hordes@webnaute.net>
 * @link    http://dev.webnaute.net/Applications/HMUpdater/
 * @license http://www.gnu.org/copyleft/gpl.html  GNU General Public License
 * @charset UTF-8
 */
// ==UserScript==
// @name           HMUpdater
// @namespace      http://dev.webnaute.net/Applications/HMUpdater
// @description    Mise à jour d'une M@p d'objets à partir de hordes.fr
// @include        http://www.hordes.fr/*
// @version        1.7
// ==/UserScript==

(function(){

const HMU_VERSION  = '1.7';
const HMU_APPNAME  = 'HMUpdater';
const HMU_TIMEOUT  = 10;// en secondes
const HMU_APPHOME  = 'http://dev.webnaute.net/Applications/HMUpdater/';
const HMU_CHECKVER = HMU_APPHOME + 'version?output=js';// null pour désactiver
const DEBUG_MODE   = true;
// pour les navigateurs qui ne supportent pas la fonction GM_xmlhttpRequest() native
const PROXY_URL    = 'http://dev.webnaute.net/hordes/hmu-proxy.php';

// TODO : faute de mieux...
const GM_AVAILABLE = (typeof(GM_getValue) != 'undefined' && !window.chrome && !window.safari && !window.opera);

//
// Maps externes bénéficiant d’un accès sécurisé au flux du site hordes.fr
//
var webapps = {};
webapps['Patamap'] = { id: 9,  url: 'http://patamap.com/hmupdater.php', label: 'la Patamap', key: null, xml: true };
webapps['BBH']     = { id: 51, url: 'http://bbh.fred26.fr/update.php', label: 'BigBroth\'Hordes', key: null, xml: true };
webapps['HUM']     = { id: 36, url: 'http://www.hordes-ultimate-manager.net/hmupdater/index.php', label: 'Ultimate Manager', key: null, xml: true };
webapps['LCN']     = { id: 14, url: 'http://www.lacitadellenoire.com/carte.php', label: 'La Citadelle Noire', key: null, xml: false };
webapps['OEEV']    = { id: 22, url: 'http://www.oeev-hordes.com/', label: 'OEEV', key: null, xml: false };

// Localisation
var lang = {};
lang['root_title']   = "Cliquez pour configurer le script";// tooltip of root button
lang['new_version']  = "Une nouvelle version du script est disponible en $1téléchargement$2.\nVotre version peut ne plus fonctionner correctement, vous devriez faire cette mise à jour (Pensez ensuite à recharger cette page).";
lang['coords_text']  = "Saisissez les coordonnées de la case (format\u00A0: x.y)";// \u00A0 = non-break space
lang['coords_error'] = "Mauvais format de coordonnées\u00A0! (formats acceptés\u00A0: x.y ou x,y)";

lang['update_button'] = "Mettre à jour la M@p";
lang['update_error1'] = "Le site $1 ne répond pas\u00A0!";// $1 = webapp
lang['update_error2'] = "Erreur inattendue";
lang['update_error3'] = "Erreur renvoyée par $1\u00A0: $2";// $1 = webapp, $2 = message returned by the webapp
lang['update_error4'] = "Erreur HTTP renvoyée par $1\u00A0: $2";// $1 = webapp, $2 = http response (eg: "404 Not Found")
lang['update_ok1']    = "La M@p a été mise à jour\u00A0!";
lang['update_ok2']    = "La M@p a été mise à jour sur $1\u00A0!";// $1 = webapp

lang['checkbox_webapp'] = "Mettre à jour $1";
lang['checkbox_custom'] = "Spécifier une autre URL";
lang['custom_tooltip']  = "Vous pouvez également spécifier plusieurs URLs en les séparant avec une barre verticale (|). Les données seront alors envoyées à chaque URL.";
lang['input_login']     = "Votre pseudo";
lang['input_url']       = "URL de l’application externe";
lang['input_pubkey']    = "Votre clef API";
lang['reset_coords']    = "Réinitialiser les coordonnées";
lang['valid_button']    = "Valider";
lang['cancel_button']   = "Annuler";
lang['save_button']     = "Enregistrer les informations";
lang['config_ok']       = "La configuration a été sauvegardée";

// Images utilisées dans le code HTML généré par le script
var imageList = new Array();
imageList["help"] = "http://data.hordes.fr/gfx/loc/fr/helpLink.gif";
imageList["map"]  = "http://data.hordes.fr/gfx/icons/r_explor.gif";
imageList["warning"]    = "http://www.hordes.fr/gfx/forum/smiley/h_warning.gif";
imageList["small_move"] = "http://data.hordes.fr/gfx/icons/small_move.gif";
imageList["anchor"]     = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAQAgMAAACXY5xCAAAAAXNSR0IArs4c6QAAAAlQTFRFHQgQXCsg3at2dnylcgAAAAF0Uk5TAEDm2GYAAAAJcEhZcwAACxMAAAsTAQCanBgAAABLSURBVAjXLcqxDcAgDETRjxRlB7ZhiSClN8yThn3DnXHh+8VjPT4Y3t6ojhduR0Ax+ki0CUabJAqFkIiQiZCJUGSUlQRmO1HPcun9kAcXQ2R1ivMAAAAASUVORK5CYII=";
imageList['tickOn']     = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAMBAMAAACgrpHpAAAAAXNSR0IArs4c6QAAAA9QTFRFZXQtm5ubgICA0+uIAAAAuS1B0AAAAAF0Uk5TAEDm2GYAAAAJcEhZcwAACxMAAAsTAQCanBgAAAA+SURBVAjXJcnBEQAhCEPRHLYBtwRbkAIU0n9NhvgPvMkAdPTFF8+SVGvLnD1Rb4JRYWtlmwx7yGP/OfxX8gLtpgvbL+3EgQAAAABJRU5ErkJggg==";
imageList['tickOff']    = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAMAgMAAAAv7mRJAAAAAXNSR0IArs4c6QAAAAlQTFRFAABn////AAAAPdfxGgAAAAF0Uk5TAEDm2GYAAAAJcEhZcwAACxMAAAsTAQCanBgAAAAiSURBVAjXY2BABatWNTAwTA0FErNWAokZnCgEWAwsC1IHADVYDWZWHqBeAAAAAElFTkSuQmCC";
imageList['close']      = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAMAAAC67D+PAAAAAXNSR0IArs4c6QAAAFFQTFRFAABge314e355fX96fX97foB7foF8f4F8f4F9f4J9gIJ9gYN+g4WAhIaBh4mEiIqFiIuGiYuHiouHioyHioyIjI6JjpCLkpSPlJaRlZeSl5mUYY42LgAAAAF0Uk5TAEDm2GYAAAABYktHRACIBR1IAAAACXBIWXMAAAUxAAAFMQG37ShSAAAAB3RJTUUH2wISEw0wuerZ8AAAAEVJREFUCNdjYEACXMwgkpUbSLCI8jAw8IqxgQR4xIVEJHghSvgkpQSgqln5BTlgLHZOYXYQi5EPqIOdnwkkyAgW4EK2AABttAHUyPINZQAAAABJRU5ErkJggg==";

// Si le debug mode n'est pas actif, on écrase l'objet console natif
if( typeof(console) == 'undefined' ) {// au cas où...
	console = {};
}

var name = null;
var tab  = ["log","info","warn","error","debug","dirxml","dir"];
while( (name = tab.pop()) != null ) {
	if( typeof(console[name]) != 'undefined' && !DEBUG_MODE ) {
		console[name] = function() {};
	}
}

//
// Compatibilité non-Gecko
//
if( !GM_AVAILABLE ) {
	console.log('We use non-native GM_*Value()');
	
	GM_getValue = function(name, defaultVal) {
		try {
			return (new RegExp('hmu_' + name + "=([^\\s;]+)", "g"))
				.test(document.cookie) ? decodeURIComponent(RegExp.$1) : defaultVal;
		}
		catch(e) {
			return defaultVal;
		}
	};
	
	GM_setValue = function(name, val) {
		var expire = new Date();
		expire.setTime(expire.getTime() + (365*24*60*60*1000));
		
		document.cookie =
			'hmu_' + name + '=' + encodeURIComponent(val) + ';' +
			'expires=' + expire.toGMTString() + ';' +
			'path=/';
	};
}

if( !GM_AVAILABLE ) {
	console.log('We use non-native GM_xmlhttpRequest()');
	
	GM_xmlhttpRequest = function(xhr) {
		console.log('Call to non-native GM_xmlhttpRequest()');
		
		var data = (typeof(xhr.data) != 'string') ?
			new XMLSerializer().serializeToString(xhr.data) : xhr.data;
		
		var img = document.createElement('img');
		img.addEventListener('load', function() {
			var code = this.width == 1 ? 'ok' : 'error';
			
			xhr.onload({
				status: 200,
				responseText: '<hordes><headers version="'+HMU_VERSION+'"/><error code="'+code+'"/></hordes>'
			});
		}, false);
		img.addEventListener('error', function() { xhr.onerror(); }, false);
		img.setAttribute('src', PROXY_URL + '?' +
			'url='+encodeURIComponent(xhr.url) + '&' +
			'data='+encodeURIComponent(data) + '&' +
			'rand='+Math.random()
		);
	};
}

if( typeof("".trim) == 'undefined' ) {
	String.prototype.trim = function() {
		return this.replace(/^\s+|\s+$/g, '');
	}
}

//
// Fonctions raccourcis
//
function $(id) { return document.getElementById(id); }

function $xpath(expression, contextNode, type)
{
	return (contextNode.nodeType == 9 ? contextNode : contextNode.ownerDocument)
		.evaluate(expression, contextNode, null, type, null);
}

function getLang(key)
{
	var str = lang[key].replace(/\n/g, '<br>');
	
	if( arguments.length > 1 ) {
		for(var i = 1, m = arguments.length; i < m; i++ ) {
			str = str.replace('$'+String(i), arguments[i]);
		}
	}
	
	return str;
}

var HMUpdater = {
	mainNode: null,
	styleSheet: null,
	lock: false,
	error: false,
	vars: {
		dried: -1,
		days: -1,
		hardcore: null,
		cityname: 'Unknown'
	}
};

HMUpdater.config = {
	_default: {'pubkeys':'', 'postdata_urls':''},
	
	_getArray: function(name) {
		var array = {};
		
		try {
			array = eval(GM_getValue(name, {}));
		}
		catch(e) { console.error('Error while parsing the \''+name+'\' entry'); }
		
		return array;
	},
	get: function(name) {
		var login = GM_getValue('login', '');
		var array = null;
		var value = '';
		
		if( name != 'login' && login != '' ) {
			array = this._getArray(name);
			value = (login in array) ? array[login] : (
				typeof(this._default[name]) != 'undefined' ? this._default[name] : false
			);
		}
		else {
			value = login;
		}
		
		return value;
	},
	set: function(name, value) {
		var login = GM_getValue('login', '');
		var array = null;
		
		if( typeof(value) == 'string' ) {
			value = value.trim();
		}
		
		if( name != 'login' && login != '' ) {
			array = this._getArray(name);
			array[login] = value;
			
			if( typeof(array.toSource) == 'undefined' ) {
				value = '';
				for( var index in array ) {
					if( typeof(array[index]) != 'string' && typeof(array[index]) != 'boolean' ) continue;
					
					value += ', ' + index + ': ' +
						(typeof(array[index]) == 'string' ? '"' + array[index] + '"' : array[index]);
				}
				
				value = '({' + value.substr(1, value.length) + '})';
			}
			else {
				value = array.toSource();
			}
		}
		
		GM_setValue(name, value);
	}
};

HMUpdater.initialize = function() {
	console.log('Call to HMUpdater.initialize()');
	
	//
	// Bouton "HMUpdater"
	//
	this.addStyle('#hmupdater { display:none; position:fixed; right:5px; bottom:5px; z-index:1000; border:2px solid black; }');
	this.addStyle('.hmu\\:class\\:box { border:1px solid #DDAB76; padding:5px 10px; color:inherit; background-color:#5c2b20; }');
	this.addStyle('#hmupdater strong { display:block; width:8.5em; text-align:center; cursor:pointer; color:#f0d79e; }');
	this.addStyle('#hmupdater strong:hover { text-shadow: 0 0 3px rgba(255,255,255,0.8); }');
	
	// Formulaire de coordonnées
	this.addStyle('#hmu\\:coords { display:none; position:absolute; z-index:2;' +
		'width:260px; margin-top:-40px; margin-left:5px; padding:4px; font-size:8pt;' +
		'background-color:#3B3249; border:1px solid #AFACC1; outline:2px solid black; }');
	this.addStyle('#hmu\\:coords p { background-color:#696486; margin-bottom:0; padding:0 3px; text-align:left; }');
	this.addStyle('#hmu\\:coords .field { display:block; margin:15px auto; }');
	this.addStyle('#hmu\\:coords .button { width:125px;float:left;text-align:center; }');
	this.addStyle('#hmu\\:coords .button + .button { float:right; }');
	
	// Bouton de mise à jour
	this.addStyle('#hmu\\:link * { vertical-align:middle; }');
	
	var root = document.createElement('div');
	root.setAttribute('id', 'hmupdater');
	root.setAttribute('title', getLang('root_title'));
	root.innerHTML = '<strong class="hmu:class:box">'+HMU_APPNAME+'</strong>';
	root.firstChild.addEventListener('click', function() {
		HMUpdater.form.toggle();
	}, false);
	document.body.appendChild(root);
	
	// Check de version
	if( HMU_CHECKVER != null ) {
		var script = document.createElement('script');
		script.setAttribute('id',   'hmu:script:last-version');
		script.setAttribute('type', 'application/javascript');
		script.setAttribute('src',  HMU_CHECKVER);
		root.appendChild(script);
	}
	
	//
	// On s'intercalle devant la méthode js.XmlHttp.onData() pour détecter les
	// changements de zone et mettre à jour les coordonnées
	//
	var init = function() {
		js.XmlHttp._hmu_onEnd = js.XmlHttp.onEnd;
		js.XmlHttp.onEnd = function() {
			var url = this.urlForBack;
			this._hmu_onEnd();
			
			var hmupdater = document.getElementById('hmupdater');
			hmupdater.setAttribute('data-hmu-url', url);
			// On ne peut pas récupérer HMU_LAST_VERSION directement dans init(),
			// il n'est pas encore dispo à ce moment-là sur chrome/chromium...
			if( !hmupdater.hasAttribute('data-hmu-last-version') && typeof(HMU_LAST_VERSION) != 'undefined' ) {
				hmupdater.setAttribute('data-hmu-last-version', HMU_LAST_VERSION);
			}
			
			var evt = document.createEvent('Events');
			evt.initEvent('HMUActionPerformed', false, false);
			document.dispatchEvent(evt);
		};
	};
	
	var script = document.createElement('script');
	script.setAttribute('id',   'hmu:script:init');
	script.setAttribute('type', 'application/javascript');
	root.appendChild(script);
	script.textContent = '(' + init.toString() + ')();';
	
	document.addEventListener('HMUActionPerformed', function(evt) {
		
		var url = $('hmupdater').getAttribute('data-hmu-url');
		
		console.log('HMUActionPerformed event dispatched; url = ' + url);
		
		if( /outside\/go\?x=(-?[0-9]+);y=(-?[0-9]+)/.test(url) ) {
			
			if( HMUpdater.coords.get() != null ) {
				
				var coords = HMUpdater.coords.get().split('.');
				
				// hack dégueu. Bug de hordes.fr qui incrémente l'ordonnée lors
				// d'un mouvement nord-sud (alors que cette axe court de +y à -y)
				var y = RegExp.$2.indexOf('-') == 0 ? Math.abs(RegExp.$2) : '-'+RegExp.$2;
				
				coords[0] = parseInt(coords[0]) + parseInt(RegExp.$1);
				coords[1] = parseInt(coords[1]) + parseInt(y);
				HMUpdater.coords.set(coords.join('.'));
			}
			
			HMUpdater.vars['dried'] = -1;
		}
		
		HMUpdater.refresh('event');
	}, false);
	
	// Refresh initial
	this.refresh('init');
};

HMUpdater.refresh = function(step) {
	console.log('Call to HMUpdater.refresh(); step = ' + String(step));
	
	if( $('swfmap') == null ) {
		console.info('#swfmap not found !');
		
		this.form.hide();
		this.message.clear();
		this.coords.set(null);
		$('hmupdater').style.display = 'none';
		
		//
		// Page de connexion au jeu ?
		//
		if( $('hordes_login') != null ) {
			$('hordes_login').addEventListener('submit', function() {
				HMUpdater.config.set('login', this.elements.namedItem('login').value);
			}, false);
		}
		
		return false;
	}
	else {
		$('hmupdater').style.display = 'block';
	}
	
	// Vérification de la dernière version publiée
	if( $('hmupdater').hasAttribute('data-hmu-last-version') ) {
		
		if( this.checkVersion($('hmupdater').getAttribute('data-hmu-last-version')) == true ) {
			this.message.clear();
			this.message.show(getLang('new_version', '<a href="' + HMU_APPHOME + '">', '</a>'), -1);
		}
	}
	
	if( $('hmu:link') != null ) {
		console.info('hmu:link already exist !');
		return false;
	}
	
	this.mainNode = $('generic_section');
	
	//
	// Ajout du bouton de mise à jour et du formulaire pour les coordonnées
	//
	var actionPanel = $xpath('./div[@class="left"]', this.mainNode,
		XPathResult.ANY_UNORDERED_NODE_TYPE).singleNodeValue;
	var viewPanel   = $xpath('./div[@class="right"]', this.mainNode,
		XPathResult.ANY_UNORDERED_NODE_TYPE).singleNodeValue;
	
	if( actionPanel == null || viewPanel == null ) {
		// Certains appels Ajax du site hordes.fr définissent le div#generic_section,
		// mais il ne contient pas encore les deux panneaux. Ils sont ajoutés
		// lors de l'appel Ajax suivant.
		console.info('actionPanel or viewPanel not found !');
		return false;
	}
	
	// Formulaire de coordonnées
	var coordsForm = document.createElement('form');
	coordsForm.setAttribute('action', '#');
	coordsForm.setAttribute('id', 'hmu:coords');
	coordsForm.innerHTML = '<p>'+getLang('coords_text')+'</p>' +
		'<input type="text" name="coords" class="field"/>' +
		'<input type="submit" value="'+getLang('valid_button')+'" class="button"/>' +
		'<input type="reset" value="'+getLang('cancel_button')+'" class="button"/>';
	coordsForm.addEventListener('submit', function(evt) {
		evt.preventDefault();
		var coords = this.elements.namedItem('coords').value.trim();
		
		if( /^-?[0-9]{1,2}(\.|,)-?[0-9]{1,2}$/.test(coords) ) {
			this.style.display = 'none';
			HMUpdater.coords.set(coords.replace(',', '.'));
			HMUpdater.updateMap();
		}
		else {
			HMUpdater.message.clear();
			HMUpdater.message.show(getLang('coords_error'), 6);
		}
	}, false);
	coordsForm.addEventListener('reset', function(evt) {
		this.style.display = 'none';
	}, false);
	
	actionPanel.appendChild(coordsForm);
	
	// Bouton de mise à jour
	var updateButton = document.createElement('a');
	updateButton.setAttribute('id',    'hmu:link');
	updateButton.setAttribute('class', 'button');
	updateButton.setAttribute('href',  '#outside/hmupdater');
	updateButton.innerHTML = '<img alt="" src="'+imageList['map']+'"/> <span>'+getLang('update_button')+'</span>';
	updateButton.lastChild.appendChild(document.createTextNode(this.coords.get() != null ? ' ('+this.coords.get()+')' : ''));
	updateButton.addEventListener('click', function(evt) {
		evt.preventDefault();
		
		if( HMUpdater.lock == false && this.className == 'button' ) {
			HMUpdater.updateMap();
		}
	}, false);
	
	actionPanel.appendChild(updateButton);
	
	//
	// Infos sur la ville
	//
	if( $('clock') != null ) {
		this.vars['cityname'] = $xpath('./div[@class="name"]', $('clock'),
			XPathResult.ANY_UNORDERED_NODE_TYPE).singleNodeValue.textContent.trim();
		
		var days = $xpath('./div[@class="day"]', $('clock'),
			XPathResult.ANY_UNORDERED_NODE_TYPE).singleNodeValue.textContent;
		
		if( /Jour\s+([0-9]+)/.test(days) ) {
			this.vars['days'] = RegExp.$1;
		}
		
		// Pandémonium ?
		if( this.vars['hardcore'] == null ) {
			this.vars['hardcore'] = $xpath('.//span[@class="hard"]', $('clock'),
				XPathResult.BOOLEAN_TYPE).booleanValue;
			if( this.vars['hardcore'] ) {
				console.log('Hardcore Mode detected - Restriction on data sent');
			}
		}
	}
	else {
		console.warn('#clock node doesn\'t exist (??)');
	}
	
	//
	// Zone épuisée ?
	// 
	// On vérifie ici et on stocke l'info. L'utilisation classique étant 
	// d'actualiser la page une dernière fois avant de mettre à jour la carte,
	// on aurait rarement l'info si ce bloc se trouvait dans updateMap())
	// (Contrôle de case perdu donc perte de l'info dans le code source HTML)
	// 
	if( this.vars['dried'] == -1 ) {
		var driedTest = $xpath('./div[@class="left"]/div[@class="driedZone"]',
			this.mainNode, XPathResult.BOOLEAN_TYPE).booleanValue;
		if( driedTest == true ) {// bloc "La zone est épuisée" présent
			this.vars['dried'] = 1;
		}
		else {
			// Si les zombies contrôlent la zone, on ne sait pas, sinon,
			// c'est que la zone n'est pas épuisée
			driedTest = $xpath('./div[@class="feist"]',
				this.mainNode, XPathResult.BOOLEAN_TYPE).booleanValue;
			if( driedTest == false ) {
				this.vars['dried'] = 0;
			}
		}
	}
};

HMUpdater.updateMap = function() {
	console.log('Call to HMUpdater.updateMap()');
	
	if( this.lock == true ) {
		return false;
	}
	
	this.message.clear();
	
	//
	// Récupération de la configuration
	//
	var login  = this.config.get('login');
	var pubkey = this.config.get('pubkeys');
	var postdata_url = this.config.get('postdata_urls');
	var updateCustom = this.config.get('updateCustom');
	var updateWebapp = false;
	var updateCount  = 0;
	
	if( updateCustom == true ) {
		updateCount++;
	}
	
	for( var name in webapps ) {
		webapps[name].update = this.config.get('update'+name);
		
		if( webapps[name].update == true ) {
			webapps[name].done = false;
			updateWebapp = true;
			updateCount++;
		}
	}
	
	this.isMultipleUpdate = (updateCount > 1);
	
	var displayConfigPanel = false;
	displayConfigPanel = (updateCustom == true && (pubkey == '' || postdata_url == ''));
	displayConfigPanel = displayConfigPanel || (!updateWebapp && !updateCustom);
	displayConfigPanel = displayConfigPanel || (login == '');
	
	if( displayConfigPanel ) {
		this.form.onvalidate = function() { HMUpdater.updateMap(); };
		this.form.show();
		return false;
	}
	
	//
	// Récupération des coordonnées de la case
	//
	var coords = this.coords.get();
	if( updateCustom == true && coords == null ) {
		this.coords.prompt();
		return false;
	}
	
	//
	// Récupération des données
	//
	console.log('Fetching data from HTML page');
	
	// Un bâtiment dans la zone ?
	var buildingName = '';
	var ruine = $xpath('count(./div[@class="outSpot"]//img[@alt="x"])',
		this.mainNode, XPathResult.NUMBER_TYPE).numberValue;
	
	if( ruine == 0 ) {
		buildingName = $xpath('./div[@class="outSpot"]/h2',
			this.mainNode, XPathResult.STRING_TYPE).stringValue;
	}
	
	// Récupération du statut de la case
	var caseTag = -1;
	var selectBox = $xpath('./div[@class="right"]//select[@name="tid"]',
		this.mainNode, XPathResult.ANY_UNORDERED_NODE_TYPE).singleNodeValue;
	if( selectBox != null ) {
		caseTag = parseInt(selectBox.value);
	}
	
	// Récupération du nombre de zombies
	var zombiePts = -1;
	if( $('zombiePts') != null && /([0-9]+)\s+points?/.test($('zombiePts').textContent) ) {
		zombiePts = RegExp.$1;
	}
	
	// Listing des objets présents par terre
	var items = $xpath('./div[@class="right"]/ul[contains(concat(" ", @class, " "), " outInv ")]//img[@alt="item"]',
		this.mainNode, XPathResult.ANY_TYPE);
	var item = null;
	var itemsArray = [];
	
	while( !this.vars['hardcore'] && (item = items.iterateNext()) != null ) {
		name = item.getAttribute('src');
		name = (/\/item_([^\/.]+)/.test(name) == true) ? RegExp.$1 : '';
		
		if( typeof(itemsArray[name]) == 'undefined' ) {
			itemsArray[name] = [];
			itemsArray[name]['broken'] = 0;
			itemsArray[name]['notbroken'] = 0;
		}
		
		if( item.parentNode.className.trim() == 'limited' ) {// Objet cassé
			itemsArray[name]['broken']++;
		}
		else {
			itemsArray[name]['notbroken']++;
		}
	}
	
	//
	// Génération du document XML
	//
	console.log('Generating XML document');
	
//	var doc = document.implementation.createDocument("", "hordes", null);
	// TODO : temporaire; pour Safari 5 + NinjaKit
	var doc = new DOMParser().parseFromString('<hordes></hordes>', 'application/xml');
	
	var headers = doc.createElement('headers');
	headers.setAttribute('version',   HMU_VERSION);
	headers.setAttribute('generator', HMU_APPNAME);
	doc.documentElement.appendChild(headers);
	
	var city = doc.createElement('city');
	city.setAttribute('name', this.vars['cityname']);
	city.setAttribute('days', this.vars['days']);
	doc.documentElement.appendChild(city);
	
	var citizen = doc.createElement('citizen');
	citizen.setAttribute('login', login);
	doc.documentElement.appendChild(citizen);
	
	var zone = doc.createElement('zone');
	
	// tas de sable éventuels
	if( ruine > 0 ) {
		zone.setAttribute('name', 'unknown');
		zone.setAttribute('ruine', ruine);
	}
	// Bâtiment éventuel
	else if( buildingName != '' ) {
		zone.setAttribute('name', buildingName);
	}
	
	if( coords != null ) {
		coords = coords.split('.');
		zone.setAttribute('x', coords[0]);
		zone.setAttribute('y', coords[1]);
	}
	
	zone.setAttribute('tag', caseTag);// Statut de la zone
	zone.setAttribute('dried', this.vars['dried']);// Zone épuisée ou pas, ou inconnu
	zone.setAttribute('zombie', zombiePts);
	doc.documentElement.appendChild(zone);
	
	items = doc.createElement('items');
	doc.documentElement.appendChild(items);
	
	item = doc.createElement('item');
	
	for( name in itemsArray ) {
		if( typeof(itemsArray[name]) != 'object' ) continue;
		
		if( itemsArray[name]['broken'] > 0 ) {
			item = item.cloneNode(false);
			item.setAttribute('name',  name);
			item.setAttribute('count', itemsArray[name]['broken']);
			item.setAttribute('broken', '1');
			items.appendChild(item);
		}
		
		if( itemsArray[name]['notbroken'] > 0 ) {
			item = item.cloneNode(false);
			item.setAttribute('name',  name);
			item.setAttribute('count', itemsArray[name]['notbroken']);
			item.removeAttribute('broken');
			items.appendChild(item);
		}
	}
	
	console.dirxml(doc);
	
	this.lock  = true;
	this.error = false;
	
	// On affichage l'image de chargement
	$('loading_section').style.display = 'block';
	document.body.style.cursor = 'progress';
	
	for( name in webapps ) {
		webapps[name].update = this.config.get('update'+name);
		
		if( webapps[name].update == true ) {
			this.sendData(webapps[name], doc);
		}
	}
	
	if( updateCustom == true ) {
		var urls = postdata_url.split('|');
		for( var i = 0, m = urls.length; i < m; i++ ) {
			this.sendData({id: null, url: urls[i], key: pubkey, xml: true}, doc);
		}
	}
};

HMUpdater.sendData = function(webapp, doc) {
	if( webapp.id != null && webapp.key == null ) {
		console.log('Fetching disclaimer to get secret key; webapp = ' + webapp.label);
		
		var xhr = new XMLHttpRequest();
		xhr.open('GET', '/disclaimer?id=' + webapp.id + ';rand='  + Math.random(), true);
		xhr.setRequestHeader('Accept', 'text/xml,application/xml');
		xhr.setRequestHeader('X-Handler','js.XmlHttp');
		xhr.onload = function() {
			if( /name=\"key\"\s+value=\"([a-zA-Z0-9]+)\"/.test(this.responseText) ) {
				webapp.key = RegExp.$1;
			}
			
			HMUpdater.sendData(webapp, doc);
		};
		xhr.send(null);
		
		return false;
	}
	
	function ixhr(webapp, doc)
	{
		this.timer   = null;
		this.method  = 'POST';
		this.url     = webapp.url;
		
		/:\/\/([^\/]+)\//.test(this.url);
		this.host    = RegExp.$1;
		
		this.headers = {
			'X-Handler'  : HMU_APPNAME,
			'User-Agent' : HMU_APPNAME + '/' + HMU_VERSION
		};
		
		if( webapp.xml == false ) {
			this.headers['Content-Type'] = 'application/x-www-form-urlencoded';
			this.data = 'key='+webapp.key+'&mode=xml';
		}
		else {
			doc.getElementsByTagName('citizen')[0].setAttribute('key', webapp.key);
			
			this.headers['Content-Type'] = 'application/xml';
			this.data = doc;
		}
		
		this.onerror = function() {
			console.log("Request to URL '" + this.url + "' failed");
			
			clearTimeout(this.timer);
			webapp.done = true;
			this.onload = function(){};
			
			HMUpdater.message.error(getLang('update_error1', '<strong>'+this.host+'</strong>'));
			HMUpdater.finishUpdate();
		};
		
		this.onload  = function(responseDetails) {
			console.log("Request to URL '" + this.url + "'");
			
			clearTimeout(this.timer);
			webapp.done = true;
			
			var target = '<strong>';
			target += (webapp.id != null) ? webapp.label : this.host;
			target += '</strong>';
			
			if( responseDetails.status == 200 ) {
				var code = message = null;
				
				if( webapp.xml == true ) {
					try {
						var doc = new DOMParser().parseFromString(responseDetails.responseText, 'application/xml');
						var error = doc.getElementsByTagName('error')[0];
						
						code = error.getAttribute('code');
						message = error.textContent.replace(/</g, '&lt;');
					}
					catch(e) {
						message = getLang('update_error2');
						console.log(e.name + ' : ' + e.message);
						code = 'error';
					}
				}
				else {
					// TODO ?
					code = 'ok';
				}
				
				if( code == 'ok' ) {
					HMUpdater.message.show(HMUpdater.isMultipleUpdate == true ?
						getLang('update_ok2', target) : getLang('update_ok1'));
				}
				else {
					HMUpdater.message.error(getLang('update_error3', target, (message != null ? "<br/><em>" + message + "</em>" : "")),
						// Ajustement du délai avant de masquer la boite à message
						(message != null ? message.length/10 : null)
					);
				}
				
				console.log('Response : ' + responseDetails.responseText);
			}
			else {
				var httpResponse = responseDetails.status + ' ' + responseDetails.statusText;
				HMUpdater.message.error(getLang('update_error4', target, httpResponse));
				console.log('Response : HTTP ' + httpResponse);
			}
			
			HMUpdater.finishUpdate();
		};
		
		// On fait ça ici pour être dans le scope de la fonction et avoir
		// le bon objet xhr dans la fonction anonyme du setTimeout
		var xhr = this;
		this.timer = setTimeout(function() {xhr.onerror();}, (HMU_TIMEOUT * 1000));
	}
	
	GM_xmlhttpRequest(new ixhr(webapp, doc));
};

HMUpdater.finishUpdate = function() {
	
	var displayMessage = true;
	for( var name in webapps ) {
		if( webapps[name].update && !webapps[name].done ) {
			displayMessage = false;
			break;
		}
	}
	
	if( displayMessage ) {
		console.log('Update action finished');
		// On masque l'image de chargement
		$('loading_section').style.display = 'none';
		document.body.style.cursor = 'auto';
		
		this.lock = false;
		this.message.show(null);
		
		if( this.error == false ) {
			$('hmu:link').className = 'button off';
		}
	}
};

HMUpdater.coords = {
	value: null,
	
	get: function() {
		return this.value;
	},
	set: function(val) {
		this.value = val;
		
		if( $('hmu:link') != null ) {
			$('hmu:link').lastChild.lastChild.data = (val == null) ? '' : '\u00A0(' + val + ')';
		}
	},
	prompt: function() {
		console.info('Need coords to be set manually');
		$('hmu:coords').style.display = 'block';
		$('hmu:coords').elements.namedItem('coords').focus();
	}
};

HMUpdater.message = {
	timer: null,
	html: null,
	delay: 0,
	defaultDelay: 4.5,
	// function(message, delay = 4.5)
	show: function(message) {
		if( this.html == null ) {
			this.create();
		}
		
		if( this.timer != null ) {
			clearInterval(this.timer);
			this.timer = null;
		}
		
		if( message != null && this.delay >= 0 ) {
			var line = document.createElement('li');
			line.innerHTML = message;
			this.html.firstChild.appendChild(line);
			this.delay += (arguments.length > 1 && arguments[1] != null) ? arguments[1] : this.defaultDelay;
		}
		
		if( HMUpdater.lock == false ) {
			this.html.style.opacity = '1.0';
			this.html.style.display = 'block';
			
			if( this.delay > 0 ) {
				this.timer = setTimeout(function() {HMUpdater.message.hide();}, (this.delay * 1000));
			}
			
			this.delay = 0;
		}
	},
	// function(message, delay = 4.5)
	error: function(message) {
		HMUpdater.error = true;
		this.show(message, ((arguments.length > 1 && arguments[1] != null) ? arguments[1] : this.defaultDelay));
		
		var image = document.createElement('img');
		image.setAttribute('alt', '');
		image.setAttribute('class', 'error');
		image.setAttribute('src', imageList['warning']);
		this.html.firstChild.lastChild.insertBefore(image,
			this.html.firstChild.lastChild.firstChild);
	},
	hide: function() {
		this.html.style.opacity = 0;
		// Crade mais les transitions events, c'est pas encore d'actualité...
		this.timer = setTimeout(function(){
			HMUpdater.message.clear();
		}, 1600);
	},
	clear: function() {
		if( this.html != null ) {
			this.delay = 0;
			this.html.style.display = 'none';
			this.html.firstChild.innerHTML = '';
		}
	},
	create: function() {
		HMUpdater.addStyle('#hmu\\:message { transition: opacity 1.4s; -o-transition: opacity 1.4s; -moz-transition: opacity 1.4s; -webkit-transition: opacity 1.4s;' +
			'box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.8); -moz-box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.8); -webkit-box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.8);' +
			'display:none; position:fixed; bottom:3.4em; right:2.4em;' +
			'z-index:1001; min-width:250px; max-width:500px; text-align:left;' +
			'border-radius:8px; -moz-border-radius:8px; font-family:"DejaVu Sans","Bitstream Vera Sans",Verdana,sans-serif;}');
		HMUpdater.addStyle('#hmu\\:message img.error { vertical-align:bottom; margin-right:3px; margin-bottom:-1px; }');
		HMUpdater.addStyle('#hmu\\:message img.pointer { position:absolute; right:25px; bottom:-16px; }');
		HMUpdater.addStyle('#hmu\\:message strong { color:#EDCDA9 }');
		HMUpdater.addStyle('#hmu\\:message ul { margin:0; padding:0; list-style:none; line-height:1.35; }');
		HMUpdater.addStyle('#hmu\\:message li:not(:first-child) { border-top:1px solid #DDAB76; margin-top:3px; padding-top:3px; }');
		HMUpdater.addStyle('#hmu\\:message li:last-child { padding-right: 18px; }');
		HMUpdater.addStyle('#hmu\\:message img.close { position:absolute; right:5px; bottom:5px; opacity:.5; cursor:pointer; }');
		HMUpdater.addStyle('#hmu\\:message:hover img.close { opacity:1; }');
		
		this.html = document.createElement('div');
		this.html.setAttribute('id', 'hmu:message');
		this.html.setAttribute('class', 'hmu:class:box');
		this.html.innerHTML = '<ul></ul>' +
			'<img alt="" class="pointer" src="'+imageList['anchor']+'">' +
			'<img alt="" class="close" src="'+imageList['close']+'">';
		this.html.lastChild.addEventListener('click', function() {
			clearTimeout(HMUpdater.message.timer);
			HMUpdater.message.clear();
		}, false);
		
		document.body.appendChild(this.html);
	}
};

HMUpdater.form = {
	html: null,
	onvalidate: null,
	
	show: function() {
		if( this.html == null ) {
			this.create();
		}
		
		$('hmu:erase').className = 'toolAction';
		document.body.className = 'hideSwf';
		this.html.style.display = 'block';
	},
	hide: function() {
		if( this.html != null ) {
			document.body.className = '';
			this.html.style.display = 'none';
		}
	},
	toggle: function() {
		if( this.html == null || this.html.style.display != 'block' ) {
			this.show();
		}
		else {
			this.hide();
		}
	},
	validate: function() {
		var login = $('hmu:login').value.trim();
		HMUpdater.config.set('login', login);
		
		if( login != '' ) {
			var pubkey = $('hmu:pubkey').value.trim();
			HMUpdater.config.set('pubkeys', pubkey);
			
			var postdata_url = $('hmu:url').value.trim();
			// hack patam@p carte sans flux
			if( /^http:\/\/(www\.)?patastream\.(com|fr)\//.test(postdata_url) ) {
				postdata_url = postdata_url.replace('view_ville', 'xmlpost');
			}
			// end hack
			
			HMUpdater.config.set('postdata_urls', postdata_url);
			HMUpdater.config.set('updateCustom', $('hmu:choice:custom').checked);
			
			for( var name in webapps ) {
				HMUpdater.config.set('update'+name, $('hmu:choice:'+name).checked);
			}
		}
	},
	create: function() {
		HMUpdater.addStyle('#hmu\\:form { display:none; position:fixed; width:100%; top:0; left:0; margin-top:22%; }');
		HMUpdater.addStyle('#hmu\\:form .hmu\\:class\\:box { position:absolute; z-index:1002;' +
			'left:0; right:0; margin:auto; width:550px; outline:2px solid black; padding:5px; border-color:#b37c4a; }');
		HMUpdater.addStyle('#hmu\\:form .form { width:auto; margin:0; padding:5px; }');
		HMUpdater.addStyle('#hmu\\:form .row label { display:inline-block; float:none;' +
			'width:200px; height:auto; margin: 2px 10px 2px 0; padding-left:5px; line-height: 1.3; cursor:pointer; }');
		HMUpdater.addStyle('#hmu\\:form .checkboxList label { width:242px; vertical-align:middle;white-space:nowrap;' +
			'background-repeat: no-repeat; background-position: 5px 3px; padding-left:20px; }');
		HMUpdater.addStyle('#hmu\\:form .checkboxList label:nth-of-type(even) { margin-right: 0; }');
		HMUpdater.addStyle('#hmu\\:form .checkboxList label.on { background-image: url("'+imageList['tickOn']+'"); }');
		HMUpdater.addStyle('#hmu\\:form .checkboxList label.off { background-image: url("'+imageList['tickOff']+'"); }');
		HMUpdater.addStyle('#hmu\\:form .checkboxList label * { vertical-align: middle; }');
		HMUpdater.addStyle('#hmu\\:form .checkboxList input[type="checkbox"] { display:none; }');
		HMUpdater.addStyle('#hmu\\:form .special { min-height:0;margin:8px 2px 10px; padding-left:20px;' +
			'background:transparent url("'+imageList['small_move']+'") no-repeat center left; }');
		HMUpdater.addStyle('#hmu\\:form a.toolAction { text-decoration:underline; }');
		HMUpdater.addStyle('#hmu\\:form a.helpLink { position:relative;top:4px; }');
		
		var checkboxList = '';
		for( var name in webapps ) {
			checkboxList += '<input type="checkbox" id="hmu:choice:'+name+'"><label><span>' + getLang('checkbox_webapp', webapps[name].label) + '</span></label>';
		}
		
		this.html = document.createElement('div');
		this.html.setAttribute('id', 'hmu:form');
		this.html.innerHTML = '<div class="hmu:class:box"><form action="#" class="form">' +
'<div class="row checkboxList">' + checkboxList + '</div>' +
'<div class="row checkboxList">' +
'<input type="checkbox" id="hmu:choice:custom"><label><span>' + getLang('checkbox_custom') + '</span></label>' +
'<a class="helpLink" onmouseout="js.HordeTip.hide()" onmouseover="js.HordeTip.showHelp(this,\'' + getLang('custom_tooltip').replace('\'', '\\\'') + '\');document.getElementById(\'tooltip\').style.zIndex = 1003;" onclick="return false;" href="#">' +
'<img alt="Aide" src="'+imageList['help']+'"/></a>' +
'</div><div class="row">' +
'<label for="hmu:login">'+getLang('input_login')+'&nbsp;:</label>' +
'<input type="text" id="hmu:login" class="field" size="35"/>' +
'</div><div id="hmu:custom:infos">' +
'<div class="row">' +
'<label for="hmu:url">'+getLang('input_url')+'&nbsp;:</label>' +
'<input type="text" id="hmu:url" class="field" size="35"/>' +
'</div><div class="row">' +
'<label for="hmu:pubkey">'+getLang('input_pubkey')+'&nbsp;:</label>' +
'<input type="text" id="hmu:pubkey" class="field" size="35"/>' +
'</div><div class="row special">' +
'<a id="hmu:erase" class="toolAction" href="#outside/hmupdater?do=erase.coords">'+getLang('reset_coords')+'</a>' +
'</div></div>' +
'<input type="submit" value="'+getLang('save_button')+'" class="button"/>' +
'</form></div>' +
'<div class="black"></div>';
		
		document.body.appendChild(this.html);
		
		// Pour masquer le formulaire si on clique en dehors
		// this.html.lastChild == div.black
		this.html.lastChild.addEventListener('click', function(evt) {
			if( this == evt.currentTarget ) {
				HMUpdater.form.hide();
			}
		}, false);
		
		// Initialisation des champs du formulaire
		var login  = HMUpdater.config.get('login');
		var pubkey = HMUpdater.config.get('pubkeys');
		var url    = HMUpdater.config.get('postdata_urls');
		
		var updateCustom = HMUpdater.config.get('updateCustom');
		$('hmu:choice:custom').checked = updateCustom;
		
		for( name in webapps ) {
			$('hmu:choice:'+name).checked = HMUpdater.config.get('update'+name);
		}
		
		if( updateCustom == false ) {
			$('hmu:custom:infos').style.display = 'none';
		}
		
		// Ajout des guetteurs sur les <label> des div.checkboxList
		var labelList = $xpath('//div[@class="row checkboxList"]/label', this.html, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE);
		for( var i = 0, label = null, input = null, m = labelList.snapshotLength; i < m; i++ ) {
			
			label = labelList.snapshotItem(i);
			input = label.previousSibling;// input[type="checkbox"]
			
			label.toggle = function(bool) {
				this.className = bool ? 'on' : 'off';
			};
			
			// Récupérer notre label, via evt.currentTarget par exemple, ne conviendrait
			// pas. Du fait du système de sandbox de greasemonkey, le label ainsi récupéré
			// ne possèderait pas la méthode toggle() définie plus haut.
			// Au lieu de cela, on utilise une fermeture pour "capturer" nos label et input.
			// Un peu "compliqué", mais pour le plaisir d’utiliser une fermeture...
			label.addEventListener('click', (function(label, input) {
				return function() {
					input.checked  = !input.checked;
					label.toggle(input.checked);
					
					if( input.getAttribute('id') == 'hmu:choice:custom' ) {
						$('hmu:custom:infos').style.display =
							input.checked ? 'block' : 'none';
					}
				};
			})(label, input), false);
			
			// 'Valeur' initiale du span.checkbox
			label.toggle(input.checked);
		}
		
		$('hmu:login').value  = login;
		$('hmu:pubkey').value = pubkey;
		$('hmu:url').value    = url;
		
		$('hmu:erase').addEventListener('click', function(evt) {
			evt.preventDefault();
			HMUpdater.coords.set(null);
			this.className = 'lockedAction';
		}, false);
		
		this.html.firstChild.firstChild.addEventListener('submit', function(evt) {
			evt.preventDefault();
			HMUpdater.form.validate();
			HMUpdater.form.hide();
			
			if( HMUpdater.form.onvalidate != null ) {
				var callback = HMUpdater.form.onvalidate;
				HMUpdater.form.onvalidate = null;
				callback();
			}
			else {
				HMUpdater.message.clear();
				HMUpdater.message.show(getLang('config_ok'));
			}
		}, false);
	}
};

HMUpdater.addStyle = function(rule) {
	if( this.styleSheet == null ) {
		var style = document.createElement('style');
		style.setAttribute('type', 'text/css');
		document.getElementsByTagName('head')[0].appendChild(style);
		this.styleSheet = style.sheet;
	}
	
	try {
		return this.styleSheet.insertRule(rule, this.styleSheet.cssRules.length);
	}
	catch(e) { console.error('Failed to insert CSS rule (' + rule + ')'); }
};

HMUpdater.checkVersion = function(version) {
	var v1 = String(HMU_VERSION).split('.');
	var v2 = String(version).split('.');
	
	v1[0] = Number(v1[0]);v1[1] = Number(v1[1]);
	v2[0] = Number(v2[0]);v2[1] = Number(v2[1]);
	
	return (v2[0] > v1[0] || (v2[0] == v1[0] && v2[1] > v1[1]));
};

//
// Initialisation du script
//
HMUpdater.initialize();

})();
