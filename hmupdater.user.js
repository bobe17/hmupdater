/**
 * hmupdater.user.js
 * Copyright (c) 2008 Aurélien Maille
 * Released under the GPL license 
 * 
 * @version 0.3
 * @author  Aurélien Maille <bobe+hordes@webnaute.net>
 * @link    http://dev.webnaute.net/Applications/HMUpdater/
 * @license http://www.gnu.org/copyleft/gpl.html  GNU General Public License
 * @charset UTF-8
 */

// --------------------------------------------------------------------
// 
// This is a Greasemonkey user script.
// 
// To install, you need Greasemonkey: http://www.greasespot.net/
// Then restart Firefox and revisit this script.
// Under Tools, there will be a new menu item to "Install User Script".
// Accept the default configuration and install.
// 
// To uninstall, go to Tools/Manage User Scripts,
// select "HMUpdater", and click Uninstall.
// 
// --------------------------------------------------------------------
// 
// ==UserScript==
// @name           HMUpdater
// @namespace      http://dev.webnaute.net/Applications/HMUpdater
// @description    Mise à jour de HordesM@p à partir de hordes.fr
// @include        http://www.hordes.fr/#outside
// @include        http://www.hordes.fr/#
// @include        http://www.hordes.fr/
// ==/UserScript==
// 
// --------------------------------------------------------------------
// 
// @todo
// - Récupération automatique des coordonnées de la case
// - Pouvoir configurer de façon user-friendly le login et l'URL de l'application réceptrice
// - Lien parfois non ajouté à la sortie de la ville; obligé d'actualiser la page
// - Compatibilité avec Opera et Safari ? (plus lointain et incertain)
//

const HMU_VERSION  = '0.3';
const HMU_APPNAME  = 'HMUpdater';
const HMU_TIMEOUT  = 10;// en secondes
const HMU_APPHOME  = 'http://dev.webnaute.net/Applications/HMUpdater/';
const POSTDATA_URL = 'http://patastream.com/patamap/?page=xmlpost';
var HMU_VARS = [];


function HMU_getLogin(force)
{
	var login = GM_getValue('login', '');
	
	if( (force || login == '') && (login = prompt("Saisissez votre pseudo de joueur à hordes :", login)) != null ) {
		login = login.trim();
		GM_setValue('login', login);
	}
	
	return login == null ? '' : login;
}

function HMU_getPostdataURL(force)
{
	var login = GM_getValue('login', '');
	var postdata_urls = {};
	
	try {
		postdata_urls = eval(GM_getValue('postdata_urls', {}));
	}
	catch(e) {}
	
	var postdata_url = (login in postdata_urls) ? postdata_urls[login] : POSTDATA_URL;
	
	if( (force || postdata_url == '') && (postdata_url = prompt("Saisissez l’URL de l’application externe :", postdata_url)) != null ) {
		// hack patam@p
		if( /^http:\/\/(www\.)?patastream\.(com|fr)\//.test(postdata_url) ) {
			postdata_url = postdata_url.replace('view_ville', 'xmlpost');
		}
		// end hack
		postdata_url = postdata_url.trim();
		postdata_urls[login] = postdata_url;
		GM_setValue('postdata_urls', postdata_urls.toSource());
	}
	
	return postdata_url == null ? '' : postdata_url;
}

GM_registerMenuCommand('Configurer ' + HMU_APPNAME, function() {
	HMU_getLogin(true);
	HMU_getPostdataURL(true);
});

if( typeof("".trim) == 'undefined' ) {
	String.prototype.trim = function() {
		return this.replace(/^\s+|\s+$/g, '');
	}
}

var loadingSection = {
	show: function() {
		document.getElementById('loading_section').style.display = 'block';
		document.body.style.cursor = 'progress';
	},
	hide: function() {
		document.getElementById('loading_section').style.display = 'none';
		document.body.style.cursor = 'default';
	}
};

var Message  = {
	timer: null,
	html: null,
	// function(message, delay = 4)
	show: function(message) {
		if( this.html == null ) {
			this.create();
		}
		
		this.html.innerHTML = "<strong>HMUpdater</strong>\u00A0: " + message;
		this.html.style.opacity = '1.0';
		this.html.style.display = 'block';
		
		var delay = arguments.length > 1 ? arguments[1] : 4;
		if( delay > 0 ) {
			setTimeout(function() {Message.hide();}, (delay * 1000));
		}
		
		loadingSection.hide();
	},
	hide: function() {
		this.timer = setInterval(function() {Message.reduceOpacity();}, 60);
	},
	reduceOpacity: function() {
		var opacity = parseFloat(this.html.style.opacity);
		opacity = (Math.round((opacity - 0.1) * 10) / 10);
		
		this.html.style.opacity = opacity;
		
		if( opacity <= 0 ) {
			this.html.style.display = 'none';
			clearInterval(this.timer);
		}
	},
	create: function() {
		this.html = document.createElement('div');
		this.html.setAttribute('id', 'hmupdater:message');
		this.html.style.cssText = 'display:none; min-width:300px; max-width:550px; position:fixed;' +
			'right: 5px; bottom: 5px; z-index:10; padding:5px 10px; color:#f0d79e;' +
			'background-color:#5c2b20; border:1px solid #b37c4a; outline:2px solid black;';
		document.body.appendChild(this.html);
	}
};

// voir bloc 'TEMPORAIRE' un peu plus bas
HMU_VARS['eraseCoords'] = true;

//
// lancement du refresh
//
var timer = setInterval(function() {

//
// Page de connexion au jeu ?
//
if( document.getElementById('hordes_login') != null ) {
	document.getElementById('hordes_login').addEventListener('submit', function(evt) {
		GM_setValue('login', document.getElementById('login').value.trim());
	}, false);
	clearInterval(timer);
	return false;
}

if( document.getElementById('hmupdater:link') != null || document.getElementById('generic_section') == null ) {
	return false;
}

//
// Infos sur la ville
//
var mapInfos = document.getElementById('mapInfos');
/Jour\s+([0-9]+),/.test(mapInfos.textContent);

HMU_VARS['mapInfos'] = [];
HMU_VARS['mapInfos']['days'] = RegExp.$1;
HMU_VARS['mapInfos']['name'] = mapInfos.firstChild.data.trim();

//
// Récupération de la clef API
//
HMU_VARS['key'] = null;

if( document.getElementById('sites') != null ) {
	var listing = document.getElementById('sites').getElementsByTagName('a');
	
	for( var i = 0, m = listing.length; i < m; i++ ) {
		if( /(?:\?|&)key=([a-zA-Z0-9]+)/.test(listing[i].href) ) {
			HMU_VARS['key'] = RegExp.$1;
			break;
		}
	}
	
	if( HMU_VARS['key'] == null ) {// Applications externes non autorisées; pas de clef API
		Message.show("Impossible de récupérer votre clef API. "
			+ "Avez-vous pensé à autoriser les applications externes dans la section "
			+ "<a href='/#ghost/city?go=ghost/options'>Votre âme/Réglages</a>\u00A0?", 20);
		clearInterval(timer);
		return false;
	}
}

var GENERIC_SECTION_NODE = document.getElementById('generic_section');

var refresh_link = document.evaluate('a[@href="#outside/refresh"]',
	GENERIC_SECTION_NODE, null, XPathResult.ANY_TYPE, null);
if( (refresh_link = refresh_link.iterateNext()) == null ) {
	return false;
}

//////////////////////////
// TEMPORAIRE
// 
// But de la fonction:
// Le problème est que je ne peux pas détecter (actuellement) un
// changement de case, ni obtenir les coordonnées de la case par moi-même.
// Je dois donc demander systématiquement les coordonnées au joueur.
// La fonction suivante détecte si l'utilisateur fait certaines actions
// qui ont rafraichi la page sans que ce soit un changement de case
// (liens actualiser, fouiller, explorer, déblayer, envoyer un message dans le chat, etc).
// Dans ces cas-là, on réutilise les coordonnées gardées en mémoire, ce sera
// toujours ça...
if( GENERIC_SECTION_NODE.hasAttribute('hmupdater:init') == false ) {

	GENERIC_SECTION_NODE.addEventListener('click', function(evt) {
		var node = evt.target;
		
		if( evt.eventPhase != evt.CAPTURING_PHASE ) {
			return false;
		}
		
		// liens "actualiser"
		if( node.nodeName == 'A' && node.getAttribute('href') == '#outside/refresh' ) {
			HMU_VARS['eraseCoords'] = false;
		}
		// déplacement d'objets entre le sac et le sol et vice versa
		else if( node.nodeName == 'IMG' && node.getAttribute('alt') == 'item' && node.parentNode.nodeName == 'A' ) {
			HMU_VARS['eraseCoords'] = false;
		}
		// envoi de message sur le "chat"
		// - firefox prend aussi le click si on sélectionne le "bouton" avec la touche tab + entrée
		//   ou si on tape entrée dans le champ texte à la fin de son message.
		//   Tant mieux, ça me facilite les choses.
		else if( node.nodeName == 'INPUT' && node.getAttribute('name') == 'submit' ) {
			HMU_VARS['eraseCoords'] = false;
		}
		// plus compliqué pour les liens de la colonne 'left' car le target peut avoir
		// plusieurs valeurs, on va s'y prendre autrement et remonter l'arborescence
		else {
			while( node.nodeName != 'A' && node != evt.currentTarget ) {
				node = node.parentNode;
			}
			
			if( node.nodeName == 'A' ) {
				var target = node.getAttribute('href');
				
				if( target.substr(0, 8) == '#outside' ) {
					switch( target ) {
						case '#outside/pick':// fouille
						case '#outside/dig':// exploration de bâtiment
						case '#outside/extractBuilding':// déblaiement de ruines
							HMU_VARS['eraseCoords'] = false;
							break;
					}
				}
				else if( /#tool\/[0-9]+\/use/.test(target) ) {// Utilisation d'un objet
					HMU_VARS['eraseCoords'] = false;
				}
			}
		}
	}, true);
	
	// On s'occupe aussi de la liste déroulante de changement de statut de la zone
	GENERIC_SECTION_NODE.addEventListener('change', function(evt) {
		if( evt.target.getAttribute('name') == 'tid' ) {
			HMU_VARS['eraseCoords'] = false;
		}
	}, true);
	
	GENERIC_SECTION_NODE.setAttribute('hmupdater:init', 'true');
}
//////////////////////////

if( HMU_VARS['eraseCoords'] ) {
	HMU_VARS['coords'] = '';
}
else {
	HMU_VARS['eraseCoords'] = true;
}

// Utilisé pour éviter de renvoyer le XML si rien n'a changé sur la case
HMU_VARS['zone_updated'] = false;

//
// Ajout du lien de mise à jour
//
var cssText = 'float:right;margin-left:15px;font-size:8pt;';
refresh_link.removeAttribute('class');
refresh_link.style.cssText = cssText;

var link = document.createElement('a');
link.setAttribute('id',   'hmupdater:link');
link.setAttribute('href', '#outside/hmupdater');
link.style.cssText = cssText;

link.appendChild(document.createTextNode('Mettre à jour la M@p'));

refresh_link.parentNode.insertBefore(link, refresh_link.nextSibling);
refresh_link.parentNode.insertBefore(document.createTextNode(' '), refresh_link);

//////////////////////////////////////////////
link.addEventListener('click', function(evt) {
	
	evt.preventDefault();
	evt.stopPropagation();
	
	//
	// Récupération du pseudo
	//
	var login = HMU_getLogin(false);
	if( login == '' ) {
		return false;
	}
	
	//
	// Récupération de l'URL à appeler
	//
	var postdata_url = HMU_getPostdataURL(false);
	if( postdata_url == '' ) {
		return false;
	}
	
	//
	// Récupération des coordonnées de la case
	//
	var coords = HMU_VARS['coords'];
	if( coords == '' ) {
		if( (coords = prompt("Saisissez les coordonnées de la case (format\u00A0: x.y)")) != null ) {
			if( /^[0-9]{1,2}(\.|,)[0-9]{1,2}$/.test(coords) ) {
				coords = coords.replace(',', '.');
				HMU_VARS['coords'] = coords;
			}
			else {
				Message.show("Mauvais format de coordonnées\u00A0! (formats acceptés\u00A0: x.y ou x,y)", 6);
				return false;
			}
		}
		else {
			return false;
		}
	}
	
	//
	// Récupération des données
	//
	
	// Un bâtiment dans la zone ?
	var buildingName = '';
	var ruine = document.evaluate('count(div[@class="outSpot"]//img[@alt="x"])',
		GENERIC_SECTION_NODE, null, XPathResult.NUMBER_TYPE, null).numberValue;
	
	if( ruine == 0 ) {
		buildingName = document.evaluate('div[@class="outSpot"]/h2',
			GENERIC_SECTION_NODE, null, XPathResult.STRING_TYPE, null).stringValue;
	}
	
	// Récupération du statut de la case
	var caseTag = -1;
	var selectBox = document.evaluate('div[@class="right"]//select[@name="tid"]',
		GENERIC_SECTION_NODE, null, XPathResult.ANY_TYPE, null);
	if( (selectBox = selectBox.iterateNext()) != null ) {
		caseTag = parseInt(selectBox.value);
	}
	
	// Récupération du nombre de zombies
	var zombiePts = -1;
	if( document.getElementById('zombiePts') != null ) {
		zombiePts = document.getElementById('zombiePts').firstChild.data;
		/([0-9]+)\s+points?/.test(zombiePts);
		zombiePts = RegExp.$1;
	}
	
	// Zone épuisée ?
	var dried = -1;
	var driedTest = document.evaluate('div[@class="left"]/div[@class="driedZone"]',
		GENERIC_SECTION_NODE, null, XPathResult.BOOLEAN_TYPE, null).booleanValue;
	if( driedTest ) {// bloc "La zone est épuisée" présent
		dried = 1;
	}
	else {
		// Si les zombies contrôlent la zone, on ne sait pas, sinon,
		// c'est que la zone n'est pas épuisée
		driedTest = document.evaluate('div[@class="feist"]',
			GENERIC_SECTION_NODE, null, XPathResult.BOOLEAN_TYPE, null).booleanValue;
		if( !driedTest ) {
			dried = 0;
		}
	}
	
	// Listing des objets présents par terre
	var items = document.evaluate('div[@class="right"]/ul[@class="tools shortTools outInv"]//img[@alt="item"]',
		GENERIC_SECTION_NODE, null, XPathResult.ANY_TYPE, null);
	var item = null, name = null, broken = null;
	var itemsArray = [];
	
	while( (item = items.iterateNext()) != null ) {
		name = item.getAttribute('src');
		name = name.substring(name.indexOf('_')+1, name.lastIndexOf('.'));
		
		if( typeof(itemsArray[name]) == 'undefined' ) {
			itemsArray[name] = [];
			itemsArray[name]['broken'] = 0;
			itemsArray[name]['notbroken'] = 0;
		}
		
		if( item.parentNode.className == 'limited' ) {// Objet cassé
			itemsArray[name]['broken']++;
		}
		else {
			itemsArray[name]['notbroken']++;
		}
	}
	
	//
	// Génération du document XML
	//
	var doc = document.implementation.createDocument("", "hordes", null);
	var pi  = doc.createProcessingInstruction('xml',
		'version="1.0" encoding="' + (doc.inputEncoding || "UTF-8") + '"');
	doc.insertBefore(pi, doc.documentElement);
	
	var headers = doc.createElement('headers');
	headers.setAttribute('version',   HMU_VERSION);
	headers.setAttribute('generator', HMU_APPNAME);
	doc.documentElement.appendChild(headers);
	
	var city = doc.createElement('city');
	city.setAttribute('name', HMU_VARS['mapInfos']['name']);
	city.setAttribute('days', HMU_VARS['mapInfos']['days']);
	doc.documentElement.appendChild(city);
	
	var citizen = doc.createElement('citizen');
	citizen.setAttribute('key', HMU_VARS['key']);
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
	
	coords = coords.split('.');
	zone.setAttribute('x', coords[0]);
	zone.setAttribute('y', coords[1]);
	zone.setAttribute('tag', caseTag);// Statut de la zone
	zone.setAttribute('dried', dried);// Zone épuisée ou pas, ou inconnu
	zone.setAttribute('zombie', zombiePts);
	doc.documentElement.appendChild(zone);
	
	items = doc.createElement('items');
	doc.documentElement.appendChild(items);
	
	item = doc.createElement('item');
	item.setAttribute('name',   '');
	item.setAttribute('count',  '');
	item.setAttribute('broken', '');
	
	for( name in itemsArray ) {
		item = item.cloneNode(false);
		item.setAttribute('name',  name);
		
		if( itemsArray[name]['broken'] > 0 ) {
			item.setAttribute('count', itemsArray[name]['broken']);
			item.setAttribute('broken', '1');
		}
		else {
			item.setAttribute('count', itemsArray[name]['notbroken']);
			item.removeAttribute('broken');
		}
		
		items.appendChild(item);
	}
	
	loadingSection.show();
	
	var xhr = {
		timer: null,
		method: 'POST',
		url: postdata_url,
		data: doc,
		headers: {
			'X-Handler'  : HMU_APPNAME,
			'User-Agent' : HMU_APPNAME + '/' + HMU_VERSION
		},
		onerror: function() {
			xhr.onload = function(){};
			Message.show("Le site cible ne répond pas\u00A0!");
		},
		onload: function(responseDetails) {
			clearTimeout(xhr.timer);
			
			if( responseDetails.status == 200 ) {
				var code = null;
				
				try {
					var doc = new DOMParser().parseFromString(responseDetails.responseText, 'application/xml');
					code = doc.getElementsByTagName('error')[0].getAttribute('code');
					
					if( Number(doc.getElementsByTagName('headers')[0].getAttribute('version')) > HMU_VERSION ) {
						Message.show("Une nouvelle version du script est disponible en " +
							"<a href='" + HMU_APPHOME + "'>téléchargement</a>.<br>" +
							"Votre version peut ne plus fonctionner correctement, " +
							"vous devriez faire la mise à jour.", -1);
					}
					else if( code == 'ok' ) {
						Message.show("La M@p a été mise à jour en " + coords.join('.') + "\u00A0!");
						HMU_VARS['zone_updated'] = true;
					}
				}
				catch(e) {}
				
				if( code != 'ok' ) {
					Message.show("Erreur XML renvoyée par le serveur" +
						(code != null ? '\u00A0: ' + code : ''));
				}
			}
			else {
				Message.show("Erreur HTTP renvoyée par le serveur\u00A0: " +
					responseDetails.status + ' ' + responseDetails.statusText);
			}
		}
	};
	
	if( HMU_VARS['zone_updated'] == false ) {
		GM_xmlhttpRequest(xhr);
		xhr.timer = setTimeout(xhr.onerror, (HMU_TIMEOUT * 1000));
	}
	else {// Aucun changement dans la zone, pas de refresh de la page, inutile de renvoyer les données
		Message.show("La M@p a été mise à jour en " + coords.join('.') + "\u00A0!");
	}
}, false);// fin du addEventListener('click'....) sur link

}, 1000);// fin du setInterval()

